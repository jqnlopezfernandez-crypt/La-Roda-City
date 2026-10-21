import { createGameServer } from "./app.ts";

const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? "0.0.0.0";

const { gameServer } = createGameServer();
await gameServer.listen(port, host);
console.log(`La Roda City · servidor escuchando en ws://${host}:${port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void gameServer.gracefullyShutdown(true));
}
