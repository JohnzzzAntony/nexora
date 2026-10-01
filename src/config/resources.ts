import type { Permission } from "@/lib/permissions/catalog";
export type Field = {
  key: string;
  label: string;
  kind?: "textarea" | "select" | "date" | "email" | "number";
  options?: string[];
  lookup?: "members" | "teams" | "departments" | "locations" | "projects";
  required?: boolean;
};
export type Resource = {
  title: string;
  singular: string;
  description: string;
  view: Permission;
  manage: Permission;
  fields: Field[];
};
const name: Field = { key: "name", label: "Name", required: true };
const description: Field = {
  key: "description",
  label: "Description",
  kind: "textarea",
};
const priority: Field = {
  key: "priority",
  label: "Priority",
  kind: "select",
  options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
};
export const RESOURCES: Record<string, Resource> = {
  tasks: {
    title: "Tasks",
    singular: "Task",
    description: "Plan work, assign an owner and track progress.",
    view: "tasks.view",
    manage: "tasks.create",
    fields: [
      { key: "title", label: "Title", required: true },
      description,
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: ["TODO", "ASSIGNED", "IN_PROGRESS", "REVIEW", "COMPLETED"],
      },
      priority,
      { key: "assigneeId", label: "Assignee", lookup: "members" },
      { key: "projectId", label: "Project", lookup: "projects" },
      { key: "teamId", label: "Team", lookup: "teams" },
      { key: "dueDate", label: "Due date", kind: "date" },
    ],
  },
  projects: {
    title: "Projects",
    singular: "Project",
    description: "Keep related work together with a clear owner and timeline.",
    view: "projects.view",
    manage: "projects.manage",
    fields: [
      name,
      { key: "key", label: "Project code", required: true },
      description,
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"],
      },
      priority,
      { key: "managerId", label: "Project manager", lookup: "members" },
      { key: "startDate", label: "Start date", kind: "date" },
      { key: "endDate", label: "End date", kind: "date" },
    ],
  },
  teams: {
    title: "Teams",
    singular: "Team",
    description: "Organize service teams and assign leaders.",
    view: "users.view",
    manage: "teams.manage",
    fields: [
      name,
      description,
      { key: "leaderId", label: "Team leader", lookup: "members" },
      { key: "departmentId", label: "Department", lookup: "departments" },
    ],
  },
  customers: {
    title: "Customers",
    singular: "Customer",
    description: "Maintain company contacts and customer records.",
    view: "customers.view",
    manage: "customers.manage",
    fields: [
      name,
      { key: "company", label: "Company" },
      { key: "email", label: "Email", kind: "email" },
      { key: "phone", label: "Phone" },
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: ["ACTIVE", "INACTIVE"],
      },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  assets: {
    title: "Assets",
    singular: "Asset",
    description: "Track equipment, ownership and maintenance status.",
    view: "assets.view",
    manage: "assets.manage",
    fields: [
      name,
      { key: "assetTag", label: "Asset tag", required: true },
      {
        key: "type",
        label: "Type",
        kind: "select",
        options: [
          "LAPTOP",
          "DESKTOP",
          "PHONE",
          "PRINTER",
          "SERVER",
          "ROUTER",
          "POS",
          "SOFTWARE",
          "OTHER",
        ],
      },
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: ["AVAILABLE", "ASSIGNED", "MAINTENANCE", "RETIRED", "LOST"],
      },
      { key: "serialNumber", label: "Serial number" },
      { key: "assignedToId", label: "Assigned to", lookup: "members" },
      { key: "locationId", label: "Location", lookup: "locations" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  knowledge: {
    title: "Knowledge base",
    singular: "Article",
    description: "Write answers once and help people solve recurring issues.",
    view: "knowledge.view",
    manage: "knowledge.manage",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "slug", label: "Article address", required: true },
      {
        key: "contentHtml",
        label: "Article content",
        kind: "textarea",
        required: true,
      },
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: ["DRAFT", "PUBLISHED"],
      },
      {
        key: "visibility",
        label: "Visibility",
        kind: "select",
        options: ["INTERNAL", "PUBLIC"],
      },
    ],
  },
  departments: {
    title: "Departments",
    singular: "Department",
    description: "Manage organizational departments.",
    view: "settings.view",
    manage: "teams.manage",
    fields: [
      name,
      { key: "code", label: "Code" },
      description,
      { key: "managerId", label: "Manager", lookup: "members" },
    ],
  },
  locations: {
    title: "Locations",
    singular: "Location",
    description: "Manage offices, stores and service locations.",
    view: "settings.view",
    manage: "teams.manage",
    fields: [
      name,
      { key: "type", label: "Type" },
      { key: "address", label: "Address", kind: "textarea" },
    ],
  },
};
