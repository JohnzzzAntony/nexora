import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db.ts";
import { addMessage, createTicket, updateTicket } from "../../src/server/tickets/service.ts";
import { requireTicket, ticketVisibilityWhere } from "../../src/server/tickets/access.ts";
import { makeOrg, expectError } from "./helpers.ts";

after(() => db.$disconnect());

test("ticket creation applies SLA, activity, audit and notifications", async () => {
  const { ctx, users } = await makeOrg();
  const employee = await ctx("employee");
  const t = await createTicket(employee, { subject: "Laptop will not boot", description: "<p>Black screen</p><script>alert(1)</script>" });
  const full = await db.ticket.findUniqueOrThrow({ where: { id: t.id }, include: { status: true } });
  assert.equal(full.status.key, "NEW");
  assert.ok(full.firstResponseDueAt && full.resolutionDueAt, "SLA due dates set");
  assert.ok(!full.description.includes("<script>"), "description sanitized");
  assert.equal(await db.sLAEvent.count({ where: { ticketId: t.id, type: "APPLIED" } }), 1);
  assert.equal(await db.auditLog.count({ where: { entityId: t.id, action: "ticket.created" } }), 1);
  assert.ok(await db.notification.count({ where: { userId: users.employee, entityId: t.id } }) >= 1, "requester notified");
});

test("organizations cannot see each other's tickets", async () => {
  const a = await makeOrg();
  const b = await makeOrg();
  const t = await createTicket(await a.ctx("employee"), { subject: "Org A secret ticket" });
  const outsider = await b.ctx("owner");
  await expectError(requireTicket(outsider, t.id), "TICKET_NOT_FOUND");
  await expectError(requireTicket(outsider, t.number), "TICKET_NOT_FOUND");
  const visible = await db.ticket.findMany({ where: await ticketVisibilityWhere(outsider) });
  assert.ok(visible.every(x => x.organizationId === b.org.id));
  await expectError(updateTicket(outsider, t.id, { subject: "hijacked" }), "TICKET_NOT_FOUND");
});

test("cross-tenant reference ids are rejected", async () => {
  const a = await makeOrg();
  const b = await makeOrg();
  const foreignTeam = await db.team.create({ data: { organizationId: b.org.id, name: "Foreign" } });
  await expectError(createTicket(await a.ctx("agent"), { subject: "Uses foreign team", teamId: foreignTeam.id }), "INVALID_REFERENCE");
});

test("employees only see their own tickets; agents need team scope", async () => {
  const { ctx } = await makeOrg();
  const t = await createTicket(await ctx("manager"), { subject: "Manager-only request" });
  await expectError(requireTicket(await ctx("employee"), t.id), "TICKET_NOT_FOUND");
  await expectError(requireTicket(await ctx("agent"), t.id), "TICKET_NOT_FOUND");
  assert.equal((await requireTicket(await ctx("admin"), t.id)).id, t.id);
});

test("RBAC: employees cannot assign or edit; agents cannot reassign others' tickets", async () => {
  const { ctx, users } = await makeOrg();
  const employee = await ctx("employee");
  await expectError(createTicket(employee, { subject: "Try to assign", assigneeId: users.agent }), "FORBIDDEN");
  const t = await createTicket(employee, { subject: "My printer" });
  await expectError(updateTicket(employee, t.id, { subject: "changed by requester" }), "FORBIDDEN");
  const manager = await ctx("manager");
  await updateTicket(manager, t.id, { assigneeId: users.manager });
  const agent = await ctx("agent");
  await db.ticketWatcher.create({ data: { ticketId: t.id, userId: users.agent } });
  await expectError(updateTicket(agent, t.id, { assigneeId: users.agent }), "FORBIDDEN");
});

test("customers never see internal notes and cannot write them", async () => {
  const { ctx } = await makeOrg();
  const customer = await ctx("customer");
  const agent = await ctx("admin");
  const t = await createTicket(customer, { subject: "Portal request" });
  await addMessage(agent, t.id, { type: "INTERNAL", bodyHtml: "<p>internal only</p>" });
  await addMessage(agent, t.id, { type: "PUBLIC", bodyHtml: "<p>public reply</p>" });
  await expectError(addMessage(customer, t.id, { type: "INTERNAL", bodyHtml: "<p>sneaky</p>" }), "FORBIDDEN");
  const other = await makeOrg();
  await expectError(requireTicket(await other.ctx("customer"), t.id), "TICKET_NOT_FOUND");
});

test("SLA pauses while waiting for customer and resumes on requester reply", async () => {
  const { ctx, org, users } = await makeOrg();
  const requester = await ctx("employee");
  const admin = await ctx("admin");
  const t = await createTicket(requester, { subject: "Needs info" });
  await updateTicket(admin, t.id, { assigneeId: users.admin });
  const waiting = await db.ticketStatus.findFirstOrThrow({ where: { organizationId: org.id, key: "WAITING_FOR_CUSTOMER" } });
  await updateTicket(admin, t.id, { statusId: waiting.id });
  let row = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
  assert.equal(row.slaState, "PAUSED");
  assert.ok(row.slaPausedAt);
  await addMessage(requester, t.id, { type: "PUBLIC", bodyHtml: "<p>Here is the info</p>" });
  const after2 = await db.ticket.findUniqueOrThrow({ where: { id: t.id }, include: { status: true } });
  assert.equal(after2.slaPausedAt, null);
  assert.equal(after2.status.category, "OPEN");
  assert.equal(await db.sLAEvent.count({ where: { ticketId: t.id, type: { in: ["PAUSED", "RESUMED"] } } }), 2);
});

test("status transitions are enforced and resolution records SLA", async () => {
  const { ctx, org, users } = await makeOrg();
  const admin = await ctx("admin");
  const t = await createTicket(admin, { subject: "Transition test", assigneeId: users.admin });
  const closed = await db.ticketStatus.findFirstOrThrow({ where: { organizationId: org.id, key: "CLOSED" } });
  const newStatus = await db.ticketStatus.findFirstOrThrow({ where: { organizationId: org.id, key: "NEW" } });
  await updateTicket(admin, t.id, { statusId: closed.id });
  await expectError(updateTicket(admin, t.id, { statusId: newStatus.id }), "INVALID_TRANSITION");
  const row = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
  assert.ok(row.resolvedAt && row.closedAt);
});

test("optimistic concurrency rejects stale versions", async () => {
  const { ctx } = await makeOrg();
  const admin = await ctx("admin");
  const t = await createTicket(admin, { subject: "Concurrency" });
  await updateTicket(admin, t.id, { subject: "First edit", version: t.version });
  await expectError(updateTicket(admin, t.id, { subject: "Stale edit", version: t.version }), "CONFLICT");
});
