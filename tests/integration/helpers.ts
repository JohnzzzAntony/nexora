import { randomBytes } from "node:crypto";
import { db } from "../../src/lib/db.ts";
import { createOrganization } from "../../src/server/organizations/bootstrap.ts";
import { loadContext } from "../../src/lib/tenancy/load.ts";

export const uid = () => randomBytes(5).toString("hex");

/** Creates an isolated organization with one user per role. */
export async function makeOrg(name = `Test Org ${uid()}`) {
  const mk = (role: string) => db.user.create({ data: { email: `${role}.${uid()}@test.duoonex.test`, name: `${role} ${uid()}`, passwordHash: "x" } });
  const owner = await mk("owner");
  const { organization, roles } = await createOrganization({ name, ownerId: owner.id, timezone: "UTC" });
  const users: Record<string, string> = { owner: owner.id };
  for (const role of ["admin", "manager", "agent", "employee", "customer"]) {
    const u = await mk(role);
    users[role] = u.id;
    await db.membership.create({ data: { organizationId: organization.id, userId: u.id, roleId: roles[role] } });
  }
  const ctx = async (role: string) => (await loadContext(users[role], organization.id))!;
  return { org: organization, users, roles, ctx };
}

export async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e) {
    const got = (e as { code?: string }).code;
    if (got !== code) throw new Error(`Expected error ${code}, got ${got}: ${(e as Error).message}`);
    return;
  }
  throw new Error(`Expected error ${code}, but the call succeeded`);
}
