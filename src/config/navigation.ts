import type { Permission } from "@/lib/permissions/catalog";

// Single source for app navigation. Items render only when the user holds one of `anyOf`
// (empty = every internal member). Every href here must be a real route.
export type NavItem = { title: string; href: string; icon: string; anyOf?: Permission[] };
export type NavSection = { title: string; items: NavItem[] };

export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { title: "Tickets", href: "/tickets", icon: "ticket", anyOf: ["tickets.view", "tickets.view_team", "tickets.view_all"] },
  { title: "My Work", href: "/my-work", icon: "briefcase" },
  { title: "Tasks", href: "/tasks", icon: "list-checks", anyOf: ["tasks.view"] },
  { title: "Projects", href: "/projects", icon: "folder-kanban", anyOf: ["projects.view"] },
  { title: "Teams", href: "/teams", icon: "users-round", anyOf: ["users.view"] },
  { title: "Customers", href: "/customers", icon: "building-2", anyOf: ["customers.view"] },
  { title: "Assets", href: "/assets", icon: "monitor-smartphone", anyOf: ["assets.view"] },
  { title: "Knowledge Base", href: "/knowledge", icon: "book-open", anyOf: ["knowledge.view"] },
  { title: "Approvals", href: "/approvals", icon: "stamp" },
  { title: "Reports", href: "/reports", icon: "chart-column", anyOf: ["reports.view"] },
  { title: "Notifications", href: "/notifications", icon: "bell" },
];

export const SECONDARY_NAV: NavItem[] = [
  { title: "Settings", href: "/settings", icon: "settings", anyOf: ["settings.view", "settings.manage"] },
  { title: "Help", href: "/help", icon: "life-buoy" },
  { title: "Profile", href: "/profile", icon: "circle-user" },
];

export const SETTINGS_NAV: NavSection[] = [
  { title: "General", items: [
    { title: "Organization", href: "/settings/organization", icon: "building", anyOf: ["settings.view"] },
    { title: "Users", href: "/settings/users", icon: "users", anyOf: ["users.view"] },
    { title: "Roles & Permissions", href: "/settings/roles", icon: "shield-check", anyOf: ["roles.manage"] },
    { title: "Teams", href: "/settings/teams", icon: "users-round", anyOf: ["teams.manage"] },
    { title: "Departments", href: "/settings/departments", icon: "network", anyOf: ["teams.manage"] },
    { title: "Locations", href: "/settings/locations", icon: "map-pin", anyOf: ["teams.manage"] },
  ] },
  { title: "Ticket Management", items: [
    { title: "Categories", href: "/settings/categories", icon: "folder-tree", anyOf: ["settings.manage"] },
    { title: "Priorities", href: "/settings/priorities", icon: "signal", anyOf: ["settings.manage"] },
    { title: "Statuses", href: "/settings/statuses", icon: "circle-dot", anyOf: ["settings.manage"] },
    { title: "Forms", href: "/settings/forms", icon: "clipboard-list", anyOf: ["settings.manage"] },
    { title: "Custom Fields", href: "/settings/custom-fields", icon: "text-cursor-input", anyOf: ["settings.manage"] },
    { title: "Templates", href: "/settings/templates", icon: "file-text", anyOf: ["settings.manage"] },
  ] },
  { title: "Workflow", items: [
    { title: "Automations", href: "/settings/automations", icon: "workflow", anyOf: ["automation.manage"] },
  ] },
  { title: "SLA", items: [
    { title: "SLA Policies", href: "/settings/sla", icon: "timer", anyOf: ["sla.manage"] },
    { title: "Business Hours", href: "/settings/business-hours", icon: "clock", anyOf: ["sla.manage"] },
    { title: "Holidays", href: "/settings/holidays", icon: "calendar-off", anyOf: ["sla.manage"] },
  ] },
  { title: "Notifications", items: [
    { title: "Email", href: "/settings/email", icon: "mail", anyOf: ["settings.manage"] },
    { title: "Email Templates", href: "/settings/email-templates", icon: "mail-plus", anyOf: ["settings.manage"] },
  ] },
  { title: "Integrations", items: [
    { title: "Integrations", href: "/settings/integrations", icon: "plug", anyOf: ["integrations.manage"] },
    { title: "API Keys", href: "/settings/api", icon: "key-round", anyOf: ["integrations.manage"] },
    { title: "Webhooks", href: "/settings/webhooks", icon: "webhook", anyOf: ["integrations.manage"] },
  ] },
  { title: "Organization", items: [
    { title: "Branding", href: "/settings/branding", icon: "palette", anyOf: ["settings.manage"] },
    { title: "Security", href: "/settings/security", icon: "lock", anyOf: ["settings.manage"] },
    { title: "Audit Logs", href: "/settings/audit-logs", icon: "scroll-text", anyOf: ["audit.view"] },
    { title: "Billing", href: "/settings/billing", icon: "credit-card", anyOf: ["billing.manage"] },
  ] },
];
