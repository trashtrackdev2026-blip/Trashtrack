import test from "node:test";
import assert from "node:assert/strict";
import { filterReportSummary } from "../src/lib/report-summary.ts";

const reports = [
  { id: "pending", status: "pending", location: "Sala" },
  { id: "verified", status: "Under Review", location: "Sala" },
  { id: "submitted", status: "ForMenroReview", location: "Sala" },
  { id: "review", status: "MENRO Under Review", location: "Sala" },
  { id: "legacy-review", status: "For MENRO Review", menroReviewedAt: "timestamp", location: "Looc" },
  { id: "collection", status: "Endorsed", location: "Sala" },
  { id: "resolved", status: "RESOLVED", location: "Sala" },
];
const ids = list => list.map(report => report.id);

test("MENRO summary cards show their corresponding stage and Total restores every report", () => {
  assert.deepEqual(ids(filterReportSummary(reports, "pending", "Admin")), ["pending"]);
  assert.deepEqual(ids(filterReportSummary(reports, "review", "Admin")), ["review", "legacy-review"]);
  assert.deepEqual(ids(filterReportSummary(reports, "resolved", "Admin")), ["resolved"]);
  assert.deepEqual(filterReportSummary(reports, "all", "Admin"), reports);
  assert.equal(reports.length, 7);
});

test("barangay review keeps its own workflow stage and does not add reports outside its supplied scope", () => {
  const scoped = reports.filter(report => report.location === "Sala");
  assert.deepEqual(ids(filterReportSummary(scoped, "review", "Semi-Admin")), ["verified"]);
  for (const filter of ["all", "pending", "review", "resolved"])
    assert.ok(filterReportSummary(scoped, filter, "Semi-Admin").every(report => report.location === "Sala"));
});

test("empty and resolved-only lists never leak a report from a different category", () => {
  const resolved = reports.filter(report => report.id === "resolved");
  for (const role of ["Admin", "Semi-Admin"]) {
    for (const filter of ["all", "pending", "review", "resolved"]) assert.deepEqual(filterReportSummary([], filter, role), []);
    assert.deepEqual(filterReportSummary(resolved, "review", role), []);
    assert.deepEqual(filterReportSummary(resolved, "pending", role), []);
    assert.deepEqual(filterReportSummary(resolved, "resolved", role), resolved);
  }
});
