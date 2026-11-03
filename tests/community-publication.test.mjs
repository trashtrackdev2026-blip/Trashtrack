import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { communityPublication } from "../src/lib/community-publication.ts";
import * as schedules from "../src/lib/schedule-policy.ts";
import * as policy from "../src/lib/staff-access.ts";
import * as certificates from "../src/lib/certificate-data.ts";
import { buildPhonePush } from "../src/lib/phone-push.ts";
import { eventRegistrationClosed } from "../src/lib/event-lifecycle.ts";
import { notificationPublication, phoneDeliveryDue } from "../src/lib/notification-publication.ts";
import { eventFormFields, normalizedEventTime } from "../src/lib/event-form.ts";
import { notificationEdit } from "../src/lib/notification-edit.ts";
import * as clock from "../src/lib/scheduling-time.ts";
import { collectionOutcomeNotice } from "../src/lib/collection-outcome-notice.ts";
const require = createRequire(import.meta.url), ts = require("typescript");
const compile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const routeCode = compile("../src/app/api/community/publish/route.ts");
const deliveryCode = compile("../src/lib/notification-delivery.ts");
const sendCode = compile("../src/app/api/notifications/send/route.ts");
const createNoticeCode = compile("../src/app/api/notifications/create/route.ts");
const draftCode = compile("../src/app/api/events/drafts/route.ts");
const editNoticeCode = compile("../src/app/api/notifications/manage/route.ts");
const manageScheduleCode = compile("../src/app/api/schedules/manage/route.ts");
const schedule = { kind: "schedule", id: "test-schedule", barangay: "Sala", date: "2099-10-17", time: "08:00", description: "Roadside pickup" };

function fixture(options = {}) {
  const profile = { role: "Admin", accessStatus: "active", ...options.profile };
  const identity = { uid: "menro", staffRole: policy.staffRole(profile.role), staffBarangay: profile.barangay || "", email_verified: true, auth_time: Math.floor(Date.now()/1000) };
  const records = new Map([["users/menro", profile]]), pushes = [];
  let failed = false;
  class Timestamp { constructor(value = Date.now()) { this.value = value; } toMillis() { return this.value; } }
  const ref = path => ({ path, id: path.split("/").at(-1), get: async () => ({ data: () => records.get(path) }), update: async value => { records.set(path, { ...records.get(path), ...value }); } });
  let sequence = 0;
  const db = { collection: name => ({ doc: id => ref(name + "/" + (id || "fixture-" + (++sequence))), where:(field,op,value) => ({collection:name,field,value}) }), async runTransaction(callback) {
    const working = new Map([...records].map(([key, value]) => [key, { ...value }]));
    let wrote = false;
    const result = await callback({ get: async target => { assert.equal(wrote,false,"All transaction reads must precede writes");return target.collection ? ({docs:[...working].filter(([path,value]) => path.startsWith(target.collection+"/") && value[target.field] === target.value).map(([path,value]) => ({id:path.split("/")[1],data:()=>value}))}) : ({ exists: working.has(target.path), data: () => working.get(target.path) });},
      set: (target,value, options) => {wrote=true;working.set(target.path,options?.merge ? {...working.get(target.path),...value} : value);},
      create: (target, value) => { wrote=true;assert.equal(working.has(target.path), false); working.set(target.path, value); },
      update: (target, value) => { wrote=true;assert.ok(working.has(target.path)); working.set(target.path, { ...working.get(target.path), ...value }); } });
    records.clear(); for (const [key, value] of working) records.set(key, value);
    return result;
  } };
  const staffAuth = { authenticatedStaff: async () => { if (options.signedOut) throw new policy.StaffAccessError("Sign in",401); return { app: {}, db, identity, profile }; },
    requireStaffSecurity: async () => { if (options.securityUnavailable) throw new policy.StaffAccessError("Setup unavailable",503); },
    staffApiError: error => Response.json({ error: error.message }, { status: error.status || 500 }) };
  const modules = { "firebase-admin/firestore": { Timestamp, FieldValue: { serverTimestamp: () => new Timestamp() } },
    "firebase-admin/messaging": { getMessaging: () => ({ send: async payload => {
      pushes.push(payload); if ((options.failFirstPush && !failed) || (options.failSecondPush && pushes.length===2)) { failed = true; throw new Error("Messaging unavailable"); } return "test-message";
    } }) }, "./barangay-geofence": { BALETE_BARANGAYS: policy.STAFF_BARANGAYS }, "./phone-push": { buildPhonePush }, "./staff-access": policy,
    "@/lib/staff-auth": staffAuth, "@/lib/staff-access": policy, "@/lib/schedule-policy": schedules, "@/lib/community-publication": { communityPublication }, "@/lib/certificate-data": certificates,
    "@/lib/notification-publication": { notificationPublication }, "@/lib/event-form": {eventFormFields,normalizedEventTime}, "@/lib/notification-edit": {notificationEdit},
    "@/lib/scheduling-time":clock,"@/lib/collection-outcome-notice":{collectionOutcomeNotice} };
  const delivery = {}; new Function("require","exports",deliveryCode)(name => modules[name] || require(name), delivery);
  modules["@/lib/notification-delivery"] = delivery;
  const route = {}; new Function("require","exports",routeCode)(name => modules[name] || require(name), route);
  const send = {}; new Function("require","exports",sendCode)(name => modules[name] || require(name), send);
  const createNotice = {}; new Function("require","exports",createNoticeCode)(name => modules[name] || require(name), createNotice);
  const draft = {}; new Function("require","exports",draftCode)(name => modules[name] || require(name), draft);
  const edit = {}; new Function("require","exports",editNoticeCode)(name => modules[name] || require(name), edit);
  const manageSchedule = {}; new Function("require","exports",manageScheduleCode)(name => modules[name] || require(name), manageSchedule);
  const invoke = async (route,body,expected) => {const response=await route.POST(new Request("https://example.invalid/api/test",{method:"POST",body:JSON.stringify(body)}));const result=await response.json();assert.equal(response.status,expected,result.error);return result;};
  return { records, pushes, manage:(body,expected=200)=>invoke(manageSchedule,body,expected), draft:(body,expected=200)=>invoke(draft,body,expected), edit:(body,expected=200)=>invoke(edit,{changeId:"edit-"+(body.expectedRevision||0),...body},expected), async create(body, expected = 200) {
    const response = await createNotice.POST(new Request("https://example.invalid/api/notifications/create", { method:"POST", body:JSON.stringify(body) }));
    const result = await response.json(); assert.equal(response.status, expected, result.error || "Expected response"); return result;
  }, async post(body = schedule, expected = 200, retryOnly = false) {
    const response = await (retryOnly ? send : route).POST(new Request("https://example.invalid/api/community/publish", { method:"POST", body:JSON.stringify(body) }));
    const result = await response.json(); assert.equal(response.status, expected, result.error || "Expected response"); return result;
  } };
}

test("Publishing saves the schedule and in-app notice together and queues only the chosen barangay phone topic", async () => {
  for (const barangay of policy.STAFF_BARANGAYS) {
    const app = fixture(); await app.post({ ...schedule, barangay, role: "Admin", recipients: "All Barangays" });
    assert.equal(app.records.get("schedules/test-schedule").barangay, barangay);
    const notice = app.records.get("notifications/schedule_test-schedule");
    assert.equal(notice.recipients, barangay); assert.equal(notice.pushStatus, "queued");
    assert.equal(app.pushes[0].topic, "trashtrack_barangay_" + barangay.toLowerCase().replaceAll(" ","_") + "_v1");
    assert.ok(app.pushes[0].data.message.includes("2099-10-17"));
  }
});

const notice = { id: "stable-notice", title: "Collection schedule update", message: "Use the blue bags.", type: "schedule", recipients: "Sala", push: true };

test("notification creation saves one inbox record and reuses it after lost responses", async () => {
  const app = fixture();
  assert.equal((await app.create(notice)).queued, true);
  await app.create(notice);
  assert.equal(app.records.size, 2);
  assert.equal(app.pushes.length, 1);
  assert.equal(app.records.get("notifications/stable-notice").message, notice.message);
  await app.create({ ...notice, message: "Different content" }, 409);
});

test("failed phone delivery preserves a visible saved inbox item and retries without duplicates", async () => {
  const app = fixture({ failFirstPush: true });
  const first = await app.create(notice);
  assert.equal(first.saved, true); assert.equal(first.queued, false);
  const saved = app.records.get("notifications/stable-notice");
  assert.equal(saved.pushStatus, "failed"); assert.equal(saved.pushRetryable, true);
  assert.ok(saved.pushNextRetryAt > Date.now());
  assert.equal((await app.create(notice)).queued, true);
  assert.equal(app.records.size, 2); assert.equal(app.pushes.length, 2);
});

test("in-app-only notices and invalid or unauthorized sends never trigger an unintended push", async () => {
  const app = fixture(); await app.create({ ...notice, push: false });
  assert.equal(app.pushes.length, 0); assert.equal(app.records.get("notifications/stable-notice").pushStatus, "disabled");
  for (const [options, body, code] of [[{ signedOut: true }, notice, 401], [{ profile: { accessStatus: "suspended" } }, notice, 403],
    [{ profile: { role: "Semi-Admin", barangay: "Looc" } }, notice, 403], [{}, { ...notice, recipients: "Other town" }, 400], [{}, { ...notice, title: "" }, 400]]) {
    const current = fixture(options); await current.create(body, code); assert.equal(current.records.size, 1); assert.equal(current.pushes.length, 0);
  }
});

test("automatic outbox retries wait for new sends, recover stale sends and skip permanent failures", () => {
  const now = 1_000_000;
  const saved = { push: true, pushStatus: "pending", createdAtMillis: now };
  assert.equal(phoneDeliveryDue(saved, now), false);
  assert.equal(phoneDeliveryDue(saved, now + 30_000), true);
  assert.equal(phoneDeliveryDue({ ...saved, pushStatus: "queued" }, now + 90_000), false);
  assert.equal(phoneDeliveryDue({ ...saved, pushStatus: "sending", pushStartedAtMillis: now }, now + 299_000), false);
  assert.equal(phoneDeliveryDue({ ...saved, pushStatus: "sending", pushStartedAtMillis: now }, now + 300_000), true);
  assert.equal(phoneDeliveryDue({ ...saved, pushStatus: "failed", pushNextRetryAt: now + 60_000 }, now + 59_000), false);
  assert.equal(phoneDeliveryDue({ ...saved, pushStatus: "failed", pushNextRetryAt: now + 60_000 }, now + 60_000), true);
  assert.equal(phoneDeliveryDue({ ...saved, pushStatus: "failed", pushRetryable: false }, now + 90_000), false);
});
test("Lost responses and phone retries never create duplicate posts or resend a queued notice", async () => {
  const app = fixture(); await app.post(); await app.post();
  await app.post({ notificationId:"schedule_test-schedule" }, 200, true);
  assert.equal(app.pushes.length,1); assert.equal(app.records.size,4);
  await app.post({ ...schedule, barangay:"Looc" },409);
  assert.equal(app.records.get("schedules/test-schedule").barangay,"Sala");
});

test("A second publication cannot reserve the same barangay date by changing its time", async () => {
  const app=fixture();await app.post();
  await app.post({...schedule,id:"second",time:"07:00"},409);
  await app.post({...schedule,id:"all",barangay:"All Barangays"},409);
  assert.equal(app.records.has("schedules/second"),false);assert.equal(app.records.has("notifications/schedule_second"),false);
  assert.equal(app.pushes.length,1);
  await app.post({...schedule,id:"future",date:"2099-11-30"});
  assert.equal(app.records.get("schedule_days/2099-11-30").revision,1);
});
test("A failed push leaves the saved post and in-app notice available and can be retried", async () => {
  const app = fixture({ failFirstPush:true }); await app.post(schedule,502);
  assert.equal(app.records.get("notifications/schedule_test-schedule").pushStatus,"failed");
  assert.ok(app.records.has("schedules/test-schedule"));
  await app.post(); assert.equal(app.records.get("notifications/schedule_test-schedule").pushStatus,"queued"); assert.equal(app.records.size,4);
});
test("Barangay staff cannot publish or send outside their assignment while MENRO can target all residents", async () => {
  const app = fixture({ profile:{ role:"Semi-Admin", barangay:"Sala" } });
  await app.post({ ...schedule, barangay:"Looc" },403); assert.equal(app.records.size,1);
  await app.post();
  app.records.get("notifications/schedule_test-schedule").recipients="Looc";
  await app.post({ notificationId:"schedule_test-schedule" },403,true);
  const menro = fixture(); await menro.post({ ...schedule, barangay:"All Barangays" }); assert.equal(menro.pushes[0].topic,"trashtrack_residents_v1");
});
test("Invalid publications and revoked access cannot leave a partial post or notification", async () => {
  for (const [options, body, expected] of [[{}, {...schedule,date:"2099-02-30"},400], [{}, {...schedule,barangay:"Other"},400],
    [{}, {...schedule,time:"25:00"},400], [{signedOut:true},schedule,401], [{securityUnavailable:true},schedule,503], [{profile:{accessStatus:"suspended"}},schedule,403]]) {
    const app=fixture(options); await app.post(body,expected); assert.equal(app.records.size,1);
  }
});
test("Event publication includes a targeted notification and preserves certificate/attendance settings", async () => {
  const app=fixture(); await app.post({kind:"event",id:"cleanup",barangay:"Calawit",title:"Island cleanup",dateISO:"2099-10-17",startTime:"10:00",endTime:"12:00",certificateEnabled:false,attendanceMethod:"manual"});
  const event=app.records.get("events/cleanup"); assert.equal(event.certificateEnabled,false); assert.equal(event.attendanceMethod,"manual"); assert.equal(event.time,"10:00 - 12:00");
  assert.equal(app.records.get("notifications/event_cleanup").recipients,"Calawit"); assert.equal(app.pushes[0].data.type,"event");
});
test("Registration closes after the event's Manila end time and for completed/cancelled events", () => {
  const now=Date.parse("2026-10-17T12:00:00+08:00");
  const event={status:"Upcoming",dateISO:"2026-10-17",time:"10:00 - 13:00"};
  assert.equal(eventRegistrationClosed(event,now),false); assert.equal(eventRegistrationClosed({...event,time:"10:00 - 11:59"},now),true);
  for(const status of ["Draft","Completed","Finished","Cancelled","Archived"]) assert.equal(eventRegistrationClosed({...event,status},now),true);
});

test("An incomplete event draft can be resumed and published exactly once without premature notifications",async()=>{
  const app=fixture();
  const draft={id:"draft-cleanup",title:"Cleanup",barangay:"Sala",certificateEnabled:false};
  await app.draft(draft);assert.equal(app.records.get("events/draft-cleanup").status,"Draft");assert.equal(app.pushes.length,0);assert.equal(app.records.size,2);
  await app.draft({...draft,description:"Bring gloves"});assert.equal(app.records.get("events/draft-cleanup").description,"Bring gloves");
  const publish={...draft,kind:"event",dateISO:"2099-11-15",startTime:"9:00 AM",endTime:"12:00 PM"};
  await app.post(publish);await app.post(publish);
  assert.equal(app.records.get("events/draft-cleanup").status,"Upcoming");assert.equal(app.pushes.length,1);
  await app.draft(draft,409);
});

test("An event draft keeps the original cover filename and replaces it with the image", async () => {
  const app = fixture();
  const draft = { id: "cover-draft", title: "Lakeside clean-up", barangay: "Sala", certificateEnabled: false };
  const img = "https://res.cloudinary.com/example/image/upload/first.jpg";
  await app.draft({ ...draft, img, coverFileName: "C:\\fakepath\\Lakeside clean-up.jpg" });
  await app.draft({ ...draft, img, description: "Bring gloves." });
  assert.equal(app.records.get("events/cover-draft").coverFileName, "Lakeside clean-up.jpg");
  const replacement = "https://res.cloudinary.com/example/image/upload/second.webp";
  await app.draft({ ...draft, img: replacement, coverFileName: "Balete lakeshore.webp" });
  assert.equal(app.records.get("events/cover-draft").img, replacement);
  assert.equal(app.records.get("events/cover-draft").coverFileName, "Balete lakeshore.webp");
});

test("Revoked staff, barangay staff, and another official cannot overwrite an event draft",async()=>{
  const body={id:"draft",title:"Cleanup",barangay:"Sala",certificateEnabled:false};
  for(const options of [{signedOut:true},{profile:{role:"Semi-Admin",barangay:"Sala"}},{profile:{accessStatus:"suspended"}}]){
    const app=fixture(options);await app.draft(body,options.signedOut?401:403);assert.equal(app.records.size,1);
  }
  const app=fixture();app.records.set("events/draft",{status:"Draft",createdBy:"other-official"});await app.draft(body,409);
  await app.post({...body,kind:"event",dateISO:"2099-11-15",startTime:"09:00"},409);assert.equal(app.pushes.length,0);
});

test("Notification edits preserve the original delivery record and audience and publish one new update",async()=>{
  const app=fixture();await app.create(notice);const sent=app.records.get("notifications/stable-notice");
  await app.edit({id:notice.id,expectedRevision:0,title:"Updated collection",message:"Use green bags.",type:"schedule"});
  const updated=app.records.get("notifications/stable-notice");assert.equal(updated.message,"Use green bags.");assert.equal(updated.pushStatus,sent.pushStatus);assert.equal(updated.recipients,"Sala");assert.equal(app.pushes.length,2);
  await app.edit({id:notice.id,expectedRevision:0,title:"Stale edit",message:"Old copy",type:"schedule"},409);
  await app.edit({id:notice.id,expectedRevision:1,title:"Different audience",message:"Copy",type:"schedule",recipients:"Looc"},400);
  updated.pushStatus="sending";await app.edit({id:notice.id,expectedRevision:1,title:"Wait",message:"Copy",type:"schedule"},409);
  for(const profile of [{role:"Semi-Admin",barangay:"Sala"},{accessStatus:"suspended"}]){const denied=fixture({profile});await denied.edit({id:notice.id,expectedRevision:0},403);assert.equal(denied.records.size,1);}
});

test("New collections, event publication and drafts cannot backdate or use elapsed Philippine start times", async t => {
  t.mock.method(Date,"now",()=>Date.parse("2026-11-02T13:30:25+08:00"));
  for(const [date,time] of [["2026-11-01","23:59"],["2026-11-02","13:29"],["2026-11-02","13:30"]]) {
    const app=fixture();await app.post({...schedule,date,time},400);assert.equal(app.records.size,1);assert.equal(app.pushes.length,0);
    const event={id:"new-event",title:"Cleanup",barangay:"Sala",certificateEnabled:false,dateISO:date,startTime:time};
    await app.post({...event,kind:"event"},400);await app.draft(event,400);assert.equal(app.records.size,1);assert.equal(app.pushes.length,0);
  }
  const future=fixture();await future.post({...schedule,date:"2026-11-02",time:"13:31"});assert.equal(future.pushes.length,1);
  const draft=fixture();await draft.draft({id:"later",title:"Cleanup",barangay:"Sala",dateISO:"2026-11-03",startTime:"07:00",certificateEnabled:false});assert.equal(draft.pushes.length,0);
});

test("Publishing an expired saved draft fails, while retrying a committed publication remains safe", async t => {
  let now=Date.parse("2026-11-02T13:30:00+08:00");t.mock.method(Date,"now",()=>now);
  const app=fixture(),details={id:"expiring",title:"Cleanup",barangay:"Sala",dateISO:"2026-11-02",startTime:"13:31",certificateEnabled:false};
  await app.draft(details);now+=120_000;await app.post({...details,kind:"event"},400);
  assert.equal(app.records.get("events/expiring").status,"Draft");assert.equal(app.pushes.length,0);
  now-=120_000;await app.post({...details,kind:"event"});now+=120_000;await app.post({...details,kind:"event"});assert.equal(app.pushes.length,1);
});

const outcome={id:"collection",changeId:"intent-one",expectedRevision:0,expectedStatus:"Active",status:"Failed",notes:"Road blocked"};
const savedCollection={barangay:"Sala",date:"2026-11-01",time:"13:00",status:"Active",description:"Bring sorted bags"};

test("Each collection outcome atomically saves the actual audience's inbox notice and visible phone push", async()=>{
  for(const status of ["Completed","Failed","Unfinished","Active"]) {
    for(const barangay of ["Sala","All Barangays"]) {
      const app=fixture();app.records.set("schedules/collection",{...savedCollection,barangay,date:status==="Active"?"2099-11-01":savedCollection.date,status:status==="Active"?"Inactive":"Active"});
      const result=await app.manage({...outcome,status,expectedStatus:status==="Active"?"Inactive":"Active",recipients:"Looc"});
      assert.equal(result.saved,true);assert.equal(result.notified,true);assert.equal(result.queued,true);
      const saved=app.records.get("schedules/collection"),notice=app.records.get("notifications/"+result.notificationId);
      assert.equal(saved.status,status);assert.equal(saved.statusRevision,1);assert.equal(saved.description,savedCollection.description);
      assert.equal(notice.recipients,barangay);assert.equal(notice.sourceId,"collection");assert.equal(notice.pushStatus,"queued");
      assert.equal(app.pushes.length,1);assert.ok(app.pushes[0].notification.body.includes(status.toLowerCase()));
      assert.equal(app.pushes[0].topic,barangay==="Sala"?"trashtrack_barangay_sala_v1":"trashtrack_residents_v1");
    }
  }
});

test("Outcome retries and no-op saves do not duplicate notices, audit records or queued phone pushes", async()=>{
  const app=fixture();app.records.set("schedules/collection",{...savedCollection});
  const first=await app.manage(outcome),size=app.records.size;
  await app.manage(outcome);assert.equal(app.records.size,size);assert.equal(app.pushes.length,1);
  await app.manage({...outcome,notes:"A different request"},409);
  const unchanged=await app.manage({...outcome,changeId:"intent-two",expectedStatus:"Failed",expectedRevision:1});
  assert.equal(unchanged.notified,false);assert.equal(app.records.size,size);assert.equal(app.pushes.length,1);
  await app.manage({...outcome,changeId:"intent-three",expectedStatus:"Failed",expectedRevision:1,status:"Completed",notes:"Road cleared"});
  const laterSize=app.records.size;await app.manage(outcome);
  assert.equal(app.records.size,laterSize);assert.equal(app.records.get("schedules/collection").status,"Completed");assert.equal(app.pushes.length,2);
  assert.ok(app.records.has("notifications/"+first.notificationId));
});

test("A failed outcome push preserves the committed status/inbox and can retry the same notice",async()=>{
  const app=fixture({failFirstPush:true});app.records.set("schedules/collection",{...savedCollection});
  const result=await app.manage(outcome);assert.equal(result.saved,true);assert.equal(result.queued,false);assert.ok(result.deliveryError);
  assert.equal(app.records.get("schedules/collection").status,"Failed");assert.equal(app.records.get("notifications/"+result.notificationId).pushStatus,"failed");
  const size=app.records.size;assert.equal((await app.manage(outcome)).queued,true);assert.equal(app.records.size,size);assert.equal(app.pushes.length,2);
});

test("Stale revisions, invalid audiences and revoked outcome actors cannot create a status or notification",async()=>{
  for(const [options,body,saved,code] of [
    [{signedOut:true},outcome,savedCollection,401],
    [{profile:{role:"Semi-Admin",barangay:"Sala"}},outcome,savedCollection,403],
    [{profile:{accessStatus:"suspended"}},outcome,savedCollection,403],
    [{},{...outcome,expectedRevision:2},savedCollection,409],
    [{},outcome,{...savedCollection,barangay:"Unrecognized"},400],
    [{},{...outcome,notes:""},savedCollection,400],
  ]) {
    const app=fixture(options);app.records.set("schedules/collection",{...saved});const before=[...app.records].map(([path,value])=>[path,{...value}]);
    await app.manage(body,code);assert.deepEqual([...app.records],before);assert.equal(app.pushes.length,0);
  }
});

test("Historical outcomes can be recorded, but a dated collection cannot be reactivated in the past",async t=>{
  t.mock.method(Date,"now",()=>Date.parse("2026-11-02T13:30:25+08:00"));
  const app=fixture();app.records.set("schedules/collection",{...savedCollection,status:"Failed"});
  await app.manage({...outcome,expectedStatus:"Failed",status:"Active"},400);
  assert.equal(app.records.get("schedules/collection").status,"Failed");assert.equal(app.pushes.length,0);
  await app.manage({...outcome,expectedStatus:"Failed",status:"Completed",notes:"Collection finished"});
  assert.equal(app.records.get("schedules/collection").status,"Completed");assert.equal(app.pushes.length,1);
});

test("Editing a read announcement creates one fresh update with its original audience and category",async()=>{
  const app=fixture();await app.create(notice);
  const edit={id:notice.id,changeId:"stable-edit",expectedRevision:0,title:notice.title,message:notice.message,type:"event"};
  const result=await app.edit(edit);assert.equal(result.changed,true);assert.equal(result.queued,true);
  const update=app.records.get("notifications/"+result.notificationId);assert.equal(update.type,"event");assert.equal(update.recipients,"Sala");assert.equal(update.isRead,false);assert.equal(update.originalNotificationId,notice.id);
  assert.equal(app.pushes.length,2);assert.equal(app.pushes[1].topic,"trashtrack_barangay_sala_v1");assert.equal(app.pushes[1].data.type,"event");
  const count=app.records.size;await app.edit(edit);assert.equal(app.records.size,count);assert.equal(app.pushes.length,2);
  await app.edit({...edit,message:"Different payload"},409);
  const noChange=await app.edit({...edit,changeId:"no-op",expectedRevision:1});assert.equal(noChange.changed,false);assert.equal(app.records.size,count);
});

test("An in-app-only announcement edit stays in-app and cannot escalate its audience or push setting",async()=>{
  const app=fixture();await app.create({...notice,push:false});
  const edit={id:notice.id,changeId:"in-app-edit",expectedRevision:0,title:"Changed title",message:notice.message,type:"general"};
  const result=await app.edit(edit);assert.equal(result.queued,false);assert.equal(app.pushes.length,0);assert.equal(app.records.get("notifications/"+result.notificationId).pushStatus,"disabled");
  await app.edit({...edit,changeId:"escalation",expectedRevision:1,push:true},400);
});

test("Edited-notice phone failures keep the saved revision and retry the same new notice",async()=>{
  const app=fixture({failSecondPush:true});await app.create(notice);
  const edit={id:notice.id,changeId:"retry-updated-notice",expectedRevision:0,title:"Revised title",message:"Updated instructions",type:"event"};
  const first=await app.edit(edit);assert.equal(first.saved,true);assert.equal(first.queued,false);assert.ok(first.deliveryError);
  assert.equal(app.records.get("notifications/"+notice.id).revision,1);assert.equal(app.records.get("notifications/"+first.notificationId).pushStatus,"failed");
  const count=app.records.size;const second=await app.edit(edit);assert.equal(second.notificationId,first.notificationId);assert.equal(second.queued,true);assert.equal(app.records.size,count);assert.equal(app.pushes.length,3);
});
