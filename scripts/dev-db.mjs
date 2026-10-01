// Local PostgreSQL for development/tests without Docker: PGlite (embedded Postgres)
// exposed over the Postgres wire protocol. Production uses Neon.
//   node scripts/dev-db.mjs            -> persistent data in .data/pglite, port 5433
//   node scripts/dev-db.mjs --memory   -> throwaway in-memory database
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";

const memory = process.argv.includes("--memory");
const port = Number(process.env.DEV_DB_PORT || 5433);
if (!memory) mkdirSync(".data", { recursive: true });
const db = await PGlite.create(memory ? undefined : ".data/pglite");
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 20 });
await server.start();
console.log(`dev-db listening on postgresql://postgres@127.0.0.1:${port}/postgres (${memory ? "memory" : ".data/pglite"})`);
const stop = async () => { await server.stop(); await db.close(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
