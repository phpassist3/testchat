# Многоступенчатый Dockerfile фронтенда: сборка + nginx-runtime

# Stage 1: сборка статики через Vite
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
# Build-time переменные окружения Vite
ARG VITE_API_BASE=/api
ARG VITE_WS_PATH=/ws
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_WS_PATH=$VITE_WS_PATH
RUN npm run build

# Stage 2: отдача статики через nginx
FROM nginx:alpine AS runtime
# Удаляем дефолтный конфиг и кладём свой
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
