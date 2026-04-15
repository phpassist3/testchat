-- Исходная миграция: таблицы users, rooms, messages + индекс.
-- Содержимое соответствует src/db/schema.ts. В реальном проекте
-- такой файл генерируется через "npm run db:generate".

CREATE TABLE IF NOT EXISTS "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "username" varchar(32) NOT NULL,
    "password_hash" varchar(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "users_username_unique" UNIQUE("username")
);

CREATE TABLE IF NOT EXISTS "rooms" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" varchar(32) NOT NULL,
    "title" varchar(64) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "rooms_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "messages" (
    "id" serial PRIMARY KEY NOT NULL,
    "room_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "content" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_rooms_id_fk"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "messages_room_created_idx" ON "messages" ("room_id","created_at");
