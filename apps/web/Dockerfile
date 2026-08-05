FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_APP_MODE
ARG VITE_API_URL
ARG VITE_ENABLE_ADMIN_FEATURES
ARG VITE_ENABLE_TEACHER_FEATURES
ARG VITE_SHOW_REAL_MEET_LINK

ENV VITE_APP_MODE=${VITE_APP_MODE}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_ENABLE_ADMIN_FEATURES=${VITE_ENABLE_ADMIN_FEATURES}
ENV VITE_ENABLE_TEACHER_FEATURES=${VITE_ENABLE_TEACHER_FEATURES}
ENV VITE_SHOW_REAL_MEET_LINK=${VITE_SHOW_REAL_MEET_LINK}

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci --ignore-scripts

COPY apps/web ./apps/web

RUN npm run build:web

FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=nginx:nginx /app/apps/web/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /run /var/cache/nginx /var/log/nginx /var/run /usr/share/nginx/html

USER nginx

EXPOSE 3000

ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
