// Built-in email templates. Organizations may override subject/body per key (EmailTemplate).
// Placeholders use {{name}}; values are HTML-escaped at render time. {{{name}}} inserts
// pre-sanitized HTML (only used for message bodies that went through sanitizeHtml).

export type EmailTemplateKey =
  | "welcome" | "email_verification" | "password_reset" | "invitation"
  | "ticket_created" | "ticket_assigned" | "ticket_updated" | "ticket_replied" | "ticket_resolved" | "ticket_closed"
  | "sla_warning" | "sla_breach" | "task_assigned" | "task_overdue" | "approval_requested" | "approval_decided" | "mention" | "notification";

type Template = { name: string; subject: string; body: string; variables: string[]; editable: boolean };

const button = (label: string) =>
  `<p style="margin:24px 0"><a href="{{url}}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, Template> = {
  welcome: { name: "Welcome", editable: true, variables: ["name", "organization", "url"], subject: "Welcome to {{organization}} on Nexora", body: `<p>Hi {{name}},</p><p>Your workspace <strong>{{organization}}</strong> is ready.</p>${button("Open workspace")}` },
  email_verification: { name: "Email verification", editable: false, variables: ["name", "url"], subject: "Verify your email address", body: `<p>Hi {{name}},</p><p>Confirm your email address to finish setting up your account. The link expires in 24 hours.</p>${button("Verify email")}` },
  password_reset: { name: "Password reset", editable: false, variables: ["name", "url"], subject: "Reset your Nexora password", body: `<p>Hi {{name}},</p><p>We received a request to reset your password. The link expires in 1 hour. If you did not request this, ignore this email.</p>${button("Reset password")}` },
  invitation: { name: "Organization invitation", editable: true, variables: ["inviter", "organization", "role", "url"], subject: "{{inviter}} invited you to {{organization}}", body: `<p>{{inviter}} invited you to join <strong>{{organization}}</strong> as {{role}}.</p>${button("Accept invitation")}<p style="color:#64748b">This invitation expires in 7 days.</p>` },
  ticket_created: { name: "Ticket created", editable: true, variables: ["ticket", "subject", "requester", "url"], subject: "[{{ticket}}] {{subject}}", body: `<p>We received your request <strong>{{ticket}}</strong>: {{subject}}.</p><p>Our team will respond soon. You can reply to this email to add information.</p>${button("View ticket")}` },
  ticket_assigned: { name: "Ticket assigned", editable: true, variables: ["ticket", "subject", "assignee", "url"], subject: "[{{ticket}}] assigned to you: {{subject}}", body: `<p>Ticket <strong>{{ticket}}</strong> — {{subject}} — is now assigned to {{assignee}}.</p>${button("Open ticket")}` },
  ticket_updated: { name: "Ticket updated", editable: true, variables: ["ticket", "subject", "summary", "url"], subject: "[{{ticket}}] updated: {{subject}}", body: `<p>Ticket <strong>{{ticket}}</strong> was updated.</p><p>{{summary}}</p>${button("Open ticket")}` },
  ticket_replied: { name: "Ticket replied", editable: true, variables: ["ticket", "subject", "author", "message", "url"], subject: "Re: [{{ticket}}] {{subject}}", body: `<p><strong>{{author}}</strong> replied:</p><div style="border-left:3px solid #e2e8f0;padding-left:12px">{{{message}}}</div>${button("View conversation")}<p style="color:#64748b">Reply to this email to respond.</p>` },
  ticket_resolved: { name: "Ticket resolved", editable: true, variables: ["ticket", "subject", "url"], subject: "[{{ticket}}] resolved: {{subject}}", body: `<p>Your request <strong>{{ticket}}</strong> has been resolved. Reply if anything is still wrong and we will reopen it.</p>${button("View ticket")}` },
  ticket_closed: { name: "Ticket closed", editable: true, variables: ["ticket", "subject", "url"], subject: "[{{ticket}}] closed: {{subject}}", body: `<p>Request <strong>{{ticket}}</strong> is now closed.</p>${button("View ticket")}` },
  sla_warning: { name: "SLA warning", editable: true, variables: ["ticket", "subject", "metric", "due", "url"], subject: "SLA warning [{{ticket}}] {{subject}}", body: `<p>The {{metric}} target for <strong>{{ticket}}</strong> is due {{due}}.</p>${button("Open ticket")}` },
  sla_breach: { name: "SLA breach", editable: true, variables: ["ticket", "subject", "metric", "url"], subject: "SLA breached [{{ticket}}] {{subject}}", body: `<p>The {{metric}} target for <strong>{{ticket}}</strong> has been breached.</p>${button("Open ticket")}` },
  task_assigned: { name: "Task assigned", editable: true, variables: ["task", "title", "url"], subject: "Task assigned: {{title}}", body: `<p>Task <strong>{{task}}</strong> — {{title}} — is assigned to you.</p>${button("Open task")}` },
  task_overdue: { name: "Task overdue", editable: true, variables: ["task", "title", "url"], subject: "Task overdue: {{title}}", body: `<p>Task <strong>{{task}}</strong> — {{title}} — is past its due date.</p>${button("Open task")}` },
  approval_requested: { name: "Approval requested", editable: true, variables: ["title", "requester", "url"], subject: "Approval requested: {{title}}", body: `<p>{{requester}} requested your approval for <strong>{{title}}</strong>.</p>${button("Review request")}` },
  approval_decided: { name: "Approval decided", editable: true, variables: ["title", "decision", "url"], subject: "Approval {{decision}}: {{title}}", body: `<p>Your request <strong>{{title}}</strong> was {{decision}}.</p>${button("View request")}` },
  mention: { name: "Mention", editable: true, variables: ["author", "context", "url"], subject: "{{author}} mentioned you", body: `<p>{{author}} mentioned you in {{context}}.</p>${button("Open")}` },
  notification: { name: "Generic notification", editable: false, variables: ["title", "body", "url"], subject: "{{title}}", body: `<p>{{body}}</p>${button("Open")}` },
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderString(template: string, data: Record<string, unknown>, html: boolean) {
  return template
    .replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (_, k) => String(data[k] ?? ""))
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (html ? escapeHtml(String(data[k] ?? "")) : String(data[k] ?? "")));
}

export function wrapLayout(inner: string, organization?: string) {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:32px 16px"><div style="font-weight:700;font-size:18px;margin-bottom:16px">${escapeHtml(organization || "Nexora")}</div>
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;font-size:14px;line-height:1.6">${inner}</div>
<p style="color:#94a3b8;font-size:12px;margin-top:16px">Sent by Nexora</p></div></body></html>`;
}

export const htmlToText = (html: string) =>
  html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
