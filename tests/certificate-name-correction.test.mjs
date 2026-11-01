import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import * as policy from "../src/lib/staff-access.ts";
import * as certificate from "../src/lib/certificate-data.ts";
const require=createRequire(import.meta.url),ts=require("typescript");
const code=ts.transpileModule(fs.readFileSync(new URL("../src/app/api/certificates/correct-name/route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const id=createHash("sha256").update("event\0resident").digest("hex");
function fixture(options={}) {
  const identity={uid:"menro",staffRole:"admin",email_verified:true,auth_time:Math.floor(Date.now()/1000)};
  const records=new Map([
    ["users/menro",{role:"Admin",accessStatus:"active",...options.actor}],
    ["users/resident",{name:"Maria Isabel Santos"}],
    ["events/event",{status:"Completed",certificateEnabled:true,...options.event}],
    ["registrations/event_resident",{eventId:"event",userId:"resident",attended:true,attendanceVerifiedBy:"menro",...options.registration}],
    ["certificates/"+id,{version:1,eventId:"event",userId:"resident",participantName:"Maria",eventTitle:"Saved title",issuedAt:"original date",...options.certificate}],
  ]);
  let sequence=0;
  const ref=path=>({path,collection:name=>({doc:key=>ref(path+"/"+name+"/"+key)})});
  const db={collection:name=>({doc:key=>ref(name+"/"+(key||"audit-"+(++sequence)))}),async runTransaction(action){const working=new Map(structuredClone([...records]));let wrote=false;const result=await action({get:async target=>{assert.equal(wrote,false);return {exists:working.has(target.path),data:()=>structuredClone(working.get(target.path))};},create:(target,value)=>{wrote=true;assert.equal(working.has(target.path),false);working.set(target.path,value);},update:(target,value)=>{wrote=true;working.set(target.path,{...working.get(target.path),...value});}});records.clear();for(const [key,value] of working)records.set(key,value);return result;}};
  const modules={"firebase-admin/firestore":{FieldValue:{serverTimestamp:()=>"server-time"}},"@/lib/staff-access":policy,"@/lib/certificate-data":certificate,"@/lib/staff-auth":{authenticatedStaff:async(req,master,recent)=>{assert.equal(master,true);if(options.signedOut)throw new policy.StaffAccessError("Sign in",401);if(options.stale&&recent)throw new policy.StaffAccessError("Confirm sign in",401);return {db,identity};},requireStaffSecurity:async()=>{},staffApiError:error=>Response.json({error:error.message},{status:error.status||500})}};
  const endpoint={};new Function("require","exports",code)(name=>modules[name]||require(name),endpoint);
  return {records,async post(body={},status=200){const response=await endpoint.POST(new Request("http://localhost/api/certificates/correct-name",{method:"POST",body:JSON.stringify({action:"inspect",eventId:"event",userId:"resident",expectedName:"Maria Isabel Santos",...body})}));const result=await response.json();assert.equal(response.status,status,result.error);return result;}};
}
test("Name review is read-only and shows the full authoritative profile name against the issued snapshot",async()=>{
  const app=fixture(),before=structuredClone([...app.records]);const result=await app.post();assert.deepEqual(result,{issuedName:"Maria",profileName:"Maria Isabel Santos",revision:0,canCorrect:true});assert.deepEqual([...app.records],before);
});
test("Confirmed correction archives the prior snapshot and audits the exact name change without altering event details",async()=>{
  const app=fixture();await app.post({action:"correct",expectedRevision:0,identityConfirmed:true});const saved=app.records.get("certificates/"+id);
  assert.equal(saved.participantName,"Maria Isabel Santos");assert.equal(saved.eventTitle,"Saved title");assert.equal(saved.issuedAt,"original date");assert.equal(saved.revision,1);
  assert.equal(app.records.get("certificates/"+id+"/revisions/0").participantName,"Maria");assert.ok([...app.records.values()].some(row=>row.action==="certificate.correctName"&&row.from==="Maria"&&row.to==="Maria Isabel Santos"));
  const before=structuredClone([...app.records]);await app.post({action:"correct",expectedRevision:0,identityConfirmed:true});assert.deepEqual([...app.records],before);
});
test("Unauthenticated, stale, revoked, unconfirmed and ineligible correction requests leave issued records intact",async()=>{
  for(const [options,body,status] of [[{signedOut:true},{},401],[{stale:true},{},401],[{actor:{accessStatus:"suspended"}},{},403],[{registration:{attended:false}},{},403],[{event:{status:"Upcoming"}},{},409],[{}, {identityConfirmed:false},400],[{}, {expectedRevision:3},409],[{}, {expectedName:"Changed since review"},409]]) {
    const app=fixture(options),before=structuredClone([...app.records]);await app.post({action:"correct",expectedRevision:0,identityConfirmed:true,...body},status);assert.deepEqual([...app.records],before);
  }
});
