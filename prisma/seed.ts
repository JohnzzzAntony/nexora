// DEVELOPMENT / DEMO DATA ONLY. Creates "Duoonex Demo Organization" through the real domain
// services (so SLA, activity, notifications and audit rows are genuine). Refuses to run in production.
//   npm run db:seed
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { createOrganization } from "../src/server/organizations/bootstrap";
import { loadContext } from "../src/lib/tenancy/load";
import { addMessage, createTicket, updateTicket } from "../src/server/tickets/service";
import { nextTaskNumber } from "../src/lib/automation/engine";

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "yes") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const ORG_NAME = "Duoonex Demo Organization";
const password = process.env.DEMO_PASSWORD || `Demo-${randomBytes(6).toString("base64url")}1`;

const PEOPLE = [
  { key: "owner", email: "owner@demo.duoonex.test", name: "Olivia Owner", role: "owner", superAdmin: true },
  { key: "admin", email: "admin@demo.duoonex.test", name: "Adam Admin", role: "admin" },
  { key: "manager", email: "manager@demo.duoonex.test", name: "Maya Manager", role: "manager", dept: "IT" },
  { key: "agent", email: "agent@demo.duoonex.test", name: "Sarah Agent", role: "agent", dept: "IT" },
  { key: "agent2", email: "mike@demo.duoonex.test", name: "Mike Network", role: "agent", dept: "IT" },
  { key: "hr", email: "hana@demo.duoonex.test", name: "Hana HR", role: "agent", dept: "HR" },
  { key: "employee", email: "employee@demo.duoonex.test", name: "John Smith", role: "employee", dept: "Operations" },
  { key: "customer", email: "customer@demo.duoonex.test", name: "Carla Customer", role: "customer" },
] as const;

async function main() {
  if (await db.organization.findFirst({ where: { name: ORG_NAME } })) {
    console.log(`"${ORG_NAME}" already exists — nothing to do. Reset the dev database to reseed.`);
    return;
  }
  const hash = await hashPassword(password);
  const users: Record<string, string> = {};
  for (const p of PEOPLE) {
    const u = await db.user.upsert({ where: { email: p.email }, update: {}, create: { email: p.email, name: p.name, passwordHash: hash, emailVerifiedAt: new Date(), isSuperAdmin: "superAdmin" in p } });
    users[p.key] = u.id;
  }
  const { organization: org, roles } = await createOrganization({ name: ORG_NAME, ownerId: users.owner, timezone: "Asia/Dubai" });
  await db.organization.update({ where: { id: org.id }, data: { onboardingDoneAt: new Date(), onboardingStep: 8, plan: "BUSINESS" } });
  await db.organizationSettings.update({ where: { organizationId: org.id }, data: { supportEmail: "support@demo.duoonex.test" } });

  const depts: Record<string, string> = {};
  for (const name of ["IT", "HR", "Finance", "Operations", "Procurement"]) depts[name] = (await db.department.create({ data: { organizationId: org.id, name, code: name.slice(0, 3).toUpperCase() } })).id;
  await db.department.update({ where: { id: depts.IT }, data: { managerId: users.manager } });

  const uae = await db.location.create({ data: { organizationId: org.id, name: "UAE", type: "Country" } });
  const dubai = await db.location.create({ data: { organizationId: org.id, name: "Dubai", type: "City", parentId: uae.id } });
  const office = await db.location.create({ data: { organizationId: org.id, name: "Office", type: "Office", parentId: dubai.id } });
  const store = await db.location.create({ data: { organizationId: org.id, name: "Store 12", type: "Store", parentId: dubai.id } });
  await db.location.create({ data: { organizationId: org.id, name: "Warehouse", type: "Warehouse", parentId: dubai.id } });
  for (const name of ["Abu Dhabi", "Sharjah"]) await db.location.create({ data: { organizationId: org.id, name, type: "City", parentId: uae.id } });

  const customer = await db.customer.create({ data: { organizationId: org.id, name: "Carla Customer", company: "Acme Retail LLC", email: "customer@demo.duoonex.test", phone: "+971 4 000 0000", locationId: dubai.id, tags: ["retail", "priority"] } });
  await db.customerContact.create({ data: { customerId: customer.id, name: "Carla Customer", email: "customer@demo.duoonex.test", isPrimary: true, userId: users.customer } });

  for (const p of PEOPLE) {
    if (p.key === "owner") continue;
    await db.membership.create({ data: { organizationId: org.id, userId: users[p.key], roleId: roles[p.role], departmentId: "dept" in p ? depts[p.dept] : null, locationId: office.id, customerId: p.role === "customer" ? customer.id : null } });
  }

  const teamDefs = [
    { name: "IT Support", dept: "IT", leader: "manager", members: ["manager", "agent", "agent2"], skills: ["hardware", "software", "access"] },
    { name: "Infrastructure", dept: "IT", leader: "agent2", members: ["agent2"], skills: ["network", "servers"] },
    { name: "HR Support", dept: "HR", leader: "hr", members: ["hr"], skills: ["payroll", "onboarding"] },
    { name: "Finance Support", dept: "Finance", leader: "admin", members: ["admin"], skills: ["invoices"] },
  ];
  const teams: Record<string, string> = {};
  for (const t of teamDefs) {
    teams[t.name] = (await db.team.create({ data: { organizationId: org.id, name: t.name, departmentId: depts[t.dept], leaderId: users[t.leader], skills: t.skills, members: { create: t.members.map(k => ({ userId: users[k], isLead: k === t.leader })) } } })).id;
  }
  const cats = await db.ticketCategory.findMany({ where: { organizationId: org.id } });
  const cat = (name: string) => cats.find(c => c.name === name)!.id;
  await db.ticketCategory.update({ where: { id: cat("Network") }, data: { defaultTeamId: teams.Infrastructure } });
  for (const n of ["Hardware", "Software", "Access"]) await db.ticketCategory.update({ where: { id: cat(n) }, data: { defaultTeamId: teams["IT Support"] } });
  await db.ticketCategory.update({ where: { id: cat("HR") }, data: { defaultTeamId: teams["HR Support"] } });

  const assetDefs = [
    { type: "PRINTER", name: "HP LaserJet Pro M404", manufacturer: "HP", model: "M404dn", location: store.id },
    { type: "LAPTOP", name: "Dell Latitude 7440", manufacturer: "Dell", model: "7440", user: "employee" },
    { type: "ROUTER", name: "Cisco Edge Router", manufacturer: "Cisco", model: "ISR 1100", location: office.id },
    { type: "POS", name: "Store 12 POS Terminal", manufacturer: "Verifone", model: "V400m", location: store.id },
  ] as const;
  const assets: string[] = [];
  for (const [i, a] of assetDefs.entries()) {
    const seq = (await db.organization.update({ where: { id: org.id }, data: { assetSeq: { increment: 1 } } })).assetSeq;
    const asset = await db.asset.create({ data: { organizationId: org.id, assetTag: `AST-${String(seq).padStart(4, "0")}`, name: a.name, type: a.type, manufacturer: a.manufacturer, model: a.model, serialNumber: `SN-DEMO-${1000 + i}`, status: "user" in a ? "ASSIGNED" : "AVAILABLE", assignedToId: "user" in a ? users[a.user] : null, locationId: "location" in a ? a.location : office.id, departmentId: depts.IT, purchaseDate: new Date("2025-03-01"), warrantyExpiry: new Date("2028-03-01") } });
    if ("user" in a) await db.assetAssignment.create({ data: { assetId: asset.id, userId: users[a.user] } });
    await db.assetHistory.create({ data: { assetId: asset.id, type: "created", summary: "Asset registered (demo data)", actorId: users.admin } });
    assets.push(asset.id);
  }

  const kb = await db.knowledgeCategory.findFirstOrThrow({ where: { organizationId: org.id } });
  await db.knowledgeArticle.createMany({ data: [
    { organizationId: org.id, categoryId: kb.id, title: "How to connect to the office VPN", slug: "connect-to-office-vpn", contentHtml: "<p>Install the VPN client from the self-service portal, sign in with your work account and choose the <strong>Dubai Office</strong> gateway.</p><ol><li>Open the client</li><li>Select the gateway</li><li>Approve the MFA prompt</li></ol>", excerpt: "Step-by-step VPN setup.", status: "PUBLISHED", visibility: "PUBLIC", tags: ["vpn", "network"], authorId: users.agent2, publishedAt: new Date() },
    { organizationId: org.id, categoryId: kb.id, title: "Resetting your password", slug: "reset-password", contentHtml: "<p>Use <em>Forgot password</em> on the sign-in page. Links expire after one hour.</p>", excerpt: "Self-service password reset.", status: "PUBLISHED", visibility: "PUBLIC", tags: ["access"], authorId: users.agent, publishedAt: new Date() },
    { organizationId: org.id, categoryId: kb.id, title: "Printer troubleshooting runbook (internal)", slug: "printer-runbook", contentHtml: "<p>Check toner, clear the queue on the print server, then power-cycle.</p>", status: "PUBLISHED", visibility: "INTERNAL", tags: ["printer"], authorId: users.agent, publishedAt: new Date() },
  ] });

  const project = await db.project.create({ data: { organizationId: org.id, key: "NET", name: "Network refresh 2026", description: "Replace store routers and upgrade Wi-Fi.", managerId: users.manager, status: "ACTIVE", priority: "HIGH", startDate: new Date(), endDate: new Date(Date.now() + 60 * 86400_000), budget: 25000, members: { create: [{ userId: users.manager, role: "manager" }, { userId: users.agent2 }] }, milestones: { create: [{ name: "Survey stores", dueDate: new Date(Date.now() + 14 * 86400_000), order: 1 }, { name: "Router rollout", dueDate: new Date(Date.now() + 45 * 86400_000), order: 2 }] } } });

  await db.automationRule.create({ data: { organizationId: org.id, name: "Route network issues to Infrastructure", trigger: "ticket.created", conditions: { operator: "AND", conditions: [{ field: "category", op: "equals", value: cat("Network") }] }, actions: [{ type: "assign_team", teamId: teams.Infrastructure }, { type: "set_priority", priorityKey: "HIGH" }, { type: "send_notification", to: "team", message: "New network ticket routed to Infrastructure" }] } });

  const ctx = async (key: string) => (await loadContext(users[key], org.id))!;
  const employee = await ctx("employee");
  const agent = await ctx("agent");
  const manager = await ctx("manager");
  const cust = await ctx("customer");
  const pr = await db.ticketPriority.findMany({ where: { organizationId: org.id } });
  const pri = (k: string) => pr.find(p => p.key === k)!.id;
  const sub = (parent: string, name: string) => cats.find(c => c.parentId === cat(parent) && c.name === name)!.id;

  const t1 = await createTicket(employee, { subject: "Printer not working at Store 12", description: "<p>The printer shows <strong>Error 49</strong> and will not print receipts.</p>", categoryId: cat("Hardware"), subcategoryId: sub("Hardware", "Printer"), locationId: store.id });
  await updateTicket(manager, t1.number, { assigneeId: users.agent, priorityId: pri("HIGH") });
  await db.ticketAsset.create({ data: { ticketId: t1.id, assetId: assets[0] } });
  await addMessage(agent, t1.number, { type: "PUBLIC", bodyHtml: "<p>Thanks John — I'm heading to Store 12 this afternoon.</p>" });
  await addMessage(agent, t1.number, { type: "INTERNAL", bodyHtml: "<p>Likely fuser failure; spare unit in the warehouse.</p>" });

  const t2 = await createTicket(employee, { subject: "VPN unavailable from home", description: "<p>VPN client times out since this morning.</p>", categoryId: cat("Network"), subcategoryId: sub("Network", "VPN") });
  await createTicket(employee, { subject: "New laptop request for onboarding", description: "<p>New hire starts next Monday.</p>", categoryId: cat("Hardware"), subcategoryId: sub("Hardware", "Laptop"), tags: ["onboarding"] });
  const t4 = await createTicket(employee, { subject: "Payroll question about overtime", description: "<p>Overtime from September is missing.</p>", categoryId: cat("HR") });
  await updateTicket(await ctx("hr"), t4.number, { assigneeId: users.hr });
  const t5 = await createTicket(cust, { subject: "Receipt printer paper jam", description: "<p>Our POS printer keeps jamming.</p>", categoryId: cat("Hardware") });
  await updateTicket(manager, t5.number, { assigneeId: users.agent });
  await addMessage(agent, t5.number, { type: "PUBLIC", bodyHtml: "<p>Could you send a photo of the paper path?</p>" });
  const waiting = await db.ticketStatus.findFirstOrThrow({ where: { organizationId: org.id, key: "WAITING_FOR_CUSTOMER" } });
  await updateTicket(agent, t5.number, { statusId: waiting.id });
  const resolved = await db.ticketStatus.findFirstOrThrow({ where: { organizationId: org.id, key: "RESOLVED" } });
  const t6 = await createTicket(employee, { subject: "Outlook keeps asking for password", description: "<p>Prompt appears every hour.</p>", categoryId: cat("Software"), subcategoryId: sub("Software", "Microsoft 365") });
  await updateTicket(manager, t6.number, { assigneeId: users.agent });
  await addMessage(agent, t6.number, { type: "PUBLIC", bodyHtml: "<p>Cleared cached credentials — please confirm it's fixed.</p>" });
  await updateTicket(agent, t6.number, { statusId: resolved.id });

  const tasks = [
    { title: "Replace printer fuser at Store 12", ticketId: t1.id, assignee: "agent", status: "IN_PROGRESS", priority: "HIGH", due: 1 },
    { title: "Check VPN gateway certificates", ticketId: t2.id, assignee: "agent2", status: "ASSIGNED", priority: "CRITICAL", due: 0 },
    { title: "Survey Store 12 network", projectId: project.id, assignee: "agent2", status: "TODO", priority: "MEDIUM", due: 7 },
    { title: "Order replacement routers", projectId: project.id, assignee: "manager", status: "REVIEW", priority: "HIGH", due: 10 },
    { title: "Prepare onboarding laptop image", assignee: "agent", status: "COMPLETED", priority: "LOW", due: -2 },
  ] as const;
  for (const [i, t] of tasks.entries()) {
    await db.task.create({ data: {
      organizationId: org.id, number: await nextTaskNumber(db, org.id), title: t.title, status: t.status, priority: t.priority,
      ticketId: "ticketId" in t ? t.ticketId : null, projectId: "projectId" in t ? t.projectId : null, assigneeId: users[t.assignee], createdById: users.manager,
      dueDate: new Date(Date.now() + t.due * 86400_000), position: i, completedAt: t.status === "COMPLETED" ? new Date() : null,
      checklist: { create: [{ title: "Investigate", done: true, order: 0 }, { title: "Fix", done: t.status === "COMPLETED", order: 1 }] },
    } });
  }

  mkdirSync(".data", { recursive: true });
  writeFileSync(".data/demo-credentials.json", JSON.stringify({ organization: ORG_NAME, password, users: PEOPLE.map(p => ({ email: p.email, role: p.role })) }, null, 2));
  console.log(`Seeded "${ORG_NAME}" (development data). Accounts share the password stored in .data/demo-credentials.json`);
}

main().then(() => db.$disconnect()).catch(async e => { console.error(e); await db.$disconnect(); process.exit(1); });
