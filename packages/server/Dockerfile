# ---- base ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# ---- development ----
FROM base AS dev
RUN npm install
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate
# src/ et prisma/ sont montés en volumes au runtime
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]

# ---- build ----
FROM base AS build
RUN npm ci
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

# ---- production ----
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
