// Централизованная загрузка и валидация переменных окружения.
// Все значения, которые читает приложение, должны проходить через этот модуль.
import "dotenv/config";
import { z } from "zod";

// Схема описывает, какие переменные ожидаются и их типы
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL обязательна"),
  JWT_SECRET: z.string().min(10, "JWT_SECRET должен быть длиннее 10 символов"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Выводим понятную ошибку и падаем — без корректной конфигурации запуск бессмыслен
  console.error("[env] Ошибка конфигурации:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
