import test from "node:test";
import assert from "node:assert/strict";
import {analyticsMonthRange,analyticsMonthLabel,filterAnalyticsMonth,analyticsRecordRows} from "../src/lib/analytics-period.ts";
import {summarizeAnalytics} from "../src/lib/analytics-data.ts";
import {learningPublicationFields,LEARNING_CATEGORIES,LEARNING_TYPES} from "../src/lib/learning-publication.ts";
import {collectionChangeMessage,collectionOutcomeNotice} from "../src/lib/collection-outcome-notice.ts";
import {communityPublication} from "../src/lib/community-publication.ts";
import {buildPhonePush} from "../src/lib/phone-push.ts";

test("Monthly reporting uses a half-open Philippine calendar month, including year changes and leap February",()=>{
  const range=analyticsMonthRange("2026-08");
  assert.equal(range.start.toISOString(),"2026-07-31T16:00:00.000Z");assert.equal(range.end.toISOString(),"2026-08-31T16:00:00.000Z");
  assert.equal(analyticsMonthRange("2026-12").end.toISOString(),"2026-12-31T16:00:00.000Z");
  assert.equal((analyticsMonthRange("2028-02").end-analyticsMonthRange("2028-02").start)/86400000,29);
  for(const value of ["2026-13","2026-00","August","2026-8"])assert.throws(()=>analyticsMonthRange(value));
  assert.equal(analyticsMonthLabel("2026-08"),"August 2026");
});
test("Monthly lists and analytics exclude adjacent months and undated reports but preserve all-date history",()=>{
  const reports=[{id:"before",timestamp:Date.parse("2026-07-31T15:59:59Z")},{id:"first",createdAt:{toDate:()=>new Date("2026-07-31T16:00:00Z")},status:"Resolved"},{id:"last",date:"2026-08-31 23:59",status:"UnderReview"},{id:"after",date:"2026-09-01 00:00"},{id:"undated"}];
  const month=filterAnalyticsMonth(reports,"2026-08");assert.deepEqual(month.map(x=>x.id),["first","last"]);
  const summary=summarizeAnalytics(month,[],0,[],new Date("2026-08-31T23:59:59+08:00"));
  assert.equal(summary.stats.totalReports,2);assert.equal(summary.stats.resolvedReports,1);assert.equal(summary.stats.pendingReports,1);
  assert.equal(analyticsRecordRows(month).length,summary.stats.totalReports);assert.equal(filterAnalyticsMonth(reports,"").length,5);
});
test("Event and collection month filters use scheduled dates rather than creation dates",()=>{
  const data=[{dateISO:"2026-08-15",date:"2026-08-15",timestamp:Date.parse("2026-07-01")},{dateISO:"2026-09-01",date:"2026-09-01",timestamp:Date.parse("2026-08-05")}];
  for(const kind of ["event","schedule"])assert.equal(filterAnalyticsMonth(data,"2026-08",kind)[0],data[0]);
  assert.equal(filterAnalyticsMonth(data,"2026-08","resource")[0],data[1]);
});
test("Printed record rows preserve reference, concern and status with an explicit AM/PM Philippine timestamp",()=>{
  const [row]=analyticsRecordRows([{id:"record-original",date:"2026-08-01 20:00",location:"Sala",type:"Garbage Overflow",status:"Endorsed"}]);
  assert.equal(row.reference,"record-original");assert.equal(row.barangay,"Sala");assert.equal(row.status,"In Progress");assert.match(row.date,/8:00 PM/);
});
const article={title:" Environmental care ",category:"Environmental Awareness",type:"Article",description:" Protect the lakeshore and sort waste at home. ",image:"",videoUrl:"",fileName:"",coverUrl:""};
test("Environmental Awareness written Articles publish without an unrelated required file or cover",()=>{
  const fields=learningPublicationFields(article);assert.equal(fields.type,"Article");assert.equal(fields.category,"Environmental Awareness");assert.equal(fields.fileType,"article");assert.equal(fields.fileUrl,"");assert.equal(fields.description,article.description.trim());assert.equal(fields.status,"Published");
  assert.ok(LEARNING_CATEGORIES.includes(fields.category));assert.ok(LEARNING_TYPES.includes(fields.type));
});
test("Article documents and links retain original content while covers stay separate",()=>{
  for(const source of ["https://example.org/article","https://example.org/awareness.pdf"]){const fields=learningPublicationFields({...article,image:source,coverUrl:"https://example.org/cover.jpg"});assert.equal(fields.fileUrl,source);assert.equal(fields.coverUrl,"https://example.org/cover.jpg");assert.equal(fields.image,"");}
  assert.equal(learningPublicationFields({...article,image:"https://example.org/awareness.pdf"}).fileType,"document");
});
test("Publication errors stay actionable for empty articles, missing guide files, covers used as videos and unsafe URLs",()=>{
  for(const patch of [{description:""},{type:"Guide"},{type:"Video",image:"https://example.org/cover.jpg"},{image:"javascript:alert(1)"},{coverUrl:"https://example.org/file.pdf"},{description:"x".repeat(20001)}])assert.throws(()=>learningPublicationFields({...article,...patch}));
  for(const category of LEARNING_CATEGORIES)for(const type of LEARNING_TYPES){const fields=learningPublicationFields({...article,category,type,image:type==="Video"?"https://example.org/video.mp4":"https://example.org/guide.pdf"});assert.equal(fields.category,category);assert.equal(fields.type,type);}
});
test("Every collection lifecycle phone message uses AM/PM and edited notices include the original outcome notes",()=>{
  const current={barangay:"Poblacion",date:"2026-11-03",time:"20:00",status:"Failed",statusNotes:"Road closed because of a fallen tree."};
  const next={barangay:"Palsara",date:"2026-11-04",time:"07:00"};
  for(const action of ["edit","followup","delete"]){const message=collectionChangeMessage(action,current,next);assert.match(message,/8:00 PM/);if(action!=="delete")assert.match(message,/7:00 AM/);assert.ok(message.includes(current.statusNotes));assert.ok(message.length<=500);buildPhonePush("one",{title:"Collection update",message,recipients:"Poblacion"},["Poblacion"]);}
  const created=communityPublication("schedule",{barangay:"Poblacion",date:"2099-11-04",time:"00:00"});assert.match(created.announcement.message,/12:00 AM/);
});
test("Outcome notes remain complete for the resident inbox while the actual FCM body is bounded and informative",()=>{
  const notes="Road remains blocked. ".repeat(85),notice=collectionOutcomeNotice({barangay:"Sala",date:"2026-11-02",time:"13:00"},"Unfinished",notes);
  assert.equal(notice.outcomeNotes,notes);assert.equal(notice.outcomeStatus,"Unfinished");assert.match(notice.message,/Outcome notes: Road remains blocked/);assert.match(notice.message,/1:00 PM/);assert.ok(notice.message.length<=500);
  assert.equal(buildPhonePush("outcome",notice,["Sala"]).notification.body,notice.message);
});
