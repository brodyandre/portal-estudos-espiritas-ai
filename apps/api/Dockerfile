FROM node:20-alpine AS workspace-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci --ignore-scripts

COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/scripts ./apps/api/scripts

RUN npm --workspace @portal-estudos-espiritas-ai/api run prisma:generate

FROM workspace-deps AS builder

COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src ./apps/api/src
COPY data ./data

RUN npm run build:api

FROM node:20-alpine AS production-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=workspace-deps /app/node_modules/.prisma ./node_modules/.prisma

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=production-deps --chown=node:node /app/package.json ./package.json
COPY --from=production-deps --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=production-deps --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/data/knowledge ./data/knowledge

WORKDIR /app/apps/api

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "const port = process.env.PORT || '4000'; fetch('http://127.0.0.1:' + port + '/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

ENTRYPOINT []
CMD ["node", "dist/server.js"]

FROM workspace-deps AS migration

WORKDIR /app/apps/api

ENV NODE_ENV=production

USER node

ENTRYPOINT []
CMD ["npm", "--workspace", "@portal-estudos-espiritas-ai/api", "run", "prisma:migrate"]
