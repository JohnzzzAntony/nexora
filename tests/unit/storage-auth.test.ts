import { test } from "node:test";
import assert from "node:assert/strict";
import { signLocal, verifyLocal, readLocalObject } from "../../src/lib/storage/index.ts";
import { getApiContext } from "../../src/lib/api/handler.ts";
import { NextRequest } from "next/server";
test("signed upload grants reject tampering, expiry and extra segments", () => {
  const token = signLocal({ k: "org/file.txt", op: "put", exp: Date.now() + 10000, mime: "text/plain" });
  assert.ok(verifyLocal(token)); assert.equal(verifyLocal(token + ".extra"), null); assert.equal(verifyLocal(token + "x"), null);
  assert.equal(verifyLocal(signLocal({ k: "org/file.txt", op: "get", exp: 0, mime: "text/plain" })), null);
});
test("local storage rejects traversal into sibling directories", async () => { await assert.rejects(readLocalObject("../uploads-other/file.txt"), /Invalid storage key/); });
test("invalid bearer cannot fall back to browser session and bypass CSRF", async () => {
  const req = new NextRequest("http://localhost:3000/api/v1/tickets", { headers: { Authorization: "Bearer invalid" } });
  await assert.rejects(getApiContext(req), (e: unknown) => (e as { code?: string }).code === "INVALID_API_KEY");
});
