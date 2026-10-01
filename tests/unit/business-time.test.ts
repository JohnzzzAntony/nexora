import { test } from "node:test";
import assert from "node:assert/strict";
import { addBusinessMinutes, businessMinutesBetween, type BusinessCalendar } from "../../src/lib/sla/business-time.ts";

const weekdays = (tz: string, holidays: BusinessCalendar["holidays"] = []): BusinessCalendar => ({
  timezone: tz, holidays, periods: [1, 2, 3, 4, 5].map(dayOfWeek => ({ dayOfWeek, startMinute: 9 * 60, endMinute: 17 * 60 })),
});

test("24x7 calendar adds wall-clock minutes", () => {
  const start = new Date("2026-10-02T10:00:00Z");
  assert.equal(addBusinessMinutes(start, 90, { timezone: "UTC", periods: [], holidays: [] }).toISOString(), "2026-10-02T11:30:00.000Z");
});

test("rolls over end of day and weekend (Dubai, UTC+4)", () => {
  // Fri 2026-10-02 16:00 Dubai = 12:00Z; 2h business time -> Mon 10:00 Dubai = 06:00Z
  const due = addBusinessMinutes(new Date("2026-10-02T12:00:00Z"), 120, weekdays("Asia/Dubai"));
  assert.equal(due.toISOString(), "2026-10-05T06:00:00.000Z");
});

test("starts counting at opening time when created outside hours", () => {
  // Sat -> Mon 09:00 UTC + 30m
  assert.equal(addBusinessMinutes(new Date("2026-10-03T08:00:00Z"), 30, weekdays("UTC")).toISOString(), "2026-10-05T09:30:00.000Z");
});

test("skips holidays including recurring ones", () => {
  const cal = weekdays("UTC", [{ date: "2020-10-05", recurring: true }]);
  assert.equal(addBusinessMinutes(new Date("2026-10-02T16:00:00Z"), 120, cal).toISOString(), "2026-10-06T10:00:00.000Z");
});

test("handles DST transitions (New York)", () => {
  // Fri 2026-10-30 16:00 EDT (20:00Z); DST ends Sun Nov 1; +2h -> Mon 10:00 EST = 15:00Z
  assert.equal(addBusinessMinutes(new Date("2026-10-30T20:00:00Z"), 120, weekdays("America/New_York")).toISOString(), "2026-11-02T15:00:00.000Z");
});

test("businessMinutesBetween is inverse of addBusinessMinutes", () => {
  const cal = weekdays("Asia/Dubai");
  const start = new Date("2026-10-01T07:13:00Z");
  for (const m of [1, 59, 480, 1000, 5000]) assert.equal(businessMinutesBetween(start, addBusinessMinutes(start, m, cal), cal), m);
});

test("supports split working periods", () => {
  const cal: BusinessCalendar = { timezone: "UTC", holidays: [], periods: [{ dayOfWeek: 4, startMinute: 540, endMinute: 720 }, { dayOfWeek: 4, startMinute: 780, endMinute: 1020 }] };
  // Thu 2026-10-01 11:00 + 90m -> 12:00 lunch break -> resumes 13:00 -> 13:30
  assert.equal(addBusinessMinutes(new Date("2026-10-01T11:00:00Z"), 90, cal).toISOString(), "2026-10-01T13:30:00.000Z");
});
