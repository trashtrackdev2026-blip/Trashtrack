import test from "node:test";
import assert from "node:assert/strict";
import { filterMenroReports, menroStage, reportDate } from "../src/lib/menro-reports.ts";
import { canUpdateReport, reportWorkflowStatus } from "../src/lib/report-workflow.ts";

const base = { id: "report-1", type: "Illegal Dumping", description: "Waste beside Riverside Park", location: "Poblacion", reporterName: "Test Resident", reviewedByName: "Test Official", date: "2026-10-05 08:00" };
const filters = { stage: "ready", search: "", status: "all", barangay: "all", days: 0, assignedBarangay: "Poblacion", now: new Date("2026-10-05T09:00:00+08:00") };

test("Reports waiting to be sent remain separate from MENRO submissions and collection", () => {
  assert.equal(menroStage("Pending"), null);
  assert.equal(menroStage("Under Review"), "ready");
  assert.equal(menroStage("ForMenroReview"), "submitted");
  assert.equal(menroStage("MENRO Under Review"), "review");
  assert.equal(menroStage("Endorsed"), "collection");
  assert.equal(menroStage("Resolved"), "resolved");
  const ready = { ...base, status: "UnderReview" };
  const submitted = { ...base, id: "report-2", status: "For MENRO Review" };
  assert.deepEqual(filterMenroReports([ready, submitted], filters), [ready]);
  assert.deepEqual(filterMenroReports([ready, submitted], { ...filters, stage: "submitted" }), [submitted]);
  assert.equal(canUpdateReport("Semi-Admin", "Poblacion", ready, "For MENRO Review"), true);
  assert.equal(canUpdateReport("Semi-Admin", "Poblacion", submitted, "For MENRO Review"), false);
});

test("Search and filters never widen a semi-admin's barangay scope", () => {
  const report = { ...base, status: "UnderReview" };
  const neighbor = { ...report, id: "report-2", location: "Sala" };
  for (const search of ["riverside", "test official", "illegal", "report-1"]) {
    assert.deepEqual(filterMenroReports([report, neighbor], { ...filters, search }), [report]);
  }
  assert.deepEqual(filterMenroReports([report, neighbor], { ...filters, barangay: "Sala" }), []);
  assert.deepEqual(filterMenroReports([report], { ...filters, status: "resolved" }), []);
  assert.deepEqual(filterMenroReports([report], { ...filters, search: "not found" }), []);
});

test("Date filters interpret existing phone dates in Manila and reject missing or future dates", () => {
  assert.equal(reportDate("2026-10-05 08:00").toISOString(), "2026-10-05T00:00:00.000Z");
  assert.equal(reportDate("2026-10-05T00:00:00Z").toISOString(), "2026-10-05T00:00:00.000Z");
  assert.equal(reportDate("not a date"), null);
  const recent = { ...base, status: "UnderReview" };
  const old = { ...recent, id: "old", date: "2026-09-01 08:00" };
  const future = { ...recent, id: "future", date: "2026-10-06 08:00" };
  const missing = { ...recent, id: "missing", date: "" };
  assert.deepEqual(filterMenroReports([recent, old, future, missing], { ...filters, days: 7 }), [recent]);
  assert.equal(filterMenroReports([recent, old, future, missing], filters).length, 4);
});

test("MENRO review preserves the resident app's stored status and requires MENRO authority", () => {
  assert.equal(reportWorkflowStatus({ status: "For MENRO Review" }), "For MENRO Review");
  const status = reportWorkflowStatus({ status: "For MENRO Review", menroReviewedAt: "server timestamp" });
  assert.equal(status, "MENRO Under Review");
  const report = { location: "Poblacion", status };
  assert.equal(canUpdateReport("Admin", null, report, "Endorsed"), true);
  assert.equal(canUpdateReport("Semi-Admin", "Poblacion", report, "Endorsed"), false);
  assert.equal(canUpdateReport("Admin", null, report, "MENRO Under Review"), false);
  assert.equal(reportWorkflowStatus({ status: "Resolved", menroReviewedAt: "server timestamp" }), "Resolved");
});
