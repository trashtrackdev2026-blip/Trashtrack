// Run the actual route against an in-memory transaction. No Firebase writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as policy from "../src/lib/staff-access.ts";
import * as actions from "../src/lib/report-action.ts";
import * as schedules from "../src/lib/schedule-policy.ts";
import * as workflow from "../src/lib/report-workflow.ts";
import {communityPublication} from "../src/lib/community-publication.ts";
import * as schedulingTime from "../src/lib/scheduling-time.ts";
import * as eventForm from "../src/lib/event-form.ts";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../src/app/api/reports/manage/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const profile = { role: "Semi-Admin", barangay: "Poblacion", name: "Test Official", accessStatus: "active", mfaRequired: false, ...options.profile };
  const identity = { uid: "official", email_verified: true, auth_time: now, staffRole: policy.staffRole(profile.role), staffBarangay: profile.barangay, ...options.identity };
  const records = new Map([
    ["users/official", { ...profile, ...options.currentProfile }],
    ["reports/one", { status: "UnderReview", location: "Poblacion", ...options.report }],
  ]);
  let sequence = 0;
  const db = {
      collection: name => ({ doc: id => ({ id, path: `${name}/${id || "audit-" + ++sequence}` }), where:(field,op,value)=>({collection:name,field,value}) }),
    async runTransaction(action) {
      const working = new Map(structuredClone([...records]));
      let wrote=false;
      const result=await action({ get: async ref => {assert.equal(wrote,false,"Read before write");return ref.collection?{docs:[...working].filter(([path,data])=>path.startsWith(ref.collection+"/")&&data[ref.field]===ref.value).map(([path,data])=>({id:path.split("/")[1],data:()=>structuredClone(data)}))}:{id:ref.id,exists:working.has(ref.path),data:()=>structuredClone(working.get(ref.path))};},
        set:(ref,values)=>{wrote=true;working.set(ref.path,values);},
        update: (ref, values) => {wrote=true;assert.ok(working.has(ref.path));working.set(ref.path, { ...working.get(ref.path), ...values });},
        create: (ref, values) => {wrote=true;assert.equal(working.has(ref.path),false);working.set(ref.path, values);} });
      records.clear(); for (const [key, value] of working) records.set(key, value);return result;
    },
  };
  const modules = {
    "firebase-admin/firestore": { FieldValue: { serverTimestamp: () => "server timestamp" } },
    "@/lib/staff-auth": {
      authenticatedStaff: async () => {
        if (options.signedOut) throw new policy.StaffAccessError("Sign in", 401);
        const problem = policy.staffAccessProblem(profile, identity);
        if (problem) throw new policy.StaffAccessError(problem);
        return { db, identity, profile };
      },
      requireStaffSecurity: async () => { if (options.inactiveRules) throw new policy.StaffAccessError("Setup inactive", 503); },
      staffApiError: error => Response.json({ error: error.message }, { status: error instanceof policy.StaffAccessError ? error.status : 500 }),
    },
    "@/lib/staff-access": policy,
    "@/lib/scheduling-time":schedulingTime,"@/lib/event-form":eventForm,
    "@/lib/report-workflow": workflow,"@/lib/report-action":actions,"@/lib/schedule-policy":schedules,"@/lib/community-publication":{communityPublication},"@/lib/notification-delivery":{queuePhoneNotification:async()=>{if(options.pushFails)throw new Error("Simulated provider failure");}},
  };
  const exported = {};
  new Function("require", "exports", compiled)(name => modules[name] || require(name), exported);
  let lastRequest;
  async function invoke(body,expected=200){
    lastRequest=body;
    const response=await exported.POST(new Request("http://localhost/api/reports/manage",{method:"POST",body:JSON.stringify(body)}));
    const result=await response.json();assert.equal(response.status,expected,result.error);return result;
  }
  return {records,invoke,get lastRequest(){return lastRequest;},async post(body,expected=200){
    const current=records.get("reports/one");
    return invoke({reportId:"one",status:"For MENRO Review",remarks:" Verified Riverside location. ",verificationConfirmed:true,severity:"Major",changeId:"test-"+(++sequence),expectedStatus:workflow.reportWorkflowStatus(current),expectedRevision:current.statusRevision||0, ...body},expected);
  }};
}

test("Sending to MENRO records the authenticated official and status audit atomically", async () => {
  const app = fixture();
  await app.post({ forwardedByName: "Forged name", updatedBy: "someone-else" });
  const report = app.records.get("reports/one");
  assert.equal(report.status, "For MENRO Review");
  assert.equal(report.forwardedBy, "official"); assert.equal(report.forwardedByName, "Test Official");
  assert.equal(report.verifiedBy, "official"); assert.equal(report.forwardedAt, "server timestamp");
  assert.equal(report.remarks, "Verified Riverside location.");
  assert.ok([...app.records.values()].some(record => record.action === "report.status" && record.from === "UnderReview" && record.to === "For MENRO Review"));
  const snapshot = structuredClone([...app.records]);
  await app.invoke(app.lastRequest);
  assert.deepEqual([...app.records], snapshot, "A repeated send must not duplicate or overwrite submission");
});

test("Wrong barangay, unverified reports, suspended staff and client role injection cannot forward", async () => {
  for (const options of [{ report: { location: "Sala" } }, { report: { status: "Pending" } }, { currentProfile: { accessStatus: "suspended" } }, { profile: { accessStatus: "suspended" } }, { identity: { staffBarangay: "Sala" } }, { profile: { role: "Resident" } }]) {
    const app = fixture(options);
    const snapshot = structuredClone([...app.records]);
    await app.post({ role: "Admin", barangay: "Sala" }, 403);
    assert.deepEqual([...app.records], snapshot);
  }
  await fixture({ signedOut: true }).post({}, 401);
  await fixture({ inactiveRules: true }).post({}, 503);
});

test("Only MENRO can start review, schedule collection and confirm resolution", async () => {
  const app = fixture({ profile: { role: "Admin", barangay: "" }, report: { status: "For MENRO Review" } });
  await app.post({ status: "MENRO Under Review" });
  assert.equal(app.records.get("reports/one").status, "For MENRO Review", "Existing resident apps retain a known status");
  assert.equal(app.records.get("reports/one").menroReviewedAt, "server timestamp");
  await app.post({ status: "MENRO Under Review" }, 403);
  await app.post({ status: "Endorsed",actionKind:"Collection",actionNotes:"Scheduled collection",actionDate:"2099-11-04",actionTime:"07:00" });
  await app.post({ status: "Resolved", collectionConfirmed: false }, 403);
  await app.post({ status: "Resolved", collectionConfirmed: true });
  assert.equal(app.records.get("reports/one").collectedBy, "official");
  await fixture({ report: { status: "For MENRO Review" } }).post({ status: "MENRO Under Review" }, 403);
});

test("A verified minor report can be resolved locally without fabricating MENRO stages",async()=>{
  const app=fixture();await app.post({status:"Resolved",severity:"Minor",collectionConfirmed:true,remarks:"Barangay team cleared the obstruction."});
  const report=app.records.get("reports/one");assert.equal(report.status,"Resolved");assert.equal(report.resolvedByRole,"Semi-Admin");assert.equal(report.resolvedByName,"Test Official");
  assert.equal(report.severity,"Minor");assert.equal(report.forwardedAt,undefined);assert.equal(report.menroReviewedAt,undefined);assert.equal(report.endorsedAt,undefined);
  const before=structuredClone([...app.records]);await app.invoke(app.lastRequest);assert.deepEqual([...app.records],before);
});

test("Local resolution and forwarding require verified severity, reasons and confirmed completion",async()=>{
  for(const body of [
    {status:"Resolved",severity:"Major",collectionConfirmed:true},
    {status:"Resolved",severity:"Minor",collectionConfirmed:false},
    {status:"Resolved",severity:"Minor",collectionConfirmed:true,verificationConfirmed:false},
    {status:"For MENRO Review",severity:"Minor"},
    {remarks:" "},
  ]){const app=fixture(),before=structuredClone([...app.records]);await app.post(body,body.collectionConfirmed===false?403:400);assert.deepEqual([...app.records],before);}
});

test("MENRO planning creates a real dated action/collection and reuses matching active collections",async()=>{
  const app=fixture({profile:{role:"Admin",barangay:""},report:{status:"For MENRO Review",menroReviewedAt:"timestamp"}});
  await app.post({status:"Endorsed",actionKind:"Cleanup",actionNotes:"Cleanup crew and truck",actionDate:"2099-11-04",actionTime:"07:00"});
  const report=app.records.get("reports/one"),schedule=app.records.get("schedules/"+report.scheduleId);
  assert.equal(schedule.date,"2099-11-04");assert.equal(schedule.barangay,"Poblacion");assert.equal(schedule.time,"07:00");assert.equal(report.actionKind,"Cleanup");
  const before=structuredClone([...app.records]);await app.invoke(app.lastRequest);assert.deepEqual([...app.records],before);
  const joined=fixture({profile:{role:"Admin",barangay:""},report:{status:"For MENRO Review",menroReviewedAt:"timestamp"}});
  joined.records.set("schedules/existing",{date:"2099-11-04",time:"07:00",barangay:"Poblacion",status:"Active"});
  await joined.post({status:"Endorsed",actionKind:"Collection",actionNotes:"Join existing route",actionDate:"2099-11-04",actionTime:"07:00"});
  assert.equal(joined.records.get("reports/one").scheduleId,"existing");assert.equal([...joined.records.keys()].filter(path=>path.startsWith("schedules/")).length,1);
});

test("Past scheduling, duplicate dates, stale versions and changed retry payloads leave no partial report action",async()=>{
  const base={profile:{role:"Admin",barangay:""},report:{status:"For MENRO Review",menroReviewedAt:"timestamp"}};
  for(const [body,code] of [[{actionDate:"2020-01-01"},400],[{expectedRevision:4},409],[{actionNotes:""},400],[{actionKind:"Invented"},400]]) {
    const app=fixture(base),before=structuredClone([...app.records]);await app.post({status:"Endorsed",actionKind:"Recollection",actionNotes:"Return route",actionDate:"2099-11-04",actionTime:"07:00",...body},code);assert.deepEqual([...app.records],before);
  }
  const occupied=fixture(base);occupied.records.set("schedules/existing",{date:"2099-11-04",time:"09:00",barangay:"Poblacion",status:"Active"});
  const before=structuredClone([...occupied.records]);await occupied.post({status:"Endorsed",actionKind:"Collection",actionNotes:"Route",actionDate:"2099-11-04",actionTime:"07:00"},409);assert.deepEqual([...occupied.records],before);
  const retry=fixture();await retry.post({status:"Resolved",severity:"Minor",collectionConfirmed:true});await retry.invoke({...retry.lastRequest,remarks:"Changed payload"},409);
});

test("An Other response is recorded without inventing a collection schedule",async()=>{
  const app=fixture({profile:{role:"Admin",barangay:""},report:{status:"For MENRO Review",menroReviewedAt:"timestamp"}});
  await app.post({status:"Endorsed",actionKind:"Other",actionNotes:"Inspect waste storage and provide assistance"});
  assert.equal(app.records.get("reports/one").actionKind,"Other");assert.equal([...app.records.keys()].some(path=>path.startsWith("schedules/")),false);
  await app.post({status:"Resolved",collectionConfirmed:true,remarks:"Inspection and assistance completed."});assert.equal(app.records.get("reports/one").resolvedByRole,"Admin");
});

test("A planned collection saves its announcement atomically and retains it after phone delivery fails",async()=>{
  const app=fixture({pushFails:true,profile:{role:"Admin",barangay:""},report:{status:"For MENRO Review",menroReviewedAt:"timestamp"}});
  const result=await app.post({status:"Endorsed",actionKind:"Collection",actionNotes:"Collection route",actionDate:"2099-11-04",actionTime:"07:00"});
  assert.equal(result.saved,true);assert.equal(result.queued,false);assert.ok(result.deliveryError);
  const notice=app.records.get("notifications/"+result.notificationId);assert.equal(notice.recipients,"Poblacion");assert.equal(notice.type,"schedule");assert.equal(app.records.get("reports/one").status,"Endorsed");
  const before=structuredClone([...app.records]);await app.invoke(app.lastRequest);assert.deepEqual([...app.records],before);
});

test("A selected posted collection supplies the authoritative date/time and rejects stale or incompatible selections",async()=>{
  const options={profile:{role:"Admin",barangay:""},report:{status:"For MENRO Review",menroReviewedAt:"timestamp"}};
  const app=fixture(options);app.records.set("schedules/selected",{barangay:"Poblacion",date:"2099-11-06",time:"8:30 AM",status:"Active",statusRevision:3});
  await app.post({status:"Endorsed",actionKind:"Collection",actionNotes:"Use the posted route",scheduleId:"selected",scheduleRevision:3,actionDate:"2020-01-01",actionTime:"22:00"});
  assert.equal(app.records.get("reports/one").actionDate,"2099-11-06");assert.equal(app.records.get("reports/one").actionTime,"08:30");assert.equal(app.records.get("reports/one").scheduleId,"selected");
  for(const changed of [{status:"Completed"},{barangay:"Sala"},{statusRevision:4},{date:"2020-01-01"}]){
    const denied=fixture(options);denied.records.set("schedules/selected",{barangay:"Poblacion",date:"2099-11-06",time:"08:30",status:"Active",statusRevision:3,...changed});const before=structuredClone([...denied.records]);
    await denied.post({status:"Endorsed",actionKind:"Collection",actionNotes:"Use posted route",scheduleId:"selected",scheduleRevision:3},changed.date?400:409);assert.deepEqual([...denied.records],before);
  }
});

test("Legacy status spelling can progress with a fresh version while stale versions remain rejected",async()=>{
  const app=fixture({report:{status:"Under Review"}});
  await app.post({expectedStatus:"UnderReview",status:"Resolved",severity:"Minor",collectionConfirmed:true,remarks:"Barangay team completed the local action."});
  assert.equal(app.records.get("reports/one").verificationNotes,"Barangay team completed the local action.");
  assert.ok([...app.records.values()].some(record=>record.action==="report.status"&&record.findings==="Barangay team completed the local action."));
});
