# Мини-чат на WebSocket

Чат с регистрацией, двумя комнатами,
WebSocket-рассылкой сообщений, сохранением истории в PostgreSQL, онлайн-статусом
и индикатором «печатает…».

для теста: **https://chat.phpassist.dev**

## Стек

- **Backend:** Node.js 20, Express, TypeScript, WebSocket, Drizzle ORM, JWT, zod, bcryptjs
- **Frontend:** React 18, TypeScript, Vite, нативный WebSocket API
- **База данных:** PostgreSQL 16
- **Инфраструктура:** Docker + Docker Compose, Nginx, Let's Encrypt, Certbot
- **Стиль кода:** TypeScript, комментарии к коду

## Возможности

- Регистрация и вход (JWT, пароли хэшируются через bcrypt).
- Две предустановленные комнаты: «Общая» и «Рабочая» (создаются миграцией/посевом).
- Отправка и получение сообщений в реальном времени через WebSocket.
- Сохранение всех сообщений в PostgreSQL.
- Загрузка последних 50 сообщений при входе в комнату.
- Онлайн-статус пользователей (обновляется в реальном времени).
- Индикатор «печатает…».
- Автоматическое переподключение WebSocket, keep-alive ping/pong.
- Адаптивная вёрстка (работает на мобильных).



## Быстрый старт (локально)

Нужны установленные Docker и Docker Compose.

```bash
# 1) Клонировать репозиторий
git clone https://github.com/phpassist3/testchat.git
cd testchat

# 2) Подготовить переменные окружения
cp .env.example .env
# Отредактировать .env: как минимум заменить JWT_SECRET и POSTGRES_PASSWORD.

# 3) Поднять стек
docker compose up --build -d

# 4) Открыть в браузере
# Frontend: http://localhost:8080
# API:      http://localhost:4000/api/health
```

После первого запуска миграции применятся автоматически, и в БД появятся
две комнаты: «Общая» и «Рабочая».

## Переменные окружения

Все настройки — в `.env` (см. `.env.example`):

| Переменная          | Назначение                                                  |
|---------------------|-------------------------------------------------------------|
| `POSTGRES_DB`       | Имя БД PostgreSQL                                           |
| `POSTGRES_USER`     | Пользователь БД                                             |
| `POSTGRES_PASSWORD` | Пароль БД                                                   |
| `API_PORT`          | Порт backend-сервиса (по умолчанию 4000)                    |
| `DATABASE_URL`      | Строка подключения, используемая backend                    |
| `JWT_SECRET`        | Секрет для подписи JWT (обязательно заменить в проде!)      |
| `JWT_EXPIRES_IN`    | Срок жизни токена (например, `7d`)                          |
| `CORS_ORIGIN`       | Разрешённый Origin для CORS                                 |
| `VITE_API_BASE`     | Путь REST API относительно домена (по умолчанию `/api`)     |
| `VITE_WS_PATH`      | Путь WebSocket относительно домена (по умолчанию `/ws`)     |

## Развёртывание в продакшне (chat.phpassist.dev)

На сервере (Ubuntu 24.04) установлено:

- Docker CE + Docker Compose plugin
- Nginx (хостовый, проксирует на локальные порты docker)
- Certbot (Let's Encrypt)

Шаги развёртывания:

```bash
# 1) Клонировать репозиторий
sudo mkdir -p /opt/testchat && cd /opt/testchat
sudo git clone https://github.com/phpassist3/testchat.git .

# 2) Подготовить .env
sudo cp .env.example .env
sudo nano .env   # заменить JWT_SECRET и POSTGRES_PASSWORD, VITE_API_BASE=/api, VITE_WS_PATH=/ws

# 3) Временный (bootstrap) конфиг nginx для выпуска SSL
sudo cp deploy/nginx/chat.phpassist.dev.bootstrap.conf /etc/nginx/sites-available/chat.phpassist.dev.conf
sudo ln -sf /etc/nginx/sites-available/chat.phpassist.dev.conf /etc/nginx/sites-enabled/chat.phpassist.dev.conf
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx

# 4) Выпустить сертификат
sudo certbot certonly --webroot -w /var/www/certbot -d chat.phpassist.dev \
  --non-interactive --agree-tos -m phpassist3@gmail.com

# 5) Поставить финальный конфиг nginx (HTTPS + WS proxy)
sudo cp deploy/nginx/chat.phpassist.dev.conf /etc/nginx/sites-available/chat.phpassist.dev.conf
sudo nginx -t && sudo systemctl reload nginx

# 6) Поднять стек
sudo docker compose up --build -d
```

После этого чат доступен по адресу https://chat.phpassist.dev.

Сертификат Let's Encrypt автоматически обновляется по systemd-таймеру certbot;
при обновлении он вызывает `nginx reload`.


## Протокол WebSocket

Подключение: `wss://chat.phpassist.dev/ws?token=<JWT>`.
Общение — JSON-сообщения с полем `type`.

Клиент → сервер:
- `{ type: "join",    roomSlug }` — подписаться на комнату
- `{ type: "leave",   roomSlug }` — отписаться
- `{ type: "message", roomSlug, content }` — отправить сообщение
- `{ type: "typing",  roomSlug, isTyping }` — статус «печатает…»

Сервер → клиент:
- `{ type: "message",  roomSlug, message }` — новое сообщение
- `{ type: "typing",   roomSlug, userId, username, isTyping }`
- `{ type: "presence", online: [{ userId, username }] }`
- `{ type: "error",    message }`

## Разработка

Backend:

```bash
cd backend
npm install
npm run dev        # tsx watch, пересобирает при изменениях
```

Frontend:

```bash
cd frontend
npm install
npm run dev        # Vite dev-сервер на :5173 с проксированием /api и /ws на :4000
```
