import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy.ts";
test("request gate blocks missing and foreign origins", () => {
  for (const origin of [undefined, "https://foreign.example"]) { const headers: Record<string, string> = { host: "localhost:3000" }; if (origin) headers.origin = origin; const r = proxy(new NextRequest("http://localhost:3000/api/v1/tickets", { method: "POST", headers })); assert.equal(r.status, 403); }
  assert.equal(proxy(new NextRequest("http://localhost:3000/api/v1/tickets", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" } })).status, 200);
});
test("portal sign-in redirects to the actual login route", () => { const r = proxy(new NextRequest("http://localhost:3000/portal/tickets")); assert.equal(new URL(r.headers.get("location")!).pathname, "/login"); assert.equal(new URL(r.headers.get("location")!).searchParams.get("next"), "/portal/tickets"); });
