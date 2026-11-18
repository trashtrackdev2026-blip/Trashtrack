import test from "node:test";
import assert from "node:assert/strict";
import { filterReportSummary } from "../src/lib/report-summary.ts";
import { isReportArchived, canUpdateReport } from "../src/lib/report-workflow.ts";

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

test("rejected reports remain visible separately and never count as active or resolved", () => {
  const rejected = { id: "prank", status: "Rejected", location: "Sala" };
  const records = [...reports, rejected];
  assert.deepEqual(filterReportSummary(records, "rejected", "Admin"), [rejected]);
  assert.equal(filterReportSummary(records, "active", "Admin").some(report => report.id === "prank"), false);
  assert.equal(isReportArchived(rejected), false);
  assert.deepEqual(filterReportSummary(records, "all", "Admin"), records);
});

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

test("resolution automatically moves current and legacy reports from active to archived without removing history", () => {
  const records = [...reports, {id:"legacy",status:" Resolved ",location:"Sala",description:"Original details"},
    {id:"incorrect-flag",status:"Endorsed",location:"Sala",archived:true}];
  const archived = filterReportSummary(records,"archived","Admin");
  const active = filterReportSummary(records,"active","Admin");
  assert.deepEqual(ids(archived),["resolved","legacy"]);
  assert.ok(active.some(report => report.id === "incorrect-flag"), "Only resolved reports are archived");
  assert.equal(active.length + archived.length, records.length);
  assert.equal(archived[1].description,"Original details");
  assert.equal(filterReportSummary(records,"all","Admin").length,records.length);
  assert.equal(isReportArchived({status:"For MENRO Review"}),false);
  assert.equal(isReportArchived({}),false);
  for (const report of archived) assert.equal(canUpdateReport("Admin",null,report,"Endorsed"),false);
});

test("archived views retain the barangay scope and a resolved report switches views immediately", () => {
  const scoped = reports.filter(report => report.location === "Sala");
  const activeBefore = filterReportSummary(scoped,"active","Semi-Admin");
  const changed = scoped.map(report => report.id === "verified" ? {...report,status:"Resolved"} : report);
  assert.equal(filterReportSummary(changed,"active","Semi-Admin").length,activeBefore.length-1);
  assert.deepEqual(ids(filterReportSummary(changed,"archived","Semi-Admin")),["verified","resolved"]);
  assert.ok(filterReportSummary(changed,"archived","Semi-Admin").every(report=>report.location==="Sala"));
});
