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
const require = createRequire(import.meta.url), ts = require("typescript");
const compile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const routeCode = compile("../src/app/api/community/publish/route.ts");
const deliveryCode = compile("../src/lib/notification-delivery.ts");
const sendCode = compile("../src/app/api/notifications/send/route.ts");
const createNoticeCode = compile("../src/app/api/notifications/create/route.ts");
const schedule = { kind: "schedule", id: "test-schedule", barangay: "Sala", date: "2099-10-17", time: "08:00", description: "Roadside pickup" };

function fixture(options = {}) {
  const profile = { role: "Admin", accessStatus: "active", ...options.profile };
  const identity = { uid: "menro", staffRole: policy.staffRole(profile.role), staffBarangay: profile.barangay || "", email_verified: true, auth_time: Math.floor(Date.now()/1000) };
  const records = new Map([["users/menro", profile]]), pushes = [];
  let failed = false;
  class Timestamp { constructor(value = Date.now()) { this.value = value; } toMillis() { return this.value; } }
  const ref = path => ({ path, id: path.split("/").at(-1), get: async () => ({ data: () => records.get(path) }), update: async value => { records.set(path, { ...records.get(path), ...value }); } });
  const db = { collection: name => ({ doc: id => ref(name + "/" + id), where:(field,op,value) => ({collection:name,field,value}) }), async runTransaction(callback) {
    const working = new Map([...records].map(([key, value]) => [key, { ...value }]));
    const result = await callback({ get: async target => target.collection ? ({docs:[...working].filter(([path,value]) => path.startsWith(target.collection+"/") && value[target.field] === target.value).map(([path,value]) => ({id:path.split("/")[1],data:()=>value}))}) : ({ exists: working.has(target.path), data: () => working.get(target.path) }),
      set: (target,value) => {working.set(target.path,value);},
      create: (target, value) => { assert.equal(working.has(target.path), false); working.set(target.path, value); },
      update: (target, value) => { assert.ok(working.has(target.path)); working.set(target.path, { ...working.get(target.path), ...value }); } });
    records.clear(); for (const [key, value] of working) records.set(key, value);
    return result;
  } };
  const staffAuth = { authenticatedStaff: async () => { if (options.signedOut) throw new policy.StaffAccessError("Sign in",401); return { app: {}, db, identity, profile }; },
    requireStaffSecurity: async () => { if (options.securityUnavailable) throw new policy.StaffAccessError("Setup unavailable",503); },
    staffApiError: error => Response.json({ error: error.message }, { status: error.status || 500 }) };
  const modules = { "firebase-admin/firestore": { Timestamp, FieldValue: { serverTimestamp: () => new Timestamp() } },
    "firebase-admin/messaging": { getMessaging: () => ({ send: async payload => {
      pushes.push(payload); if (options.failFirstPush && !failed) { failed = true; throw new Error("Messaging unavailable"); } return "test-message";
    } }) }, "./barangay-geofence": { BALETE_BARANGAYS: policy.STAFF_BARANGAYS }, "./phone-push": { buildPhonePush }, "./staff-access": policy,
    "@/lib/staff-auth": staffAuth, "@/lib/staff-access": policy, "@/lib/schedule-policy": schedules, "@/lib/community-publication": { communityPublication }, "@/lib/certificate-data": certificates,
    "@/lib/notification-publication": { notificationPublication } };
  const delivery = {}; new Function("require","exports",deliveryCode)(name => modules[name] || require(name), delivery);
  modules["@/lib/notification-delivery"] = delivery;
  const route = {}; new Function("require","exports",routeCode)(name => modules[name] || require(name), route);
  const send = {}; new Function("require","exports",sendCode)(name => modules[name] || require(name), send);
  const createNotice = {}; new Function("require","exports",createNoticeCode)(name => modules[name] || require(name), createNotice);
  return { records, pushes, async create(body, expected = 200) {
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
  for(const status of ["Completed","Finished","Cancelled","Archived"]) assert.equal(eventRegistrationClosed({...event,status},now),true);
});
