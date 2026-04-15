// Express-middleware для проверки JWT в заголовке Authorization: Bearer <token>.
// При успехе кладёт данные пользователя в req.user, иначе возвращает 401.
import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "./jwt";

// Расширяем Express.Request, чтобы добавить поле user
declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload;
  }
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Неверный или просроченный токен" });
  }

  req.user = payload;
  next();
}
