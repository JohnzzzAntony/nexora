import { z } from "zod";

// Rule definitions (shared by the settings UI and the engine). Pure — safe on client and server.

export const AUTOMATION_TRIGGERS = {
  "ticket.created": "Ticket is created",
  "ticket.updated": "Ticket is updated",
  "ticket.replied": "Requester replies",
  "sla.breached": "SLA is breached",
} as const;
export type AutomationTrigger = keyof typeof AUTOMATION_TRIGGERS;

export const CONDITION_FIELDS = {
  subject: { label: "Subject", kind: "text" },
  description: { label: "Description", kind: "text" },
  status: { label: "Status", kind: "status" },
  priority: { label: "Priority", kind: "priority" },
  category: { label: "Category", kind: "category" },
  subcategory: { label: "Subcategory", kind: "category" },
  team: { label: "Team", kind: "team" },
  assignee: { label: "Assignee", kind: "user" },
  requesterEmail: { label: "Requester email", kind: "text" },
  source: { label: "Source", kind: "source" },
  tags: { label: "Tags", kind: "text" },
  customer: { label: "Customer", kind: "customer" },
  department: { label: "Department", kind: "department" },
  hoursSinceCreated: { label: "Hours since created", kind: "number" },
} as const;
export type ConditionField = keyof typeof CONDITION_FIELDS;

export const OPERATORS = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  starts_with: "starts with",
  greater_than: "greater than",
  less_than: "less than",
  is_empty: "is empty",
  is_not_empty: "is not empty",
} as const;
export type Operator = keyof typeof OPERATORS;

export const ACTION_TYPES = {
  assign_user: "Assign to user",
  assign_team: "Assign to team",
  set_priority: "Set priority",
  set_status: "Set status",
  add_tag: "Add tag",
  remove_tag: "Remove tag",
  create_task: "Create task",
  send_email: "Send email",
  send_notification: "Send notification",
  change_sla: "Change SLA policy",
  escalate: "Escalate",
  add_watcher: "Add watcher",
} as const;
export type ActionType = keyof typeof ACTION_TYPES;

export const conditionSchema = z.object({
  field: z.enum(Object.keys(CONDITION_FIELDS) as [ConditionField, ...ConditionField[]]),
  op: z.enum(Object.keys(OPERATORS) as [Operator, ...Operator[]]),
  value: z.string().max(500).optional().default(""),
});
export type Condition = z.infer<typeof conditionSchema>;

export type ConditionGroup = { operator: "AND" | "OR"; conditions: (Condition | ConditionGroup)[] };
export const conditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.object({ operator: z.enum(["AND", "OR"]), conditions: z.array(z.union([conditionSchema, conditionGroupSchema])).max(30) }),
);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assign_user"), userId: z.string().min(1) }),
  z.object({ type: z.literal("assign_team"), teamId: z.string().min(1) }),
  z.object({ type: z.literal("set_priority"), priorityKey: z.string().min(1) }),
  z.object({ type: z.literal("set_status"), statusKey: z.string().min(1) }),
  z.object({ type: z.literal("add_tag"), tag: z.string().min(1).max(50) }),
  z.object({ type: z.literal("remove_tag"), tag: z.string().min(1).max(50) }),
  z.object({ type: z.literal("create_task"), title: z.string().min(1).max(200), assigneeId: z.string().optional() }),
  z.object({ type: z.literal("send_email"), to: z.union([z.enum(["requester", "assignee"]), z.email()]), subject: z.string().min(1).max(200), body: z.string().min(1).max(5000) }),
  z.object({ type: z.literal("send_notification"), to: z.enum(["assignee", "team", "requester", "watchers"]), message: z.string().min(1).max(500) }),
  z.object({ type: z.literal("change_sla"), policyId: z.string().min(1) }),
  z.object({ type: z.literal("escalate"), userId: z.string().optional(), teamId: z.string().optional(), priorityKey: z.string().optional() }),
  z.object({ type: z.literal("add_watcher"), userId: z.string().min(1) }),
]);
export type AutomationAction = z.infer<typeof actionSchema>;

export const ruleInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  trigger: z.enum(Object.keys(AUTOMATION_TRIGGERS) as [AutomationTrigger, ...AutomationTrigger[]]),
  conditions: conditionGroupSchema,
  actions: z.array(actionSchema).min(1).max(20),
  isActive: z.boolean().default(true),
  stopProcessing: z.boolean().default(false),
  order: z.number().int().min(0).max(10000).default(0),
});

/** Flat snapshot of a ticket the rules evaluate against. */
export type TicketFacts = Record<ConditionField, string | number | string[] | null>;

function compare(actual: TicketFacts[ConditionField], c: Condition): boolean {
  const values = Array.isArray(actual) ? actual : actual === null || actual === undefined ? [] : [actual];
  const empty = values.length === 0 || values.every(v => v === "");
  if (c.op === "is_empty") return empty;
  if (c.op === "is_not_empty") return !empty;
  const want = (c.value ?? "").toLowerCase();
  const strs = values.map(v => String(v).toLowerCase());
  switch (c.op) {
    case "equals": return strs.includes(want);
    case "not_equals": return !strs.includes(want);
    case "contains": return strs.some(s => s.includes(want));
    case "starts_with": return strs.some(s => s.startsWith(want));
    case "greater_than": return values.some(v => Number(v) > Number(c.value));
    case "less_than": return values.some(v => Number(v) < Number(c.value));
  }
}

const isGroup = (x: Condition | ConditionGroup): x is ConditionGroup => "operator" in x;

export function evaluate(group: ConditionGroup, facts: TicketFacts): boolean {
  if (!group.conditions.length) return true;
  const results = group.conditions.map(c => (isGroup(c) ? evaluate(c, facts) : compare(facts[c.field], c)));
  return group.operator === "AND" ? results.every(Boolean) : results.some(Boolean);
}
