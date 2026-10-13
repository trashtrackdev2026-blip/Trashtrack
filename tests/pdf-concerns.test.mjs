import test from "node:test";
import assert from "node:assert/strict";
import { scheduleOccursOn } from "../src/lib/schedules.ts";
import { canUpdateReport, nextReportStatuses, normalizeReportStatus } from "../src/lib/report-workflow.ts";
import { parseChatResponse, OFF_TOPIC_REPLY } from "../src/lib/chat-response.ts";

test("September 25 collection never appears on earlier Fridays or another month", () => {
  const schedule = { date: "2026-09-25", day: "Friday", status: "Active" };
  for (const day of [4, 11, 18]) assert.equal(scheduleOccursOn(schedule, new Date(2026, 8, day)), false);
  assert.equal(scheduleOccursOn(schedule, new Date(2026, 8, 25)), true);
  assert.equal(scheduleOccursOn(schedule, new Date(2026, 9, 2)), false);
  assert.equal(scheduleOccursOn({ ...schedule, status: "Inactive" }, new Date(2026, 8, 25)), false);
});

test("dated schedule ignores conflicting weekday; legacy weekly schedules still work", () => {
  assert.equal(scheduleOccursOn({ date: "2026-09-25", day: "Monday", status: "Active" }, new Date(2026, 8, 25)), true);
  const legacy = { day: "Monday, Thursday", status: "Active" };
  assert.equal(scheduleOccursOn(legacy, new Date(2026, 8, 21)), true);
  assert.equal(scheduleOccursOn(legacy, new Date(2026, 8, 24)), true);
  assert.equal(scheduleOccursOn(legacy, new Date(2026, 8, 25)), false);
});

test("Captain can review and forward only their barangay's reports", () => {
  const report = { location: "Makina", status: "Pending" };
  assert.equal(canUpdateReport("Semi-Admin", "Makina", report, "UnderReview"), true);
  assert.equal(canUpdateReport("Semi-Admin", "Poblacion", report, "UnderReview"), false);
  assert.equal(canUpdateReport("Semi-Admin", null, report, "UnderReview"), false);
  assert.equal(canUpdateReport("Semi-Admin", "Makina", report, "For MENRO Review"), false);
  assert.equal(canUpdateReport("Semi-Admin", "Makina", { ...report, status: "Under Review" }, "ForMenroReview"), true);
  assert.equal(canUpdateReport("Semi-Admin", "Makina", { ...report, status: "Endorsed" }, "Resolved", true), false);
});

test("MENRO acts after endorsement and confirms collection before resolving", () => {
  const report = { location: "Makina", status: "For MENRO Review" };
  assert.equal(canUpdateReport("Admin", null, report, "Endorsed"), true);
  assert.equal(canUpdateReport("Admin", null, report, "Resolved", true), false);
  assert.equal(canUpdateReport("Admin", null, { ...report, status: "Endorsed" }, "Resolved"), false);
  assert.equal(canUpdateReport("Admin", null, { ...report, status: "Endorsed" }, "Resolved", true), true);
  assert.equal(canUpdateReport("Resident", "Makina", report, "Endorsed"), false);
  assert.deepEqual(nextReportStatuses("Admin", "Resolved"), []);
  assert.deepEqual(nextReportStatuses("Admin", "Pending"), []);
  assert.equal(normalizeReportStatus("ForMenroReview"), "For MENRO Review");
});

test("off-topic AI output is replaced rather than returned to the resident", () => {
  assert.equal(parseChatResponse(JSON.stringify({ inScope: false, text: "Here is an egg recipe..." })), OFF_TOPIC_REPLY);
  assert.equal(parseChatResponse(JSON.stringify({ inScope: true, text: " Compost eggshells. " })), "Compost eggshells.");
  for (const raw of ['{}', 'null', '{"inScope":"false","text":"recipe"}', '{"inScope":true,"text":""}']) {
    assert.throws(() => parseChatResponse(raw));
  }
});
