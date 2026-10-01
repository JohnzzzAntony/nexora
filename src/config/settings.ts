import type { Permission } from "@/lib/permissions/catalog";
export type SettingField = {
  key: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "number"
    | "textarea"
    | "checkbox"
    | "date"
    | "time";
  options?: { id: string; name: string }[];
  lookup?: string;
  required?: boolean;
};
export type SettingSection = {
  title: string;
  permission: Permission;
  fields: SettingField[];
  singleton?: boolean;
};
const name = { key: "name", label: "Name", required: true };
const key = { key: "key", label: "Code", required: true };
export const SETTINGS: Record<string, SettingSection> = {
  organization: {
    title: "Organization",
    permission: "settings.manage",
    singleton: true,
    fields: [
      name,
      { key: "timezone", label: "Timezone", required: true },
      { key: "supportEmail", label: "Support email", type: "email" },
      {
        key: "portalEnabled",
        label: "Enable customer portal",
        type: "checkbox",
      },
    ],
  },
  branding: {
    title: "Branding",
    permission: "settings.manage",
    singleton: true,
    fields: [
      { key: "logoUrl", label: "Logo URL" },
      { key: "primaryColor", label: "Brand color (hex)" },
      { key: "loginMessage", label: "Welcome message", type: "textarea" },
    ],
  },
  security: {
    title: "Security",
    permission: "settings.manage",
    singleton: true,
    fields: [
      {
        key: "requireEmailVerification",
        label: "Require email verification",
        type: "checkbox",
      },
      {
        key: "sessionTimeoutHours",
        label: "Session lifetime (hours)",
        type: "number",
      },
      { key: "maxUploadMb", label: "Upload limit (MB)", type: "number" },
      {
        key: "allowZipUploads",
        label: "Allow ZIP attachments",
        type: "checkbox",
      },
      {
        key: "customerSeesOrgTickets",
        label: "Customers can view their company's tickets",
        type: "checkbox",
      },
    ],
  },
  categories: {
    title: "Categories",
    permission: "settings.manage",
    fields: [
      name,
      { key: "description", label: "Description", type: "textarea" },
      { key: "defaultTeamId", label: "Default team", lookup: "teams" },
      { key: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  priorities: {
    title: "Priorities",
    permission: "settings.manage",
    fields: [
      name,
      key,
      { key: "color", label: "Color (hex)" },
      { key: "order", label: "Display order", type: "number" },
    ],
  },
  statuses: {
    title: "Statuses",
    permission: "settings.manage",
    fields: [
      name,
      key,
      {
        key: "category",
        label: "Category",
        options: ["NEW", "OPEN", "PENDING", "RESOLVED", "CLOSED"].map((id) => ({
          id,
          name: id,
        })),
      },
      { key: "color", label: "Color (hex)" },
      { key: "pausesSla", label: "Pause SLA", type: "checkbox" },
      { key: "isActive", label: "Active", type: "checkbox" },
      {
        key: "allowedTransitions",
        label: "Allowed next status codes (comma separated)",
      },
    ],
  },
  templates: {
    title: "Ticket templates",
    permission: "settings.manage",
    fields: [
      name,
      { key: "subject", label: "Subject", required: true },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  "custom-fields": {
    title: "Custom fields",
    permission: "settings.manage",
    fields: [
      { key: "label", label: "Label", required: true },
      key,
      { key: "helpText", label: "Help text" },
      { key: "required", label: "Required", type: "checkbox" },
      { key: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  forms: {
    title: "Ticket forms",
    permission: "settings.manage",
    fields: [
      name,
      { key: "description", label: "Description", type: "textarea" },
      { key: "categoryId", label: "Category", lookup: "categories" },
      { key: "fieldIds", label: "Custom fields", lookup: "customFields" },
      { key: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  automations: {
    title: "Automations",
    permission: "automation.manage",
    fields: [
      name,
      {
        key: "trigger",
        label: "When",
        options: [
          "ticket.created",
          "ticket.updated",
          "ticket.replied",
          "sla.breached",
        ].map((id) => ({ id, name: id.replaceAll(".", " ") })),
      },
      { key: "contains", label: "Subject contains" },
      {
        key: "teamId",
        label: "Assign to team",
        lookup: "teams",
        required: true,
      },
      { key: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  sla: {
    title: "SLA policies",
    permission: "sla.manage",
    fields: [
      name,
      {
        key: "businessHoursId",
        label: "Business hours",
        lookup: "businessHours",
      },
      {
        key: "firstResponseMinutes",
        label: "First response target (minutes)",
        type: "number",
        required: true,
      },
      {
        key: "resolutionMinutes",
        label: "Resolution target (minutes)",
        type: "number",
        required: true,
      },
      { key: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  "business-hours": {
    title: "Business hours",
    permission: "sla.manage",
    fields: [
      name,
      { key: "timezone", label: "Timezone", required: true },
      { key: "start", label: "Weekday opening", type: "time", required: true },
      { key: "end", label: "Weekday closing", type: "time", required: true },
    ],
  },
  holidays: {
    title: "Holidays",
    permission: "sla.manage",
    fields: [
      name,
      { key: "date", label: "Date", type: "date", required: true },
      { key: "recurring", label: "Repeat yearly", type: "checkbox" },
    ],
  },
  roles: {
    title: "Roles & permissions",
    permission: "roles.manage",
    fields: [name, key],
  },
  users: {
    title: "Users",
    permission: "users.create",
    fields: [
      { key: "email", label: "Invite email", type: "email", required: true },
      { key: "roleId", label: "Role", lookup: "roles", required: true },
    ],
  },
  api: { title: "API keys", permission: "integrations.manage", fields: [name] },
  webhooks: {
    title: "Webhooks",
    permission: "integrations.manage",
    fields: [name, { key: "url", label: "HTTPS endpoint", required: true }],
  },
};
