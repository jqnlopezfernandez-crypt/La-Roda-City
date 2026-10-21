# Servidor multijugador de La Roda City (Colyseus sobre Node.js 22).
# Escucha en $PORT (el alojamiento lo define) y expone GET /salud.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run server:build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist-server ./dist-server
EXPOSE 2567
CMD ["node", "dist-server/index.mjs"]
