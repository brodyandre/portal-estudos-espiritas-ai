FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci

COPY apps/api ./apps/api
COPY data ./data

RUN npm run build:api

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/data ./data

WORKDIR /app/apps/api

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "const port = process.env.PORT || 4000; fetch('http://127.0.0.1:' + port + '/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "dist/server.js"]
