// Запуск SQL-миграций drizzle на старте контейнера.
// Команда: "npm run db:migrate" (вызывается entrypoint'ом контейнера).
// После миграций делает upsert обязательных комнат "general" и "work".
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../config/env";
import { rooms } from "./schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[migrate] Подключение к БД...");
  // Отдельный клиент только для миграций, чтобы затем корректно закрыться
  const migrationClient = postgres(env.DATABASE_URL, { max: 1 });
  const migrationsDb = drizzle(migrationClient);

  // Применение всех миграций из папки ./drizzle
  console.log("[migrate] Применение миграций...");
  await migrate(migrationsDb, { migrationsFolder: "./drizzle" });
  console.log("[migrate] Миграции применены.");

  // Гарантируем наличие двух предустановленных комнат
  console.log("[migrate] Посев комнат (seed rooms)...");
  await migrationsDb.execute(
    sql`INSERT INTO rooms (slug, title) VALUES ('general', 'Общая') ON CONFLICT (slug) DO NOTHING`
  );
  await migrationsDb.execute(
    sql`INSERT INTO rooms (slug, title) VALUES ('work', 'Рабочая') ON CONFLICT (slug) DO NOTHING`
  );
  console.log("[migrate] Готово.");

  await migrationClient.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] Ошибка миграций:", err);
  process.exit(1);
});
