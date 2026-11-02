import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import * as access from "../src/lib/staff-access.ts";
import * as progress from "../src/lib/report-progress.ts";
const require=createRequire(import.meta.url),ts=require("typescript");
const compile=path=>ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const routeCode=compile("../src/app/api/resident-notifications/route.ts"),deliveryCode=compile("../src/lib/resident-notification-delivery.ts");
function fixture({role="Resident",signedOut=false,providerFails=false,invalid=false,noDevices=false,suspendedRecipient=false}={}) {
 const notice={...progress.reportProgressEntry("report-one","owner","Endorsed","Admin","Truck assigned",{actionKind:"Collection",actionNotes:"Keep bags secured.",actionDate:"2099-11-04",actionTime:"13:00"},3),pushStatus:"pending"};
 const store=new Map([["resident_notifications/one",notice],["resident_notifications/other",{...notice,recipientId:"another-resident"}]]);
 store.set("users/owner",{role:"Resident",accessStatus:suspendedRecipient?"suspended":"active"});
 if(!noDevices){store.set("push_devices/owner1",{userId:"owner",token:"owner-token-1"});store.set("push_devices/owner2",{userId:"owner",token:"owner-token-2"});store.set("push_devices/other",{userId:"another-resident",token:"never-send-here"});}
 const ref=path=>({path,id:path.split("/").at(-1),get:async()=>snap(path),set:async data=>store.set(path,data),update:async data=>store.set(path,{...store.get(path),...data}),delete:async()=>store.delete(path)});
 const snap=path=>({ref:ref(path),id:path.split("/").at(-1),exists:store.has(path),data:()=>structuredClone(store.get(path))});
 const query=(name,filter,maximum)=>({collection:name,filter,maximum,doc:id=>ref(name+"/"+id),where:(field,op,value)=>query(name,{field,value},maximum),limit:limit=>query(name,filter,limit),get:async()=>read(name,filter,maximum)});
 function read(name,filter,maximum){return {docs:[...store.keys()].filter(path=>path.startsWith(name+"/")&&(!filter||store.get(path)[filter.field]===filter.value)).slice(0,maximum).map(snap)};}
 const db={collection:name=>query(name),runTransaction:async action=>{let wrote=false;return action({get:async r=>{assert.equal(wrote,false);return r.collection?read(r.collection,r.filter,r.maximum):snap(r.path);},update:(r,d)=>{wrote=true;store.set(r.path,{...store.get(r.path),...d});}});}};
 const sends=[],retried=[];
 const modules={"firebase-admin/firestore":{FieldValue:{serverTimestamp:()=>"server timestamp"}},"firebase-admin/messaging":{getMessaging:()=>({sendEach:async messages=>{sends.push(...messages);if(providerFails)throw Error("Provider unavailable");return {successCount:invalid?0:messages.length,responses:messages.map(()=>invalid?{success:false,error:{code:"messaging/registration-token-not-registered"}}:{success:true})};}})},"./report-progress":progress,
 "@/lib/staff-access":access,"@/lib/staff-auth":{authenticatedAccount:async()=>{if(signedOut)throw new access.StaffAccessError("Sign in",401);return {db,identity:{uid:"owner"},profile:{role}};},requireStaffSecurity:async()=>{},staffApiError:error=>Response.json({error:error.message},{status:error.status||500})},"@/lib/resident-notification-delivery":{queueResidentNotification:async(app,db,id)=>retried.push(id)}};
 const delivery={},route={};for(const [code,exports] of [[deliveryCode,delivery],[routeCode,route]])new Function("require","exports",code)(name=>modules[name]||require(name),exports);
 return {store,sends,retried,deliver:()=>delivery.queueResidentNotification({},db,"one"),post:async(body,status=200)=>{const response=await route.POST(new Request("http://localhost/api/resident-notifications",{method:"POST",body:JSON.stringify(body)}));const data=await response.json();assert.equal(response.status,status,data.error);return data;}};
}
test("Personal report pushes target only the owner's registered devices and have no public topic/background auto-display payload",async()=>{
 const app=fixture();await app.deliver();assert.deepEqual(app.sends.map(x=>x.token),["owner-token-1","owner-token-2"]);
 for(const message of app.sends){assert.equal(message.topic,undefined);assert.equal(message.notification,undefined);assert.equal(message.data.recipientId,"owner");assert.match(message.data.message,/1:00 PM/);}
 assert.equal(app.store.get("resident_notifications/one").pushStatus,"queued");await app.deliver();assert.equal(app.sends.length,2);
});
test("Missing devices and provider failures keep the private progress inbox durable and retryable",async()=>{
 const absent=fixture({noDevices:true});await absent.deliver();assert.equal(absent.store.get("resident_notifications/one").pushStatus,"pending");assert.equal(absent.sends.length,0);
 const failed=fixture({providerFails:true});await assert.rejects(()=>failed.deliver());assert.equal(failed.store.get("resident_notifications/one").pushStatus,"failed");assert.equal(failed.store.get("resident_notifications/one").actionNotes,"Keep bags secured.");
});
test("Permanently invalid owner tokens are removed without touching another resident's registration",async()=>{
 const app=fixture({invalid:true});await app.deliver();assert.ok(!app.store.has("push_devices/owner1"));assert.ok(app.store.has("push_devices/other"));
});
test("Device registration ignores a forged owner and private retry only resumes notices owned by the authenticated resident",async()=>{
 const app=fixture(),token="test-token-"+"A".repeat(80);await app.post({action:"register",token,userId:"another-resident"});const record=app.store.get("push_devices/"+createHash("sha256").update(token).digest("hex"));assert.equal(record.userId,"owner");assert.deepEqual(app.retried,["one"]);
});
test("Signed-out/staff callers and invalid tokens cannot register devices",async()=>{
 await fixture({signedOut:true}).post({action:"retry"},401);await fixture({role:"Admin"}).post({action:"register",token:"A".repeat(100)},403);await fixture().post({action:"register",token:"invalid"},400);
});
test("A suspended report owner receives no phone payload even when a token was registered earlier",async()=>{
 const app=fixture({suspendedRecipient:true});await app.deliver();assert.equal(app.sends.length,0);assert.equal(app.store.get("resident_notifications/one").pushStatus,"disabled");
});
