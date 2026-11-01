import test from "node:test";
import assert from "node:assert/strict";
import {passwordResetFeedback} from "../src/lib/password-reset.ts";
import {STAFF_POSITIONS,requestFields,staffPosition} from "../src/lib/staff-access.ts";
import {EVENT_CATEGORIES,eventCategoryField} from "../src/lib/event-categories.ts";
import {collectionStatus,collectionStatusUpdate,COLLECTION_STATUSES} from "../src/lib/schedule-policy.ts";
import {learningCover,learningEmbeddedVideo} from "../src/lib/learning-resource.ts";
import {summarizeAnalytics} from "../src/lib/analytics-data.ts";
import {filterMenroReports} from "../src/lib/menro-reports.ts";

test("Password reset feedback remains private and explains errors for every account",()=>{
  assert.deepEqual(passwordResetFeedback(),passwordResetFeedback({code:"auth/user-not-found"}));
  for(const code of ["auth/invalid-email","auth/network-request-failed","auth/too-many-requests","auth/unauthorized-continue-uri","auth/operation-not-allowed","auth/internal-error"]){const result=passwordResetFeedback({code});assert.equal(result.accepted,false);assert.ok(result.message.length>30);assert.ok(!result.message.includes("has no account"));}
});
test("Only Captain/Secretary can be newly submitted, with a supported historical Secretary alias",()=>{
  assert.deepEqual(STAFF_POSITIONS,["Barangay Captain","Secretary"]);
  for(const position of STAFF_POSITIONS)assert.equal(requestFields({name:"Test Official",position,contact:"09000000000",barangay:"Sala"}).position,position);
  assert.equal(staffPosition("Barangay secretary"),"Secretary");
  for(const position of ["Official","Resident","MENRO Admin",""])assert.throws(()=>requestFields({name:"Test Official",position,contact:"09000000000",barangay:"Sala"}));
});
test("Event categories always include Seminar/Other and normalize aliases without changing legacy labels",()=>{
  assert.deepEqual(EVENT_CATEGORIES,["Clean-up Drive","Seminar","Tree Planting","Other"]);
  assert.equal(eventCategoryField("Others"),"Other");assert.equal(eventCategoryField("CLEAN-UP DRIVE"),"Clean-up Drive");
  assert.equal(eventCategoryField("Legacy workshop","Legacy workshop"),"Legacy workshop");assert.throws(()=>eventCategoryField("Forged category"));
});
test("Inactive remains readable historically but cannot be submitted as a new outcome",()=>{
  assert.equal(collectionStatus("inactive"),"Inactive");assert.ok(!COLLECTION_STATUSES.includes("Inactive"));assert.throws(()=>collectionStatusUpdate({status:"Inactive",notes:""}));
});
test("Learning covers stay separate from PDF/video content and only trusted YouTube IDs embed",()=>{
  assert.equal(learningCover({image:"https://example.com/guide.pdf"}),null);
  assert.equal(learningCover({coverUrl:"https://example.com/cover.jpg",image:"https://example.com/guide.pdf"}),"https://example.com/cover.jpg");
  assert.equal(learningEmbeddedVideo("https://youtu.be/dQw4w9WgXcQ"),"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(learningEmbeddedVideo("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ"),null);
});
test("Analytics counts actual resolver roles and MENRO views exclude locally resolved reports",()=>{
  const reports=[{status:"Resolved",resolvedByRole:"Semi-Admin"},{status:"Resolved",resolvedByRole:"Admin"},{status:"Resolved"},{status:"UnderReview"}];
  const summary=summarizeAnalytics(reports,[],0,[]);assert.equal(summary.stats.resolvedReports,3);assert.deepEqual(summary.resolutionData.map(row=>row.value),[1,1,1]);
  const common={id:"one",type:"Overflow",description:"Test",location:"Sala",date:"2026-11-02",reporterName:"Test Resident"};
  const result=filterMenroReports(reports.slice(0,3).map((report,i)=>({...common,...report,id:String(i)})),{stage:"resolved",search:"",status:"all",barangay:"all",days:0});assert.deepEqual(result.map(report=>report.id),["1","2"]);
});
