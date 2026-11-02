// Exercise real API transactions without writing to Firebase or sending messages.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import * as access from "../src/lib/staff-access.ts";
import * as schedule from "../src/lib/schedule-policy.ts";
import * as publication from "../src/lib/community-publication.ts";
import * as clock from "../src/lib/scheduling-time.ts";
import * as workflow from "../src/lib/report-workflow.ts";
import * as collectionNotice from "../src/lib/collection-outcome-notice.ts";
import * as feedback from "../src/lib/system-feedback.ts";
import {notificationCategory,matchesDeliveryFilter,DELIVERY_FILTER_LABELS} from "../src/lib/notification-categories.ts";
import {learningCover} from "../src/lib/learning-resource.ts";
import {matchesFirestorePolicy} from "../src/lib/security-policy.ts";
const require=createRequire(import.meta.url),ts=require("typescript");
const compile=file=>ts.transpileModule(fs.readFileSync(new URL("../src/app/api/"+file+"/route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const compiled={collections:compile("schedules/change"),feedback:compile("feedback")};

function fixture({role="Admin",currentRole=role,pushFails=false,suspended=false}={}) {
  const profile={role,barangay:role==="Admin"?"":"Poblacion",accessStatus:"active",name:"Test Person"};
  const identity={uid:"actor",email_verified:true,auth_time:Math.floor(Date.now()/1000),staffRole:access.staffRole(role),staffBarangay:profile.barangay};
  const records=new Map([["users/actor",{...profile,role:currentRole,...(suspended?{accessStatus:"suspended"}:{})}],["schedules/one",{barangay:"Poblacion",date:"2099-11-04",day:"Wednesday",time:"07:00",description:"Bring sorted waste",status:"Active",statusRevision:0}]]);
  let sequence=0;
  const reference=path=>({path,id:path.split("/").at(-1),get:async()=>snapshot(path,records)});
  const snapshot=(path,store)=>({id:path.split("/").at(-1),ref:reference(path),exists:store.has(path),data:()=>structuredClone(store.get(path))});
  const query=(name,filters=[],order,maximum,cursor)=>({
    collection:name,filters,order,maximum,cursor,
    where:(field,operator,value)=>query(name,[...filters,{field,value}],order,maximum,cursor),
    orderBy:(field,direction)=>query(name,filters,{field,direction},maximum,cursor),
    limit:size=>query(name,filters,order,size,cursor),startAfter:snap=>query(name,filters,order,maximum,snap.id),
    doc:id=>reference(name+"/"+(id||"generated-"+(++sequence))),
    get:async()=>readQuery({collection:name,filters,order,maximum,cursor},records),
    count:()=>({get:async()=>({data:()=>({count:readQuery({collection:name,filters},records).docs.length})})}),
  });
  function readQuery(ref,store) {
    let entries=[...store].filter(([path,data])=>path.startsWith(ref.collection+"/")&&(ref.filters||[]).every(f=>data[f.field]===f.value));
    if(ref.order)entries.sort((a,b)=>(String(a[1][ref.order.field]||"").localeCompare(String(b[1][ref.order.field]||"")))*(ref.order.direction==="desc"?-1:1));
    if(ref.cursor)entries=entries.slice(entries.findIndex(([path])=>path.split("/").at(-1)===ref.cursor)+1);
    if(ref.maximum)entries=entries.slice(0,ref.maximum);
    return {empty:!entries.length,docs:entries.map(([path])=>snapshot(path,store))};
  }
  const db={collection:name=>query(name),async runTransaction(action){
    const working=new Map(structuredClone([...records]));let wrote=false;
    const result=await action({get:async ref=>{assert.equal(wrote,false,"Firestore transaction must finish all reads before writes");return ref.collection?readQuery(ref,working):snapshot(ref.path,working);},
      create:(ref,data)=>{wrote=true;assert.equal(working.has(ref.path),false);working.set(ref.path,data);},
      update:(ref,data)=>{wrote=true;assert.ok(working.has(ref.path));working.set(ref.path,{...working.get(ref.path),...data});},
      set:(ref,data)=>{wrote=true;working.set(ref.path,data);},delete:ref=>{wrote=true;working.delete(ref.path);}});
    records.clear();for(const [key,value] of working)records.set(key,value);return result;
  }};
  const checkStaff=(_request,account,masterOnly)=>{
    const issue=access.staffAccessProblem(account.profile,identity);
    if(issue||masterOnly&&role!=="Admin")throw new access.StaffAccessError(issue||"MENRO only");return account;
  };
  const account={db,identity,profile};
  const modules={"firebase-admin/firestore":{FieldValue:{serverTimestamp:()=>"timestamp"}},"@/lib/staff-auth":{
    authenticatedAccount:async()=>account,authenticatedStaff:async(request,master)=>checkStaff(request,account,master),requireApprovedStaff:checkStaff,requireStaffSecurity:async()=>{},staffApiError:error=>Response.json({error:error.message},{status:error instanceof access.StaffAccessError?error.status:500})},
    "@/lib/staff-access":access,"@/lib/schedule-policy":schedule,"@/lib/community-publication":publication,"@/lib/scheduling-time":clock,"@/lib/report-workflow":workflow,"@/lib/system-feedback":feedback,"@/lib/collection-outcome-notice":collectionNotice,"@/lib/notification-delivery":{queuePhoneNotification:async()=>{if(pushFails)throw Error("Provider unavailable");}}};
  const routes={};for(const [name,source] of Object.entries(compiled)){routes[name]={};new Function("require","exports",source)(name=>modules[name]||require(name),routes[name]);}
  async function invoke(kind,body,expected=200,url="") {
    const result=await routes[kind][body?"POST":"GET"](new Request("http://localhost/api/"+kind+url,{...(body?{method:"POST",body:JSON.stringify(body)}:{})}));
    const data=await result.json();assert.equal(result.status,expected,data.error);return data;
  }
  const edit={action:"edit",id:"one",changeId:"change-1",expectedStatus:"Active",expectedRevision:0,date:"2099-11-05",time:"08:00",barangay:"Poblacion",description:"New collection details"};
  return {records,invoke,edit};
}

test("Collection edits update linked open actions, preserve original planning dates, and retry once",async()=>{
  const app=fixture();app.records.set("reports/report1",{location:"Poblacion",status:"Endorsed",scheduleId:"one",actionDate:"2099-11-04",actionTime:"07:00",statusRevision:4});
  const result=await app.invoke("collections",app.edit);assert.equal(result.saved,true);
  const notice=[...app.records].find(([key])=>key.startsWith("notifications/"))[1];assert.match(notice.message,/8:00 AM/);assert.match(notice.message,/7:00 AM/);
  const report=app.records.get("reports/report1");assert.equal(report.actionDate,"2099-11-05");assert.equal(report.originalActionDate,"2099-11-04");assert.equal(report.statusRevision,5);assert.equal(report.status,"Endorsed");
  const saved=structuredClone([...app.records]);await app.invoke("collections",app.edit);assert.deepEqual([...app.records],saved);
});
test("Completed collections reject edits, follow-ups and deletes even from direct requests",async()=>{
  for(const action of ["edit","followup","delete"]){const app=fixture();app.records.get("schedules/one").status="Completed";const saved=structuredClone([...app.records]);await app.invoke("collections",{...app.edit,action,expectedStatus:"Completed"},409);assert.deepEqual([...app.records],saved);}
});
test("Past slots, conflicts, stale edits, incompatible barangays and revoked roles leave no partial collection change",async()=>{
  for(const scenario of ["past","duplicate","stale","scope","revoked","semi"]){const app=fixture({...(scenario==="revoked"?{currentRole:"Resident"}:{}),...(scenario==="semi"?{role:"Semi-Admin"}:{})});const body={...app.edit};
    if(scenario==="past")body.date="2020-01-01";
    if(scenario==="duplicate")app.records.set("schedules/occupied",{date:body.date,barangay:"All Barangays",status:"Active"});
    if(scenario==="stale")body.expectedRevision=2;
    if(scenario==="scope"){app.records.set("reports/report1",{scheduleId:"one",location:"Poblacion",status:"Endorsed"});body.barangay="Sala";}
    const saved=structuredClone([...app.records]);await app.invoke("collections",body,["semi","revoked"].includes(scenario)?403:scenario==="past"?400:409);assert.deepEqual([...app.records],saved);
  }
});
test("Failed old collection follow-up preserves its outcome and moves only unresolved reports",async()=>{
  const app=fixture();Object.assign(app.records.get("schedules/one"),{date:"2020-01-01",status:"Failed",statusNotes:"Road blocked"});
  app.records.set("reports/open",{scheduleId:"one",location:"Poblacion",status:"Endorsed"});app.records.set("reports/closed",{scheduleId:"one",location:"Poblacion",status:"Resolved",actionDate:"2020-01-01"});
  const result=await app.invoke("collections",{...app.edit,action:"followup",expectedStatus:"Failed"});assert.notEqual(result.scheduleId,"one");assert.equal(app.records.get("schedules/one").status,"Failed");assert.equal(app.records.get("schedules/one").statusNotes,"Road blocked");assert.equal(app.records.get("reports/open").scheduleId,result.scheduleId);assert.equal(app.records.get("reports/closed").scheduleId,"one");
  const notice=[...app.records].find(([key])=>key.startsWith("notifications/"))[1];assert.equal(notice.outcomeNotes,"Road blocked");assert.match(notice.message,/Outcome notes: Road blocked/);
});
test("Deletion protects linked reports; allowed deletions have cancellation notices and idempotent retries",async()=>{
  const app=fixture();app.records.set("reports/linked",{scheduleId:"one",location:"Poblacion"});await app.invoke("collections",{...app.edit,action:"delete"},409);app.records.delete("reports/linked");
  await app.invoke("collections",{...app.edit,action:"delete"});assert.equal(app.records.has("schedules/one"),false);const saved=structuredClone([...app.records]);await app.invoke("collections",{...app.edit,action:"delete"});assert.deepEqual([...app.records],saved);assert.ok([...app.records.values()].some(value=>value.title==="Collection cancelled"));
});
test("A change of collection audience informs both affected barangays, while a push failure keeps the save",async()=>{
  const app=fixture({pushFails:true});const result=await app.invoke("collections",{...app.edit,barangay:"Sala"});assert.equal(result.deliveryPending,true);const audiences=[...app.records].filter(([key])=>key.startsWith("notifications/")).map(([,value])=>value.recipients).sort();assert.deepEqual(audiences,["Poblacion","Sala"]);assert.equal(app.records.get("schedules/one").barangay,"Sala");
});
test("Resident feedback is private, server-attributed, rate-limited and safe to retry after a lost response",async()=>{
  const app=fixture({role:"Resident"});const body={submissionId:"feedback-0001",message:"The report screen could explain its required fields better.",category:"Suggestion",appVersion:"1.0.6",residentId:"forged",status:"Closed"};
  const result=await app.invoke("feedback",body);const data=app.records.get("system_feedback/"+result.id);assert.equal(data.residentId,"actor");assert.equal(data.status,"New");assert.equal(data.residentName,"Test Person");assert.equal(data.barangay,"Poblacion");
  const saved=structuredClone([...app.records]);await app.invoke("feedback",body);assert.deepEqual([...app.records],saved);await app.invoke("feedback",{...body,message:"Different content for the same request is not accepted."},409);await app.invoke("feedback",{...body,submissionId:"feedback-0002"},429);
  const receipt=await app.invoke("feedback",null,200,"?id="+result.id);assert.equal(receipt.status,"New");await app.invoke("feedback",null,403);app.records.set("system_feedback/someone_else",{residentId:"another",status:"New"});await app.invoke("feedback",null,404,"?id=someone_else");
});
test("Staff and suspended residents cannot submit feedback and input boundaries are enforced",async()=>{
  const body={submissionId:"feedback-0001",message:"A helpful resident suggestion goes here.",category:"Bug"};
  for(const options of [{role:"Admin"},{role:"Semi-Admin"},{role:"Resident",suspended:true}])await fixture(options).invoke("feedback",body,403);
  for(const changed of [{message:"too short"},{message:"x".repeat(2001)},{category:"Injected"},{submissionId:"../bad"}])await fixture({role:"Resident"}).invoke("feedback",{...body,...changed},400);
});
test("MENRO can review and close feedback with revision checks; other staff cannot read the inbox",async()=>{
  const app=fixture();app.records.set("system_feedback/entry",{residentId:"resident1",residentName:"Resident",barangay:"Sala",message:"Useful feedback for the system",category:"Other",appVersion:"1.0.6",status:"New",revision:0,createdAt:"timestamp"});
  app.records.set("feedback_view_new/entry",structuredClone(app.records.get("system_feedback/entry")));
  const page=await app.invoke("feedback",null);assert.equal(page.items.length,1);assert.equal(page.newCount,1);
  const update={action:"update",id:"entry",status:"Reviewed",expectedRevision:0};await app.invoke("feedback",update);const saved=structuredClone([...app.records]);await app.invoke("feedback",update);assert.deepEqual([...app.records],saved);await app.invoke("feedback",{...update,status:"Closed"},409);await app.invoke("feedback",{...update,status:"Closed",expectedRevision:1});
  for(const role of ["Semi-Admin","Resident"])await fixture({role}).invoke("feedback",null,403);
});
test("Notification categories and delivery filters handle aliases and do not confuse in-app messages with pending sends",()=>{
  assert.equal(notificationCategory("Collection Schedule"),"schedule");assert.equal(notificationCategory("report_update"),"report");assert.equal(notificationCategory("EVENTS"),"event");assert.equal(notificationCategory("legacy-unknown"),"unknown");
  assert.equal(matchesDeliveryFilter({push:false,pushStatus:"pending"},"in-app"),true);assert.equal(matchesDeliveryFilter({push:false,pushStatus:"pending"},"pending"),false);assert.equal(matchesDeliveryFilter({push:true,pushStatus:"sending"},"sending"),true);assert.equal(matchesDeliveryFilter({push:true,pushStatus:"queued"},"sent"),true);assert.equal(DELIVERY_FILTER_LABELS["in-app"],"In-app only");
});
test("Learning covers derive from source images, PDF pages and video frames without inventing unrelated photos",()=>{
  assert.equal(learningCover({fileUrl:"https://files.example/guide.jpg"}),"https://files.example/guide.jpg");
  assert.match(learningCover({fileUrl:"https://res.cloudinary.com/demo/image/upload/v1/guide.pdf"}),/pg_1.*guide\.jpg$/);
  assert.match(learningCover({videoUrl:"https://res.cloudinary.com/demo/video/upload/v1/lesson.mp4"}),/so_0.*lesson\.jpg$/);
  assert.equal(learningCover({fileUrl:"https://res.cloudinary.com/demo/raw/upload/v1/guide.pdf"}),null);assert.equal(learningCover({fileUrl:"https://files.example/unknown.pdf"}),null);
});

test("The production policy content pin rejects changed permissions even under the old configured UUID",()=>{
  const content=fs.readFileSync(new URL("../security/firestore.rules",import.meta.url),"utf8");
  assert.equal(matchesFirestorePolicy({name:"new-publication-id",source:[{content}]},"configured-id","trashtrackprod"),true);
  assert.equal(matchesFirestorePolicy({name:"configured-id",source:[{content:content.replace("allow read, write: if false;","allow read, write: if true;")}]},"configured-id","trashtrackprod"),false);
  assert.equal(matchesFirestorePolicy({name:"configured-id",source:[{content},{content:"unreviewed extra source"}]},"configured-id","trashtrackprod"),false);
  assert.equal(matchesFirestorePolicy({name:"configured-id",source:[{content}]},"","trashtrackprod"),false);
  assert.equal(matchesFirestorePolicy({name:"configured-id",source:[]},"configured-id","isolated-other-project"),true);
});
