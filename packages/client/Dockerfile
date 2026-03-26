# ---- development ----
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN npm install
COPY packages/client/index.html packages/client/tsconfig.json packages/client/vite.config.ts ./packages/client/
# src/ est monté en volume au runtime
WORKDIR /app/packages/client
CMD ["npm", "run", "dev"]

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN npm ci
COPY packages/client/ ./packages/client/
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN cd packages/client && npm run build

# ---- production ----
FROM nginx:alpine AS production
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/client/dist /usr/share/nginx/html
EXPOSE 80
