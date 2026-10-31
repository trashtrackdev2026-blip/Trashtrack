import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import * as access from "../src/lib/staff-access.ts";
import {residentProfileEdit} from "../src/lib/resident-profile.ts";
const require=createRequire(import.meta.url),ts=require("typescript");
const code=ts.transpileModule(fs.readFileSync(new URL("../src/app/api/residents/profile/route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

function fixture(options={}){
 const records=new Map([["users/resident",{name:"Resident",role:"Resident",barangay:"Poblacion",points:250,...options.current}],["users/other",{name:"Other",role:"Resident",barangay:"Makina"}]]);
 let sequence=0;
 const db={collection:name=>({doc:(id="audit-"+(++sequence))=>({path:name+"/"+id})}),async runTransaction(action){
  const working=new Map(structuredClone([...records]));
  const result=await action({get:async ref=>({data:()=>working.get(ref.path)}),update:(ref,value)=>{assert.ok(working.has(ref.path));working.set(ref.path,{...working.get(ref.path),...value});},create:(ref,value)=>{assert.ok(!working.has(ref.path));working.set(ref.path,value);}});
  records.clear();for(const [key,value] of working)records.set(key,value);return result;
 }};
 const modules={"firebase-admin/firestore":{FieldValue:{serverTimestamp:()=>"server timestamp"}},"@/lib/staff-auth":{
  authenticatedAccount:async()=>{if(options.signedOut)throw new access.StaffAccessError("Sign in",401);return{db,identity:{uid:"resident"}};},
  staffApiError:error=>Response.json({error:error.message},{status:error.status||500}),
 },"@/lib/staff-access":access,"@/lib/resident-profile":{residentProfileEdit}};
 const route={};new Function("require","exports",code)(name=>modules[name]||require(name),route);
 return{records,post:body=>route.POST(new Request("https://example.invalid/api/residents/profile",{method:"POST",body:JSON.stringify(body)}))};
}

test("Residents can change their own name and barangay without changing identity, points or role",async()=>{
 const app=fixture();const response=await app.post({name:"  Updated   Resident  ",barangay:"Sala",uid:"other",role:"Admin",points:9999});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{saved:true,profile:{name:"Updated Resident",barangay:"Sala"}});
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.deepEqual(app.records.get("users/other"),{name:"Other",role:"Resident",barangay:"Makina"});
 assert.deepEqual(app.records.get("users/resident"),{name:"Updated Resident",role:"Resident",barangay:"Sala",points:250,updatedAt:"server timestamp"});
 const audit=[...app.records].find(([key])=>key.startsWith("audit_logs/"))[1];assert.equal(audit.actor,"resident");assert.equal(audit.target,"resident");assert.equal(audit.fromBarangay,"Poblacion");assert.equal(audit.barangay,"Sala");
});

test("All thirteen canonical barangays can be selected, including completion of a missing barangay",async()=>{
 for(const barangay of access.STAFF_BARANGAYS){const app=fixture({current:{barangay:""}});assert.equal((await app.post({name:"Resident",barangay})).status,200);assert.equal(app.records.get("users/resident").barangay,barangay);}
});

test("Signed-out, suspended and staff accounts cannot use the resident profile endpoint",async()=>{
 for(const options of [{signedOut:true},{current:{accessStatus:"suspended"}},{current:{accessStatus:"disabled"}},{current:{role:"Admin"}},{current:{role:"Semi-Admin"}}]){
  const app=fixture(options);const response=await app.post({name:"Updated",barangay:"Sala"});assert.equal(response.status,options.signedOut?401:403);assert.equal(app.records.size,2);assert.equal(app.records.get("users/resident").name,"Resident");
 }
});

test("Malformed names and barangays make no writes; unchanged retries create no duplicate audit",async()=>{
 for(const body of [null,[],{name:"",barangay:"Sala"},{name:"x".repeat(121),barangay:"Sala"},{name:"Resident",barangay:""},{name:"Resident",barangay:"Other municipality"}]){
  const app=fixture();assert.equal((await app.post(body)).status,400);assert.equal(app.records.size,2);
 }
 const app=fixture();await app.post({name:"Updated",barangay:"Sala"});await app.post({name:"Updated",barangay:"Sala"});assert.equal(app.records.size,3);
});
