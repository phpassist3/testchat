# Многоступенчатый Dockerfile для backend-сервиса.
# Stage 1: установка зависимостей и сборка TypeScript -> JavaScript
FROM node:20-alpine AS build
WORKDIR /app
# Сначала копируем только манифесты, чтобы слой с npm ci кешировался
COPY package.json ./
# Используем npm install, а не ci, т.к. package-lock.json в репо отсутствует
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build

# Stage 2: минимальный runtime-образ
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Ставим только production-зависимости
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
# Копируем собранный код и миграции
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
# Запускаем как непривилегированного пользователя, входящего в стандартный образ node
USER node
EXPOSE 4000
# Entrypoint: сначала применяем миграции, затем запускаем сервер.
# Для миграций нужен tsx, который лежит в devDependencies, поэтому
# в продакшн-образе выполняем SQL-миграции через Node-скрипт из dist.
# Так как migrate.ts компилируется в dist/db/migrate.js — используем его.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
