// Описание таблиц БД для drizzle ORM.
// По изменению этой схемы выполняется "npm run db:generate" для создания SQL-миграции.
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

// Пользователи чата
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // Логин (уникальный)
  username: varchar("username", { length: 32 }).notNull().unique(),
  // Хеш пароля (bcrypt)
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Комнаты чата. В рамках задачи используется две предустановленные комнаты:
// "general" (Общая) и "work" (Рабочая). Таблица нужна для расширяемости и
// для хранения отображаемых названий.
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  // Технический код комнаты (general, work)
  slug: varchar("slug", { length: 32 }).notNull().unique(),
  // Отображаемое имя комнаты (на русском)
  title: varchar("title", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Сообщения чата
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Содержимое сообщения (ограничено разумной длиной)
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Индекс ускоряет запрос "последние N сообщений комнаты"
    roomCreatedIdx: index("messages_room_created_idx").on(t.roomId, t.createdAt),
  })
);

// Удобные TS-типы для использования в коде
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
