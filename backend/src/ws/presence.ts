// Простое in-memory хранилище онлайн-статусов.
// Для одного инстанса бэкенда этого достаточно; для горизонтального
// масштабирования потребовалась бы внешняя шина (Redis pub/sub).

interface OnlineUser {
  userId: number;
  username: string;
  // Количество открытых WS-соединений одного пользователя (разные вкладки)
  sockets: number;
}

// Map по userId, чтобы один пользователь с двух вкладок считался один раз
const online = new Map<number, OnlineUser>();

export function addUser(userId: number, username: string) {
  const existing = online.get(userId);
  if (existing) {
    existing.sockets += 1;
    return false; // пользователь уже был онлайн
  }
  online.set(userId, { userId, username, sockets: 1 });
  return true; // появился новый онлайн-пользователь
}

export function removeUser(userId: number): boolean {
  const existing = online.get(userId);
  if (!existing) return false;
  existing.sockets -= 1;
  if (existing.sockets <= 0) {
    online.delete(userId);
    return true; // пользователь ушёл из онлайна
  }
  return false;
}

export function listOnline(): { userId: number; username: string }[] {
  return Array.from(online.values()).map((u) => ({
    userId: u.userId,
    username: u.username,
  }));
}
