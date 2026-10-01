// Source of truth for permission keys. Roles grant these keys via RolePermission rows.
// Safe to import from client components (no server dependencies).

export const PERMISSION_GROUPS = {
  Tickets: {
    "tickets.view": "View own and requested tickets",
    "tickets.view_team": "View tickets of own teams and department",
    "tickets.view_all": "View all organization tickets",
    "tickets.create": "Create tickets",
    "tickets.edit": "Edit ticket details",
    "tickets.delete": "Delete tickets",
    "tickets.assign": "Assign tickets",
    "tickets.reassign": "Reassign tickets owned by others",
    "tickets.close": "Resolve, close and reopen tickets",
    "tickets.internal_notes": "Read and write internal notes",
    "tickets.merge": "Merge and split tickets",
    "tickets.export": "Export tickets",
  },
  Tasks: {
    "tasks.view": "View tasks",
    "tasks.create": "Create tasks",
    "tasks.edit": "Edit tasks",
    "tasks.delete": "Delete tasks",
    "tasks.assign": "Assign tasks",
  },
  Projects: {
    "projects.view": "View projects",
    "projects.manage": "Create, edit and delete projects",
  },
  People: {
    "users.view": "View users",
    "users.create": "Invite users",
    "users.edit": "Edit users and memberships",
    "users.delete": "Deactivate users",
    "teams.manage": "Manage teams, departments and locations",
    "customers.view": "View customers",
    "customers.manage": "Create and edit customers",
  },
  Operations: {
    "assets.view": "View assets",
    "assets.manage": "Manage assets",
    "knowledge.view": "Read internal knowledge base",
    "knowledge.manage": "Write and publish knowledge articles",
    "approvals.manage": "Create approval requests",
  },
  Insights: {
    "reports.view": "View reports",
    "reports.export": "Export reports",
    "audit.view": "View audit logs",
  },
  Administration: {
    "settings.view": "View settings",
    "settings.manage": "Manage organization settings",
    "roles.manage": "Manage roles and permissions",
    "sla.manage": "Manage SLA policies, business hours and holidays",
    "automation.manage": "Manage automation rules",
    "integrations.manage": "Manage integrations, webhooks and API keys",
    "billing.manage": "Manage billing",
  },
} as const;

type Groups = typeof PERMISSION_GROUPS;
export type Permission = { [G in keyof Groups]: keyof Groups[G] }[keyof Groups] & string;

export const ALL_PERMISSIONS = Object.values(PERMISSION_GROUPS).flatMap(g => Object.keys(g)) as Permission[];


const AGENT: Permission[] = [
  "tickets.view", "tickets.view_team", "tickets.create", "tickets.edit", "tickets.assign", "tickets.close",
  "tickets.internal_notes", "tickets.export",
  "tasks.view", "tasks.create", "tasks.edit", "tasks.assign",
  "projects.view", "users.view", "customers.view", "customers.manage",
  "assets.view", "knowledge.view", "knowledge.manage", "approvals.manage", "reports.view",
];

const MANAGER: Permission[] = [
  ...AGENT, "tickets.view_all", "tickets.reassign", "tickets.merge", "tickets.delete", "tasks.delete",
  "projects.manage", "assets.manage", "reports.export", "users.create", "teams.manage", "settings.view",
];

const ADMIN: Permission[] = ALL_PERMISSIONS.filter(p => p !== "billing.manage");

export const SYSTEM_ROLES: { key: string; name: string; description: string; permissions: Permission[] }[] = [
  { key: "owner", name: "Organization Owner", description: "Full access including billing and ownership.", permissions: ALL_PERMISSIONS },
  { key: "admin", name: "Organization Admin", description: "Manages settings, users and all work.", permissions: ADMIN },
  { key: "manager", name: "Manager", description: "Oversees teams, reassigns work and reads reports.", permissions: MANAGER },
  { key: "agent", name: "Agent", description: "Works tickets and tasks for their teams.", permissions: AGENT },
  { key: "employee", name: "Employee", description: "Raises requests and follows their own work.", permissions: ["tickets.view", "tickets.create", "tasks.view", "knowledge.view", "projects.view"] },
  { key: "customer", name: "Customer", description: "External requester using the customer portal.", permissions: ["tickets.view", "tickets.create"] },
];

export const CUSTOMER_ROLE_KEY = "customer";
export const OWNER_ROLE_KEY = "owner";
