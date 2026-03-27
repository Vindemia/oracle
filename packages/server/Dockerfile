# ---- base ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# ---- development ----
FROM base AS dev
RUN npm install
COPY packages/server/tsconfig.json packages/server/prisma.config.ts ./packages/server/
COPY packages/server/prisma ./packages/server/prisma
RUN cd packages/server && npx prisma generate
# src/ et prisma/ sont montés en volumes au runtime
WORKDIR /app/packages/server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]

# ---- build ----
FROM base AS build
RUN npm ci
COPY packages/server/tsconfig.json packages/server/prisma.config.ts ./packages/server/
COPY packages/server/prisma ./packages/server/prisma
COPY packages/server/src ./packages/server/src
RUN cd packages/server && npx prisma generate && npm run build

# ---- production ----
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/prisma ./prisma
COPY --from=build /app/packages/server/prisma.config.ts ./
COPY --from=build /app/packages/server/package.json ./
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
