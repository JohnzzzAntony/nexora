import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db.ts";
import { getLookups } from "../../src/server/lookups/service.ts";
import { makeOrg } from "./helpers.ts";

after(() => db.$disconnect());

test("category grouping preserves order, active filtering and tenant boundaries", async () => {
  const a = await makeOrg();
  const b = await makeOrg();
  const parent = await db.ticketCategory.create({ data: { organizationId: a.org.id, name: "Grouping parent" } });
  await db.ticketCategory.createMany({ data: [
    { organizationId: a.org.id, parentId: parent.id, name: "Zulu child" },
    { organizationId: a.org.id, parentId: parent.id, name: "Alpha child" },
    { organizationId: a.org.id, parentId: parent.id, name: "Inactive child", isActive: false },
    { organizationId: b.org.id, name: "Foreign category" },
  ] });
  const lookups = await getLookups(await a.ctx("owner"));
  const grouped = lookups.categories.find(category => category.id === parent.id);
  assert.deepEqual(grouped?.children.map(category => category.name), ["Alpha child", "Zulu child"]);
  assert.ok(lookups.categories.every(category => category.name !== "Foreign category"));
  assert.ok(lookups.categories.every(category => !category.parentId));
});

test("customer lookups continue to exclude internal teams and departments", async () => {
  const a = await makeOrg();
  await db.team.create({ data: { organizationId: a.org.id, name: "Internal team" } });
  await db.department.create({ data: { organizationId: a.org.id, name: "Internal department" } });
  const customer = await getLookups(await a.ctx("customer"));
  assert.deepEqual(customer.teams, []);
  assert.deepEqual(customer.departments, []);
  assert.ok((await getLookups(await a.ctx("owner"))).teams.length > 0);
});
