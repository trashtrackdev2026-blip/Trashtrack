import test from "node:test";
import assert from "node:assert/strict";
import { assertCollectionAvailable, collectionStatusUpdate } from "../src/lib/schedule-policy.ts";
import { summarizeAnalytics } from "../src/lib/analytics-data.ts";
import { eventEditFields, eventEditorTime, eventEditorDate } from "../src/lib/event-edit.ts";
import { learningPreviewUrl } from "../src/lib/learning-resource.ts";
import { REPORT_STATUS_LABELS, normalizeReportStatus } from "../src/lib/report-workflow.ts";
import { buildAnalyticsPdf } from "../src/lib/analytics-pdf.ts";
import { PDFDocument } from "pdf-lib";
import { accountGroup } from "../src/lib/account-group.ts";

test("Legacy staff applications remain separate from resident accounts without rewriting profiles", () => {
  assert.equal(accountGroup("Resident"), "resident");
  assert.equal(accountGroup("Resident", true), "semi-admin");
  assert.equal(accountGroup("Semi-Admin"), "semi-admin");
  assert.equal(accountGroup("Admin", true), "admin");
  assert.equal(accountGroup("unexpected"), "unknown");
});

test("Collection date is reserved across different start times and overlapping audiences", () => {
  const existing = [{date:"2099-10-31",barangay:"Sala",time:"09:00",status:"Active"}];
  assert.throws(() => assertCollectionAvailable({date:"2099-10-31",barangay:"Sala",time:"08:00"}, existing), /already occupies/);
  assert.throws(() => assertCollectionAvailable({date:"2099-10-31",barangay:"All Barangays"}, existing));
  assert.throws(() => assertCollectionAvailable({date:"2099-10-31",barangay:"Sala"}, [{...existing[0],barangay:"All Barangays"}]));
  assert.doesNotThrow(() => assertCollectionAvailable({date:"2099-11-01",barangay:"Sala"}, existing));
  assert.doesNotThrow(() => assertCollectionAvailable({date:"2099-10-31",barangay:"Makina"}, existing));
  for (const status of ["Failed", "Inactive"]) assert.doesNotThrow(() => assertCollectionAvailable(existing[0], [{...existing[0],status}]));
  for (const status of ["Unfinished", "Completed"]) assert.throws(() => assertCollectionAvailable(existing[0], [{...existing[0],status}]));
});

test("Unfinished and failed collection outcomes require follow-up notes", () => {
  for (const status of ["Failed", "Unfinished"]) {
    assert.throws(() => collectionStatusUpdate({status,notes:" "}));
    assert.deepEqual(collectionStatusUpdate({status,notes:" Road inaccessible "}), {status,statusNotes:"Road inaccessible"});
  }
  assert.throws(() => collectionStatusUpdate({status:"invented"}));
  assert.equal(collectionStatusUpdate({status:"completed"}).status,"Completed");
});

test("Resolving a report decrements pending at every workflow stage without changing historical total", () => {
  const reports = ["Pending","Under Review","For MENRO Review","MENRO Under Review","Endorsed","Resolved"].map(status => ({status,date:"2026-10-31 08:00"}));
  const now = new Date("2026-10-31T09:00:00+08:00");
  const before = summarizeAnalytics(reports,[],0,[],now);
  assert.equal(before.stats.totalReports,6);assert.equal(before.stats.pendingReports,5);
  const after = summarizeAnalytics(reports.map((report,index) => index === 4 ? {...report,status:" Resolved "} : report),[],0,[],now);
  assert.equal(after.stats.totalReports,6);assert.equal(after.stats.pendingReports,4);assert.equal(after.stats.resolvedReports,2);
});

test("Monthly trend uses the actual year and omits invalid and future dates", () => {
  const summary = summarizeAnalytics([{date:"2025-10-10",status:"Pending"},{date:"2026-10-01",status:"Resolved"},{date:"invalid"},{date:"2026-11-01"}],[],0,[{status:"Completed"},{status:"Failed"},{status:"Unfinished"}],new Date("2026-10-31T09:00:00+08:00"));
  assert.equal(summary.trendData.reduce((sum,row) => sum + row.value,0),1);
  assert.equal(summary.undatedReports,1);
  assert.equal(summary.collectionData.find(row => row.name === "Completed").value,1);
  assert.equal(summary.totalCollections,3);
});

test("Event editing validates dates and never replaces attendance, certificates or participant totals", () => {
  assert.equal(eventEditorTime("7:00 AM"), "07:00");
  assert.equal(eventEditorTime("12:30 PM - 2:00 PM", 1), "14:00");
  assert.equal(eventEditorTime("12:00 AM"), "00:00");
  assert.equal(eventEditorDate(undefined, "November 1, 2099"), "2099-11-01");
  const input = {title:"Community cleanup",barangay:"Sala",dateISO:"2099-11-01",startTime:"08:00",endTime:"10:00",description:"Updated location",participants:0,status:"Completed",certificateEnabled:false};
  const result = eventEditFields(input,{status:"Upcoming",participants:27,certificateEnabled:true});
  assert.equal(result.title,input.title);assert.equal(result.dateISO,input.dateISO);
  for (const key of ["status","participants","certificateEnabled","attendanceMethod"]) assert.equal(key in result,false);
  assert.throws(() => eventEditFields({...input,endTime:"07:00"},{status:"Upcoming"}));
  assert.throws(() => eventEditFields(input,{status:"Completed"}));
});

test("PDF preview supports legacy attachment URLs and rejects unsafe schemes", () => {
  assert.equal(learningPreviewUrl("https://res.cloudinary.com/demo/image/upload/fl_attachment/v1/guide.pdf"),"https://res.cloudinary.com/demo/image/upload/v1/guide.pdf");
  assert.equal(learningPreviewUrl("https://example.com/guide.pdf?version=2"),"https://example.com/guide.pdf?version=2");
  for (const url of ["javascript:alert(1)","data:text/html,hi","", "https://user:pass@example.com/a.pdf"]) assert.equal(learningPreviewUrl(url),null);
  assert.equal(REPORT_STATUS_LABELS.Pending,"Reported");assert.equal(normalizeReportStatus("Reported"),"Pending");
});

test("Analytics PDF contains paginated printable pages for long datasets", async () => {
  const bytes = await buildAnalyticsPdf([{title:"Waste concern trend",rows:Array.from({length:65},(_,index) => ({name:"Barangay sample " + index,value:index}))}],["Pending includes every unresolved stage."],new Date("2026-10-31T09:00:00+08:00"));
  assert.equal(Buffer.from(bytes).subarray(0,5).toString(),"%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 3);assert.equal(pdf.getTitle(),"TrashTrack Reports and Analytics");
});
