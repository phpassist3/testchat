// Общие TypeScript-типы для фронта.
// Форматы совпадают с тем, что возвращает backend.

export interface AuthUser {
  id: number;
  username: string;
}

export interface Room {
  id: number;
  slug: string;
  title: string;
}

// Сообщение, приходящее из REST и из WS.
// createdAt сохраняем как строку — Date разбираем при отображении.
export interface ChatMessage {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  username: string;
}

// События от WS-сервера
export type WsServerEvent =
  | { type: "message"; roomSlug: string; message: ChatMessage }
  | { type: "typing"; roomSlug: string; userId: number; username: string; isTyping: boolean }
  | { type: "presence"; online: { userId: number; username: string }[] }
  | { type: "error"; message: string };

// События от клиента к серверу
export type WsClientEvent =
  | { type: "join"; roomSlug: string }
  | { type: "leave"; roomSlug: string }
  | { type: "message"; roomSlug: string; content: string }
  | { type: "typing"; roomSlug: string; isTyping: boolean };
