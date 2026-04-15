// REST-роуты для регистрации и входа.
// Все входные данные валидируются через zod.
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password";
import { signToken } from "../auth/jwt";
import { authRequired } from "../auth/middleware";

export const authRouter = Router();

// Схемы валидации тел запросов
const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Минимум 3 символа")
    .max(32, "Максимум 32 символа")
    .regex(/^[a-zA-Z0-9_\-]+$/, "Только латиница, цифры, _ и -"),
  password: z.string().min(6, "Пароль минимум 6 символов").max(128),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/register — создать пользователя, вернуть JWT
authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Некорректные данные",
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const { username, password } = parsed.data;

  // Проверяем, что имя свободно
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Пользователь с таким именем уже существует" });
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({ username, passwordHash })
    .returning({ id: users.id, username: users.username });

  const token = signToken({ userId: created.id, username: created.username });
  return res.status(201).json({
    token,
    user: { id: created.id, username: created.username },
  });
});

// POST /api/auth/login — проверить пароль и вернуть JWT
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Некорректные данные" });
  }
  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  // Сознательно отдаём одинаковую ошибку, чтобы не палить, какое поле неверное
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  const token = signToken({ userId: user.id, username: user.username });
  return res.json({
    token,
    user: { id: user.id, username: user.username },
  });
});

// GET /api/auth/me — данные текущего пользователя (используется для восстановления сессии)
authRouter.get("/me", authRequired, async (req, res) => {
  return res.json({ user: req.user });
});
