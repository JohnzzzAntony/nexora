// Acceptance checks for a running local app. No passwords, cookies or signed URLs in output.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const base = process.env.APP_URL || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("Acceptance checks require a local app URL.");
const credentials = JSON.parse(await readFile(".data/demo-credentials.json", "utf8"));
const cookies = new Map();
const report = [];
async function request(path, options = {}) {
  const headers = { ...options.headers, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") };
  const r = await fetch(base + path, { ...options, headers, redirect: "manual" });
  for (const cookie of r.headers.getSetCookie()) { const pair = cookie.split(";", 1)[0]; const i = pair.indexOf("="); cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
  return r;
}
function record(name, passed, status) { report.push({ name, passed, status }); console.log(`${passed ? "PASS" : "FAIL"} ${name}${status ? ` (${status})` : ""}`); }
const health = await request("/api/health"); record("Database health", health.status === 200, health.status);
const anonymous = await request("/api/v1/tickets"); record("Anonymous API denied", anonymous.status === 401, anonymous.status);
const csrf = await (await request("/api/auth/csrf")).json();
const login = await request("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: base }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: "owner@demo.duoonex.test", password: credentials.password, json: "true", callbackUrl: `${base}/dashboard` }) });
const loginBody = await login.json(); record("Tester sign-in", login.status === 200 && !loginBody.url?.includes("error="), login.status);
for (const path of ["/dashboard", "/tickets", "/tickets/new", "/my-work", "/tasks", "/tasks/new", "/projects", "/teams", "/customers", "/assets", "/knowledge", "/approvals", "/reports", "/notifications", "/profile", "/help", "/settings", "/settings/organization", "/settings/users", "/settings/roles", "/settings/teams", "/settings/departments", "/settings/locations", "/settings/categories", "/settings/priorities", "/settings/statuses", "/settings/forms", "/settings/custom-fields", "/settings/templates", "/settings/automations", "/settings/sla", "/settings/business-hours", "/settings/holidays", "/settings/email", "/settings/email-templates", "/settings/integrations", "/settings/api", "/settings/webhooks", "/settings/branding", "/settings/security", "/settings/audit-logs", "/settings/billing", "/portal/tickets", "/portal/knowledge"]) {
  const r = await request(path); const html = await r.text(); record(path, r.status === 200 && !html.includes("Something went wrong") && !html.includes("This page could not be found"), r.status);
}
const invalid = await request("/api/v1/tickets", { headers: { Authorization: "Bearer invalid" } }); record("Invalid bearer rejected despite session", invalid.status === 401, invalid.status);
const forgery = await request("/api/v1/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: "Should never be created" }) }); record("Missing-origin mutation denied", forgery.status === 403, forgery.status);
const body = "Nexora acceptance upload";
let attachment;
try {
  const p = await request("/api/v1/files/presign", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ filename: "acceptance.txt", mimeType: "text/plain", size: Buffer.byteLength(body), target: { type: "draft" } }) });
  const presigned = (await p.json()).data;
  if (!presigned) throw new Error("Presign failed");
  const uploaded = await fetch(presigned.upload.url, { method: "PUT", headers: presigned.upload.headers, body }); record("Presigned storage upload", uploaded.ok, uploaded.status);
  const completed = await request("/api/v1/files/complete", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ token: presigned.token }) });
  attachment = (await completed.json()).data; record("Upload completion persisted", Boolean(attachment?.id), completed.status);
  if (attachment?.id) { const link = await request(`/api/files/${attachment.id}`); const downloaded = await fetch(link.headers.get("location")); record("Authorized file download", downloaded.ok && await downloaded.text() === body, downloaded.status); }
} catch(e) { record(`Attachment flow: ${e.message}`, false); }
finally { if (attachment?.id) { const r = await request(`/api/v1/files/${attachment.id}`, { method: "DELETE", headers: { Origin: base } }); record("Acceptance attachment cleaned up", r.ok, r.status); } }
cookies.clear();
const customerCsrf = await (await request("/api/auth/csrf")).json();
const customerLogin = await request("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: base }, body: new URLSearchParams({ csrfToken: customerCsrf.csrfToken, email: "customer@demo.duoonex.test", password: credentials.password, json: "true", callbackUrl: `${base}/portal/tickets` }) });
const customerResult = await customerLogin.json(); record("Customer sign-in", customerLogin.ok && !customerResult.url?.includes("error="), customerLogin.status);
for (const path of ["/portal/tickets", "/portal/tickets/new", "/portal/knowledge"]) { const r = await request(path); record(`Customer ${path}`, r.status === 200, r.status); }
const staff = await request("/settings/security"); record("Customer redirected away from staff settings", [307, 303].includes(staff.status) && new URL(staff.headers.get("location"), base).pathname.startsWith("/portal"), staff.status);
const foreignTicket = await request("/api/v1/tickets/10001"); record("Customer cannot read employee ticket", foreignTicket.status === 404, foreignTicket.status);
const ownTicket = await request("/api/v1/tickets/10005"); const customerTicket = await ownTicket.json(); record("Customer ticket API exposes only public messages", ownTicket.status === 200 && Array.isArray(customerTicket.data?.messages) && customerTicket.data.messages.every(m => m.type === "PUBLIC"), ownTicket.status);
await mkdir(".data", { recursive: true }); await writeFile(".data/acceptance-report.json", JSON.stringify({ time: new Date().toISOString(), checks: report }, null, 2));
console.log(`${report.filter(r => r.passed).length}/${report.length} acceptance checks passed`);
process.exitCode = report.every(r => r.passed) ? 0 : 1;
