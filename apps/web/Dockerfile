FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci

COPY apps/web ./apps/web

RUN npm run build:web

FROM nginx:1.27-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
