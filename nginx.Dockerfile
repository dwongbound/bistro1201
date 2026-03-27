FROM node:18-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/index.html ./
COPY frontend/public ./public
COPY frontend/vite.config.js ./
COPY frontend/src ./src

ARG APP_API_BASE_PATH=/api
ARG APP_INSTANCE=development

ENV APP_API_BASE_PATH=$APP_API_BASE_PATH
ENV APP_INSTANCE=$APP_INSTANCE

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
