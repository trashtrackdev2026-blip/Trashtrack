import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as policy from "../src/lib/staff-access.ts";
import * as schedules from "../src/lib/schedule-policy.ts";
import * as certificates from "../src/lib/certificate-data.ts";
import * as edits from "../src/lib/event-edit.ts";
const require = createRequire(import.meta.url), ts = require("typescript");
const compile = file => ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const scheduleRoute = compile("../src/app/api/schedules/manage/route.ts");
const eventRoute = compile("../src/app/api/events/manage/route.ts");

function fixture(options = {}) {
  const identity = {uid:"menro",staffRole:"admin",email_verified:true,auth_time:Math.floor(Date.now()/1000)};
  const records = new Map([
    ["users/menro",{role:"Admin",accessStatus:"active",...options.actor}],
    ["schedules/one",{date:"2099-10-31",barangay:"Sala",status:"Active",...options.schedule}],
    ["events/one",{title:"Original event",barangay:"Sala",status:"Upcoming",participants:27,availableSlots:13,certificateEnabled:true,attendanceMethod:"qr",certificateSignatory:"Test Signatory",...options.event}],
    ...(options.extra || []),
  ]);
  let sequence=0;
  const db = {collection:name => ({doc:id => ({path:name+"/"+(id || "audit-"+(++sequence))}),where:(field,op,value) => ({collection:name,field,value})}),
    async runTransaction(action) {
      const working=new Map(structuredClone([...records]));let wrote=false;
      const result=await action({get:async target => {
        assert.equal(wrote,false,"Firestore requires all reads before writes");
        if(target.collection) return {docs:[...working].filter(([path,value]) => path.startsWith(target.collection+"/") && value[target.field]===target.value).map(([path,value]) => ({id:path.split("/")[1],data:()=>structuredClone(value)}))};
        return {exists:working.has(target.path),data:()=>structuredClone(working.get(target.path))};
      },set:(ref,value)=>{wrote=true;working.set(ref.path,value);},update:(ref,value)=>{wrote=true;assert.ok(working.has(ref.path));working.set(ref.path,{...working.get(ref.path),...value});},create:(ref,value)=>{wrote=true;assert.equal(working.has(ref.path),false);working.set(ref.path,value);}});
      records.clear();for(const [path,value] of working)records.set(path,value);return result;
    }};
  const errorResponse = error => Response.json({error:error.message},{status:error.status||500});
  const check = () => {if(options.signedOut)throw new policy.StaffAccessError("Sign in",401);};
  const modules={
    "firebase-admin/firestore":{FieldValue:{serverTimestamp:()=>"server-time"}},
    "@/lib/staff-auth":{authenticatedStaff:async(request,adminOnly)=>{check();assert.equal(adminOnly,true);return {db,identity};},requireStaffSecurity:async()=>{},staffApiError:errorResponse},
    "@/lib/staff-access":policy,"@/lib/schedule-policy":schedules,"@/lib/certificate-data":certificates,"@/lib/event-edit":edits,
    "@/lib/firebase-request-auth":{authenticatedResident:async(request,adminOnly)=>{check();assert.equal(adminOnly,true);return {db,identity,profile:records.get("users/menro")};},certificateApiError:errorResponse},
    "@/lib/certificate-security":{requireCertificateSecurity:async()=>{}},"@/lib/event-qr-data":{},"@/lib/event-lifecycle":{},
  };
  const load = code => {const exports={};new Function("require","exports",code)(name=>modules[name]||require(name),exports);return exports;};
  const endpoints={schedules:load(scheduleRoute),events:load(eventRoute)};
  return {records, async post(kind,body,expected=200){const result=await endpoints[kind].POST(new Request("http://localhost/api/"+kind+"/manage",{method:"POST",body:JSON.stringify(body)}));const payload=await result.json();assert.equal(result.status,expected,payload.error);return payload;}};
}

test("Collection outcomes save audit and date reservation without overwriting the schedule", async () => {
  const app=fixture();await app.post("schedules",{id:"one",expectedStatus:"Active",status:"Unfinished",notes:"Road blocked"});
  assert.equal(app.records.get("schedules/one").status,"Unfinished");assert.equal(app.records.get("schedules/one").statusNotes,"Road blocked");
  assert.equal(app.records.get("schedules/one").date,"2099-10-31");assert.equal(app.records.get("schedule_days/2099-10-31").revision,1);
  assert.ok([...app.records.values()].some(row=>row.action==="schedule.status"&&row.actor==="menro"&&row.from==="Active"&&row.to==="Unfinished"));
});

test("Stale outcomes, revoked actors and unsigned requests make no writes", async () => {
  for(const [options,body,status] of [
    [{},{id:"one",expectedStatus:"Completed",status:"Active"},409],
    [{actor:{accessStatus:"suspended"}},{id:"one",expectedStatus:"Active",status:"Completed"},403],
    [{signedOut:true},{id:"one",expectedStatus:"Active",status:"Completed"},401],
    [{},{id:"one",expectedStatus:"Active",status:"Failed",notes:""},400],
  ]){const app=fixture(options),before=structuredClone([...app.records]);await app.post("schedules",body,status);assert.deepEqual([...app.records],before);}
});

test("Reactivating a released collection cannot steal an occupied date, but old duplicates can be closed", async () => {
  const extra=[["schedules/two",{date:"2099-10-31",barangay:"Sala",status:"Active"}]];
  const blocked=fixture({schedule:{status:"Failed"},extra});
  await blocked.post("schedules",{id:"one",expectedStatus:"Failed",status:"Active"},409);
  assert.equal(blocked.records.get("schedules/one").status,"Failed");
  const legacy=fixture({extra});await legacy.post("schedules",{id:"one",expectedStatus:"Active",status:"Completed"});
  assert.equal(legacy.records.get("schedules/one").status,"Completed");
});

test("Event edit endpoint keeps attendance and certificates while applying validated details", async () => {
  const app=fixture();const details={action:"edit",eventId:"one",title:"Updated clean-up",barangay:"Makina",dateISO:"2099-11-01",startTime:"07:00",endTime:"09:00",description:"Updated details",participants:0,certificateEnabled:false,status:"Completed"};
  await app.post("events",details);
  const event=app.records.get("events/one");assert.equal(event.title,details.title);assert.equal(event.barangay,"Makina");
  assert.equal(event.participants,27);assert.equal(event.availableSlots,13);assert.equal(event.certificateEnabled,true);assert.equal(event.attendanceMethod,"qr");assert.equal(event.status,"Upcoming");
  assert.equal(event.updatedBy,"menro");assert.equal(event.time,"07:00 - 09:00");
  await app.post("events",{...details,endTime:"06:00"},400);
  assert.equal(app.records.get("events/one").time,"07:00 - 09:00");
  await fixture({event:{status:"Completed"}}).post("events",details,409);
});
