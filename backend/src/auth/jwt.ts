// Выпуск и проверка JWT-токенов.
// В токене хранится минимум: id пользователя и его username.
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  userId: number;
  username: string;
}

// Выпуск нового токена для пользователя
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

// Проверка токена; возвращает payload либо null при ошибке
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "userId" in decoded &&
      "username" in decoded
    ) {
      return {
        userId: Number((decoded as JwtPayload).userId),
        username: String((decoded as JwtPayload).username),
      };
    }
    return null;
  } catch {
    return null;
  }
}
