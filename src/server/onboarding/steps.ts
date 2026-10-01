// Client-safe step definitions for the onboarding wizard.
export const ONBOARDING_STEPS = [
  { step: 1, key: "company", title: "Company details", optional: false },
  { step: 2, key: "admin", title: "Admin account", optional: false },
  { step: 3, key: "departments", title: "Departments", optional: true },
  { step: 4, key: "teams", title: "Teams", optional: true },
  { step: 5, key: "invite", title: "Invite users", optional: true },
  { step: 6, key: "categories", title: "Ticket categories", optional: true },
  { step: 7, key: "sla", title: "SLA targets", optional: true },
  { step: 8, key: "finish", title: "Finish", optional: false },
] as const;
export const LAST_STEP = ONBOARDING_STEPS.length;
