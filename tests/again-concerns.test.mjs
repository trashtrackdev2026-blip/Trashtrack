import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
import {eventFormFields,normalizedEventTime} from "../src/lib/event-form.ts";
import {reportBarangayLabel} from "../src/lib/report-location-label.ts";
import {learningDeliveryUrl,verifyLearningDelivery} from "../src/lib/learning-delivery.ts";
import {notificationDeliveryLabel} from "../src/lib/notification-edit.ts";
import {STAFF_BARANGAYS} from "../src/lib/staff-access.ts";
import {collectionTimeLabel} from "../src/lib/collection-calendar.ts";
import {learningResourceType} from "../src/lib/learning-resource.ts";

test("Event forms accept native time seconds and AM/PM, and explain invalid end times",()=>{
  for(const [input,output] of [["9:15 AM","09:15"],["12:00 AM","00:00"],["12:00 PM","12:00"],["18:30:00","18:30"],["13:00 PM",""],["24:00",""]])assert.equal(normalizedEventTime(input),output);
  const base={title:"Cleanup",barangay:"Sala",dateISO:"2099-11-15",startTime:"9:00 AM",endTime:"1:00 PM",certificateEnabled:false};
  assert.equal(eventFormFields(base).time,"09:00 - 13:00");
  assert.throws(()=>eventFormFields({...base,endTime:"08:00"}),/end time must be later/);
  assert.throws(()=>eventFormFields({...base,dateISO:"2099-02-30"}),/valid event date/);
  assert.equal(eventFormFields({title:"Partial",barangay:"Sala",certificateEnabled:true},true).dateISO,"");
});

test("Report barangay filters recognize legacy full addresses without altering the address",()=>{
  for(const barangay of STAFF_BARANGAYS){const address=`24HQ+W3, ${barangay}, Balete, Batangas`;assert.equal(reportBarangayLabel(address),barangay);assert.ok(address.startsWith("24HQ+W3"));}
  assert.equal(reportBarangayLabel("Unknown location"),null);assert.equal(reportBarangayLabel("Malasala, Other town"),null);
});

test("Schedule summary shows entered details immediately with AM/PM and notes",()=>{
  const require=createRequire(import.meta.url),ts=require("typescript"),React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
  const code=ts.transpileModule(fs.readFileSync(new URL("../src/components/schedules/ScheduleSummary.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};new Function("require","exports",code)(name=>name==="@/lib/collection-calendar"?{collectionTimeLabel}:require(name),exports);
  const html=renderToStaticMarkup(React.createElement(exports.ScheduleSummary,{form:{barangay:"Sala",day:"Monday",date:"2099-11-15",time:"13:30",notes:"Bring sorted bags"}}));
  for(const value of ["Sala","Monday","2099-11-15","1:30 PM","Bring sorted bags"])assert.ok(html.includes(value));
});

test("Document checks accept only this system's Cloudinary account and never follow redirects",async()=>{
  const url="https://res.cloudinary.com/trashtrack/raw/upload/v1/guide.pdf";
  assert.equal(learningDeliveryUrl(url,"trashtrack"),url);
  for(const value of ["http://127.0.0.1/private","https://example.com/guide.pdf","https://res.cloudinary.com/other/raw/upload/guide.pdf","https://res.cloudinary.com@evil.example/trashtrack/raw/upload/guide.pdf"])assert.throws(()=>learningDeliveryUrl(value,"trashtrack"));
  let captured;assert.deepEqual(await verifyLearningDelivery(url,async(input,options)=>{captured=options;return new Response("%PDF-1.7\nfixture");}),{available:true});
  assert.equal(captured.redirect,"error");assert.equal(captured.headers.Range,"bytes=0-1023");
  await assert.rejects(verifyLearningDelivery(url,async()=>new Response("Denied",{status:401})),/Allow delivery of PDF and ZIP files/);
  await assert.rejects(verifyLearningDelivery(url,async()=>new Response("<html>blocked</html>")),/instead of a PDF/);
  const stream=new ReadableStream({start(controller){for(const value of ["%P","DF-","1.7"])controller.enqueue(new TextEncoder().encode(value));controller.close();}});
  assert.deepEqual(await verifyLearningDelivery(url,async()=>new Response(stream)),{available:true});
});

test("In-app notifications and phone delivery states have distinct plain labels",()=>{
  assert.equal(notificationDeliveryLabel(false,"disabled"),"In-app only");
  assert.equal(notificationDeliveryLabel(true,"pending"),"Waiting for phone delivery");
  assert.equal(notificationDeliveryLabel(true,"queued"),"Sent to phone service");
  assert.equal(notificationDeliveryLabel(true,"failed"),"Phone delivery failed");
});

test("A YouTube link is published as video even when the author leaves Guide selected",()=>{
  assert.equal(learningResourceType("https://www.youtube.com/watch?v=sample","","Guide"),"video");
  assert.equal(learningResourceType("https://youtu.be/sample","","Guide"),"video");
  assert.equal(learningResourceType("https://www.youtube.com.evil.example/file","","Guide"),"document");
});
