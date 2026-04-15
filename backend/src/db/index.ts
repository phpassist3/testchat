// Инициализация подключения к PostgreSQL и инстанса drizzle-orm.
// Экспортируется готовый объект db, который используется во всех запросах.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

// postgres.js: один общий pool на процесс
// max=10 подключений — с запасом для небольшого чата
const queryClient = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(queryClient, { schema });
export { schema };
