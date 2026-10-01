// Always use an isolated database. Never load .env or connect tests to Neon.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const database = await PGlite.create();
const server = new PGLiteSocketServer({ db: database, host: "127.0.0.1", port: 0, maxConnections: 20 });
await server.start();
const url = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;
const testEnv = { ...process.env, NODE_ENV: "test", DATABASE_URL: url, DIRECT_URL: url,
  AUTH_SECRET: "isolated-test-secret-at-least-thirty-two-characters", NEXTAUTH_SECRET: "isolated-test-secret-at-least-thirty-two-characters",
  RESEND_API_KEY: "", SMTP_HOST: "", APP_URL: "http://localhost:3000" };
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { env: testEnv, stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", code => resolve(code ?? 1));
});
async function tests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(e => e.isDirectory() ? tests(join(dir, e.name)) : e.name.endsWith(".test.ts") ? [join(dir, e.name)] : []));
  return nested.flat();
}
try {
  const migrated = await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  process.exitCode = migrated || await run(["--import", "tsx", "--import", "./scripts/server-only-shim.mjs", "--test", ...await tests("tests")]);
} finally {
  await server.stop();
  await database.close();
}
