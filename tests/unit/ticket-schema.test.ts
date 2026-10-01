import { test } from "node:test";
import assert from "node:assert/strict";
import { updateTicketSchema, createTicketSchema } from "../../src/schemas/ticket.ts";

test("omitted optional ids stay undefined on update (no accidental clearing)", () => {
  const parsed = updateTicketSchema.parse({ assigneeId: "u1" });
  assert.equal(parsed.teamId, undefined);
  assert.equal(parsed.categoryId, undefined);
  assert.equal(parsed.assigneeId, "u1");
});

test("explicit null or empty string clears an optional id", () => {
  assert.equal(updateTicketSchema.parse({ teamId: null }).teamId, null);
  assert.equal(updateTicketSchema.parse({ teamId: "" }).teamId, null);
});

test("create requires a meaningful subject", () => {
  assert.equal(createTicketSchema.safeParse({ subject: "ab" }).success, false);
  assert.equal(createTicketSchema.safeParse({ subject: "Printer down" }).success, true);
});
