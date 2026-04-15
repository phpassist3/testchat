// REST-роуты для работы с комнатами и историей сообщений.
import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { messages, rooms, users } from "../db/schema";
import { authRequired } from "../auth/middleware";

export const roomsRouter = Router();

// GET /api/rooms — список доступных комнат
roomsRouter.get("/", authRequired, async (_req, res) => {
  const list = await db
    .select({ id: rooms.id, slug: rooms.slug, title: rooms.title })
    .from(rooms)
    .orderBy(rooms.id);
  return res.json({ rooms: list });
});

// GET /api/rooms/:slug/messages — последние 50 сообщений комнаты (по убыванию времени)
// Возвращаем в хронологическом порядке (старые сверху), чтобы фронт сразу отрисовал.
roomsRouter.get("/:slug/messages", authRequired, async (req, res) => {
  const { slug } = req.params;

  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.slug, slug))
    .limit(1);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });

  // JOIN с users нужен, чтобы фронт сразу получал username автора
  const rows = await db
    .select({
      id: messages.id,
      content: messages.content,
      createdAt: messages.createdAt,
      userId: messages.userId,
      username: users.username,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.userId))
    .where(eq(messages.roomId, room.id))
    .orderBy(desc(messages.createdAt))
    .limit(50);

  // Переворачиваем в хронологический порядок (от старых к новым)
  const sorted = rows.reverse();
  return res.json({ messages: sorted });
});
