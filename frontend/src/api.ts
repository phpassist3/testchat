// Тонкий клиент REST API.
// Все запросы ходят через fetch с автоподстановкой Bearer-токена.
import type { AuthUser, ChatMessage, Room } from "./types";

// Базовый путь к API. Задаётся на этапе сборки через VITE_API_BASE.
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // Пытаемся достать красивое сообщение об ошибке, если сервер его прислал
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // игнорируем, вернём общий статус
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async register(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return handle(res);
  },

  async login(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return handle(res);
  },

  async me(token: string): Promise<{ user: AuthUser }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: authHeaders(token),
    });
    return handle(res);
  },

  async rooms(token: string): Promise<{ rooms: Room[] }> {
    const res = await fetch(`${API_BASE}/rooms`, {
      headers: authHeaders(token),
    });
    return handle(res);
  },

  async messages(token: string, slug: string): Promise<{ messages: ChatMessage[] }> {
    const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(slug)}/messages`, {
      headers: authHeaders(token),
    });
    return handle(res);
  },
};
