// Лёгкая обёртка вокруг WebSocket с автоматическим переподключением и
// системой подписки на входящие сообщения.
import type { WsClientEvent, WsServerEvent } from "./types";

// Путь WS относительно текущего хоста (по умолчанию /ws).
// Протокол определяем по текущей странице: https -> wss, http -> ws.
const WS_PATH = (import.meta.env.VITE_WS_PATH || "/ws").replace(/^\/?/, "/");

function buildWsUrl(token: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${WS_PATH}?token=${encodeURIComponent(token)}`;
}

type Listener = (ev: WsServerEvent) => void;

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private token: string;
  private listeners: Set<Listener> = new Set();
  // Комнаты, на которые клиент хочет быть подписан даже после переподключений
  private joinedRooms: Set<string> = new Set();
  private reconnectTimer: number | null = null;
  private closedByUser = false;

  constructor(token: string) {
    this.token = token;
  }

  connect() {
    this.closedByUser = false;
    const url = buildWsUrl(this.token);
    this.ws = new WebSocket(url);

    this.ws.addEventListener("open", () => {
      // При переподключении заново подписываемся на все комнаты
      this.joinedRooms.forEach((slug) => {
        this.send({ type: "join", roomSlug: slug });
      });
    });

    this.ws.addEventListener("message", (ev) => {
      try {
        const data = JSON.parse(ev.data) as WsServerEvent;
        this.listeners.forEach((l) => l(data));
      } catch {
        // Некорректный JSON от сервера — игнорируем
      }
    });

    this.ws.addEventListener("close", () => {
      if (this.closedByUser) return;
      // Экспоненциальное ожидание не делаем ради простоты: 2 секунды
      this.reconnectTimer = window.setTimeout(() => this.connect(), 2000);
    });

    this.ws.addEventListener("error", () => {
      // onclose всё равно вызовется — обработка там
    });
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  send(ev: WsClientEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(ev));
    }
  }

  join(slug: string) {
    this.joinedRooms.add(slug);
    this.send({ type: "join", roomSlug: slug });
  }

  leave(slug: string) {
    this.joinedRooms.delete(slug);
    this.send({ type: "leave", roomSlug: slug });
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
