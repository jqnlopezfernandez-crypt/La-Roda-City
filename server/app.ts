import { createServer } from "node:http";
import { Server, createEndpoint, createRouter } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "../shared/net/protocol.ts";
import { GameRoom } from "./rooms/GameRoom.ts";

/**
 * Crea el servidor de juego. Las rutas HTTP de Colyseus (emparejamiento) ya
 * responden con cabeceras CORS, necesarias porque el cliente se servirá desde
 * otro dominio (GitHub Pages). GET /salud sirve para comprobar que está vivo
 * (lo usan los servicios de alojamiento).
 *
 * Importante: las rutas propias se registran en el router de Colyseus. Un
 * listener "request" aparte haría que dos manejadores respondieran a la misma
 * petición y el proceso se caería (ERR_HTTP_HEADERS_SENT).
 */
export function createGameServer() {
  const httpServer = createServer();
  const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
  gameServer.define(ROOM_NAME, GameRoom);
  gameServer.router = createRouter({
    salud: createEndpoint("/salud", { method: "GET" }, async () => ({ ok: true, juego: "La Roda City" })),
  });
  return { gameServer, httpServer };
}
