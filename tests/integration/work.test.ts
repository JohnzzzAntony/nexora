import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db.ts";
import { saveResource, listResources } from "../../src/server/work/resources.ts";
import { saveSettings, controlSetting } from "../../src/server/work/settings.ts";
import { requestApproval, decideApproval } from "../../src/server/work/approvals.ts";
import { globalSearch } from "../../src/server/search/service.ts";
import { workTool } from "../../src/server/work/tools.ts";
import { makeOrg, expectError } from "./helpers.ts";
after(() => db.$disconnect());
const task = { title: "Private maintenance work", description: "", status: "TODO", priority: "MEDIUM" };
test("resource mutations and references stay inside tenant", async () => {
  const a = await makeOrg(), b = await makeOrg(); const owner = await a.ctx("owner");
  const p = await saveResource(await b.ctx("owner"), "projects", { name: "Foreign project", key: "FOREIGN", description: "", status: "ACTIVE", priority: "MEDIUM" });
  await expectError(saveResource(owner, "tasks", { ...task, projectId: p.id }), "INVALID_REFERENCE");
  await expectError(saveResource(await a.ctx("employee"), "tasks", task), "FORBIDDEN");
  const own = await saveResource(owner, "tasks", { ...task, assigneeId: a.users.employee });
  assert.equal((await listResources(await a.ctx("employee"), "tasks", "", own.id)).length, 1);
  assert.equal((await listResources(await b.ctx("owner"), "tasks", "", own.id)).length, 0);
});
test("employee task search never exposes other employees' tasks", async () => {
  const a = await makeOrg(); await saveResource(await a.ctx("owner"), "tasks", { ...task, assigneeId: a.users.manager });
  const ctx = await a.ctx("employee"); assert.equal((await listResources(ctx, "tasks")).length, 0); assert.equal((await globalSearch(ctx, "Private maintenance")).groups.tasks.length, 0);
});
test("cannot complete tasks with incomplete dependencies", async () => {
  const a = await makeOrg(); const ctx = await a.ctx("owner"); const first = await saveResource(ctx, "tasks", task); const second = await saveResource(ctx, "tasks", { ...task, title: "Dependent" });
  await db.taskDependency.create({ data: { taskId: second.id, dependsOnId: first.id } });
  await expectError(saveResource(ctx, "tasks", { ...task, status: "COMPLETED" }, second.id), "DEPENDENCY_INCOMPLETE");
});
test("only designated approver can decide a pending request, once", async () => {
  const a = await makeOrg(); const owner = await a.ctx("owner"), manager = await a.ctx("manager");
  const approval = await requestApproval(owner, { title: "Buy replacement laptop", approverId: a.users.manager });
  await expectError(decideApproval(owner, approval.id, { decision: "APPROVED" }), "FORBIDDEN");
  await decideApproval(manager, approval.id, { decision: "APPROVED", comment: "Approved budget" });
  assert.equal((await db.approval.findUniqueOrThrow({ where: { id: approval.id } })).status, "APPROVED");
  await expectError(decideApproval(manager, approval.id, { decision: "REJECTED" }), "NOT_FOUND");
});
test("custom roles and API keys cannot escalate permissions", async () => {
  const a = await makeOrg(); const ctx = await a.ctx("admin");
  await expectError(saveSettings(ctx, "roles", { name: "Escalation", key: "escalation", permissions: ["billing.manage"] }), "FORBIDDEN");
  await expectError(saveSettings(ctx, "api", { name: "Escalation key", permissions: ["billing.manage"] }), "FORBIDDEN");
  const key = await saveSettings(ctx, "api", { name: "Read tickets", permissions: ["tickets.view"] });
  assert.ok(key.secret?.startsWith("dx_")); const stored = await db.apiKey.findUniqueOrThrow({ where: { id: key.id } }); assert.deepEqual(stored.scopes, ["tickets.view"]); assert.notEqual(stored.keyHash, key.secret);
});

test("assigned employees can track work but cannot modify another employee's task", async () => {
  const a = await makeOrg(); const owner = await a.ctx("owner"), employee = await a.ctx("employee");
  const own = await saveResource(owner, "tasks", { ...task, assigneeId: a.users.employee });
  const other = await saveResource(owner, "tasks", { ...task, assigneeId: a.users.manager });
  await workTool(owner, "tasks", own.id, { action: "checklist", title: "Verify fix" });
  const item = await db.taskChecklistItem.findFirstOrThrow({ where: { taskId: own.id } });
  await workTool(employee, "tasks", own.id, { action: "toggle", itemId: item.id });
  await workTool(employee, "tasks", own.id, { action: "status", status: "IN_PROGRESS" });
  await workTool(employee, "tasks", own.id, { action: "time", minutes: 25, note: "Investigated" });
  await workTool(employee, "tasks", own.id, { action: "comment", comment: "<script>unsafe</script>" });
  assert.equal((await db.task.findUniqueOrThrow({ where: { id: own.id } })).status, "IN_PROGRESS");
  assert.equal((await db.taskChecklistItem.findUniqueOrThrow({ where: { id: item.id } })).done, true);
  assert.equal((await db.timeEntry.findFirstOrThrow({ where: { taskId: own.id } })).minutes, 25);
  assert.ok((await db.taskComment.findFirstOrThrow({ where: { taskId: own.id } })).bodyHtml.includes("&lt;script&gt;"));
  await expectError(workTool(employee, "tasks", other.id, { action: "status", status: "COMPLETED" }), "NOT_FOUND");
  await expectError(workTool(employee, "tasks", own.id, { action: "checklist", title: "Unauthorized change" }), "FORBIDDEN");
});

test("setting controls are tenant-scoped and default SLA targets remain intact", async () => {
  const a = await makeOrg(), b = await makeOrg(); const owner = await a.ctx("owner");
  const p = await saveSettings(owner, "sla", { name: "Fast response", firstResponseMinutes: 30, resolutionMinutes: 240, isActive: true });
  await expectError(controlSetting(await b.ctx("owner"), "sla", p.id, "default"), "NOT_FOUND");
  await controlSetting(owner, "sla", p.id, "default");
  assert.equal(await db.sLAPolicy.count({ where: { organizationId: a.org.id, isDefault: true } }), 1);
  assert.equal((await db.sLATarget.findFirstOrThrow({ where: { policyId: p.id } })).firstResponseMinutes, 30);
  await expectError(controlSetting(owner, "sla", p.id, "toggle"), "VALIDATION_ERROR");
  const key = await saveSettings(owner, "api", { name: "Temporary", permissions: ["tickets.view"] });
  await controlSetting(owner, "api", key.id, "revoke");
  assert.ok((await db.apiKey.findUniqueOrThrow({ where: { id: key.id } })).revokedAt);
});
