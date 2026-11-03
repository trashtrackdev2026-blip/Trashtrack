import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {summarizeAnalytics} from "../src/lib/analytics-data.ts";
import {REPORT_CATEGORIES,reportCategory} from "../src/lib/report-categories.ts";
import * as access from "../src/lib/staff-access.ts";

test("Analytics uses the resident's four report categories and counts legacy aliases without changing records",()=>{
 const reports=["Garbage Overflow","Illegal Dumping","Missed Collection","Other","Uncollected Waste","Blocked Drainage","Mixed Waste","Others"].map(type=>({type}));
 const before=structuredClone(reports),result=summarizeAnalytics(reports,[],0,[]);
 assert.deepEqual(result.categoryData.map(x=>x.name),REPORT_CATEGORIES);
 assert.deepEqual(result.categoryData.map(x=>x.value),[25,13,13,50]);
 assert.deepEqual(reports,before);
 assert.equal(reportCategory(" missed_collection "),"Missed Collection");
 assert.equal(reportCategory("Not illegal dumping"),"Other");
});

test("Collection analytics has exactly four current outcomes and discloses other historical records separately",()=>{
 const summary=summarizeAnalytics([],[],0,["Active","Completed","Unfinished","Failed","Inactive","unexpected"].map(status=>({status})));
 assert.deepEqual(summary.collectionData,[{name:"Active",value:1},{name:"Completed",value:1},{name:"Unfinished",value:1},{name:"Failed",value:1}]);
 assert.equal(summary.historicalCollections,2);assert.equal(summary.totalCollections,6);
});

test("Actual authenticatedAccount blocks unverified residents before any protected API can run",async()=>{
 const require=createRequire(import.meta.url),ts=require("typescript");
 const source=ts.transpileModule(fs.readFileSync(new URL("../src/lib/staff-auth.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const identity={uid:"resident",email_verified:false},profile={role:"resident"};
 const modules={"server-only":{},"firebase-admin/auth":{getAuth:()=>({verifyIdToken:async()=>identity})},"firebase-admin/firestore":{getFirestore:()=>({collection:()=>({doc:()=>({get:async()=>({data:()=>profile})})})})},"firebase-admin/security-rules":{},"./firebase-admin":{getFirebaseAdminApp:()=>({})},"./staff-access":access,"./security-policy":{}};
 const exports={};new Function("require","exports",source)(name=>modules[name],exports);
 const request=new Request("https://example.invalid/api/reports/submit",{headers:{authorization:"Bearer fixture"}});
 await assert.rejects(exports.authenticatedAccount(request),error=>error.status===403 && error.code==="resident/email-verification-required");
 identity.email_verified=true;assert.equal((await exports.authenticatedAccount(request)).identity.uid,"resident");
 identity.email_verified=false;profile.role="Admin";assert.equal((await exports.authenticatedAccount(request)).profile.role,"Admin");
});
