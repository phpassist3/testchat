// Инициализация WebSocket-сервера поверх HTTP-сервера Express.
// Протокол общения — JSON-сообщения с полем "type".
//
// Клиент подключается на /ws?token=<JWT>. Если токен невалидный — соединение закрывается.
// Сообщения клиента:
//   { type: "join",  roomSlug: string }                 — подписаться на комнату
//   { type: "leave", roomSlug: string }                 — отписаться
//   { type: "message", roomSlug: string, content: string } — отправить сообщение
//   { type: "typing", roomSlug: string, isTyping: bool }   — индикатор "печатает..."
//
// Сообщения сервера:
//   { type: "message", roomSlug, message }              — новое сообщение в комнате
//   { type: "typing",  roomSlug, userId, username, isTyping }
//   { type: "presence", online: [{ userId, username }] } — обновление списка онлайн
//   { type: "error",   message }                        — ошибка
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "http";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { messages, rooms } from "../db/schema";
import { verifyToken } from "../auth/jwt";
import { addUser, listOnline, removeUser } from "./presence";

// Расширяем стандартный WebSocket, чтобы хранить контекст соединения
interface ChatSocket extends WebSocket {
  userId: number;
  username: string;
  // Набор slug-ов комнат, на которые подписан клиент
  rooms: Set<string>;
  isAlive: boolean;
}

// Кэш соответствия slug -> id комнаты, чтобы не ходить в БД на каждое сообщение
const roomIdCache = new Map<string, number>();
async function resolveRoomId(slug: string): Promise<number | null> {
  const cached = roomIdCache.get(slug);
  if (cached !== undefined) return cached;
  const [row] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.slug, slug))
    .limit(1);
  if (!row) return null;
  roomIdCache.set(slug, row.id);
  return row.id;
}

export function initWebSocket(httpServer: HttpServer) {
  // noServer: true — мы сами обрабатываем upgrade, чтобы проверить токен
  const wss = new WebSocketServer({ noServer: true, path: "/ws" });

  // Рукопожатие: проверяем JWT из query-параметра token=...
  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws")) {
      return;
    }
    // Извлекаем token из query
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token") || "";
    const payload = verifyToken(token);
    if (!payload) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const chatWs = ws as ChatSocket;
      chatWs.userId = payload.userId;
      chatWs.username = payload.username;
      chatWs.rooms = new Set();
      chatWs.isAlive = true;
      wss.emit("connection", chatWs, req);
    });
  });

  // Рассылает событие всем клиентам, подписанным на комнату
  function broadcastToRoom(roomSlug: string, data: unknown, excludeUserId?: number) {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const c = client as ChatSocket;
      if (c.readyState !== WebSocket.OPEN) return;
      if (!c.rooms.has(roomSlug)) return;
      if (excludeUserId !== undefined && c.userId === excludeUserId) return;
      c.send(payload);
    });
  }

  // Рассылает событие ВСЕМ подключённым клиентам (используется для presence)
  function broadcastAll(data: unknown) {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const c = client as ChatSocket;
      if (c.readyState === WebSocket.OPEN) c.send(payload);
    });
  }

  wss.on("connection", (ws) => {
    const chatWs = ws as ChatSocket;

    // Регистрируем пользователя в presence
    const appeared = addUser(chatWs.userId, chatWs.username);
    // Отправляем новому клиенту текущий список онлайн
    chatWs.send(
      JSON.stringify({ type: "presence", online: listOnline() })
    );
    if (appeared) {
      // Сообщаем остальным, что кто-то вошёл
      broadcastAll({ type: "presence", online: listOnline() });
    }

    // Pong для keep-alive
    chatWs.on("pong", () => {
      chatWs.isAlive = true;
    });

    chatWs.on("message", async (raw) => {
      // Ограничиваем размер сообщения для безопасности
      const text = raw.toString().slice(0, 8192);
      let msg: { type?: string; roomSlug?: string; content?: string; isTyping?: boolean } = {};
      try {
        msg = JSON.parse(text);
      } catch {
        chatWs.send(JSON.stringify({ type: "error", message: "Некорректный JSON" }));
        return;
      }

      if (msg.type === "join" && typeof msg.roomSlug === "string") {
        // Убеждаемся, что комната существует
        const roomId = await resolveRoomId(msg.roomSlug);
        if (!roomId) {
          chatWs.send(JSON.stringify({ type: "error", message: "Комната не найдена" }));
          return;
        }
        chatWs.rooms.add(msg.roomSlug);
        return;
      }

      if (msg.type === "leave" && typeof msg.roomSlug === "string") {
        chatWs.rooms.delete(msg.roomSlug);
        return;
      }

      if (
        msg.type === "message" &&
        typeof msg.roomSlug === "string" &&
        typeof msg.content === "string"
      ) {
        const content = msg.content.trim();
        if (!content) return;
        if (content.length > 2000) {
          chatWs.send(
            JSON.stringify({ type: "error", message: "Слишком длинное сообщение" })
          );
          return;
        }
        const roomId = await resolveRoomId(msg.roomSlug);
        if (!roomId) {
          chatWs.send(JSON.stringify({ type: "error", message: "Комната не найдена" }));
          return;
        }
        // Сохраняем в БД и сразу получаем id/createdAt
        const [saved] = await db
          .insert(messages)
          .values({
            roomId,
            userId: chatWs.userId,
            content,
          })
          .returning({
            id: messages.id,
            content: messages.content,
            createdAt: messages.createdAt,
          });

        const outbound = {
          type: "message",
          roomSlug: msg.roomSlug,
          message: {
            id: saved.id,
            content: saved.content,
            createdAt: saved.createdAt,
            userId: chatWs.userId,
            username: chatWs.username,
          },
        };
        broadcastToRoom(msg.roomSlug, outbound);
        return;
      }

      if (
        msg.type === "typing" &&
        typeof msg.roomSlug === "string" &&
        typeof msg.isTyping === "boolean"
      ) {
        // Не сохраняем в БД — просто транслируем остальным в комнате
        broadcastToRoom(
          msg.roomSlug,
          {
            type: "typing",
            roomSlug: msg.roomSlug,
            userId: chatWs.userId,
            username: chatWs.username,
            isTyping: msg.isTyping,
          },
          chatWs.userId
        );
        return;
      }

      chatWs.send(JSON.stringify({ type: "error", message: "Неизвестный тип сообщения" }));
    });

    chatWs.on("close", () => {
      const gone = removeUser(chatWs.userId);
      if (gone) {
        broadcastAll({ type: "presence", online: listOnline() });
      }
    });
  });

  // Heartbeat: раз в 30 секунд пингуем клиентов, закрываем тех, кто не ответил
  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      const c = client as ChatSocket;
      if (!c.isAlive) {
        c.terminate();
        return;
      }
      c.isAlive = false;
      c.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));
  return wss;
}
