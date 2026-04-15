// Точка входа backend-приложения.
// Поднимает HTTP-сервер Express и подключает к нему WebSocket на /ws.
import express from "express";
import http from "http";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { roomsRouter } from "./routes/rooms";
import { initWebSocket } from "./ws/server";

const app = express();

// Глобальные middleware
app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN }));
app.use(express.json({ limit: "64kb" }));

// Health-check (используется docker healthcheck и nginx upstream check)
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Роуты
app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);

// Единый обработчик ошибок: перехватывает исключения из async-хэндлеров
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[api] Unhandled error:", err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
);

// Поднимаем HTTP-сервер и навешиваем на него WebSocket
const httpServer = http.createServer(app);
initWebSocket(httpServer);

httpServer.listen(env.API_PORT, () => {
  console.log(`[api] HTTP+WS сервер слушает на порту ${env.API_PORT}`);
});

// Корректное завершение при SIGTERM (docker stop)
process.on("SIGTERM", () => {
  console.log("[api] Получен SIGTERM, завершаем работу...");
  httpServer.close(() => process.exit(0));
});
