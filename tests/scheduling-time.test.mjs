import test from "node:test";
import assert from "node:assert/strict";
import { manilaDateTime, schedulingBounds, schedulingError, assertFutureSchedule } from "../src/lib/scheduling-time.ts";
import { collectionOutcomeNotice } from "../src/lib/collection-outcome-notice.ts";

const now = Date.parse("2026-11-02T13:30:25+08:00");

test("Scheduling rejects yesterday and elapsed times today, and accepts later times and future days", () => {
  for (const [date, time] of [["2026-11-01","23:59"],["2026-11-02","13:29"],["2026-11-02","13:30"]]) {
    assert.ok(schedulingError(date,time,now));
    assert.throws(() => assertFutureSchedule(date,time,now), {status:400});
  }
  for (const [date,time] of [["2026-11-02","13:31"],["2026-11-03","00:00"],["2099-12-31","23:59"]]) assert.equal(schedulingError(date,time,now),null);
  assert.ok(schedulingError("2026-11-02","13:31",now+60_000),"An open form expires when the chosen minute passes");
});

test("Scheduling follows Manila midnight, minute rounding and AM/PM independently of device timezone", () => {
  assert.deepEqual(manilaDateTime(Date.parse("2026-11-01T16:00:00Z")),{date:"2026-11-02",time:"00:00"});
  assert.deepEqual(schedulingBounds("2026-11-02",now),{minDate:"2026-11-02",minTime:"13:31"});
  assert.deepEqual(schedulingBounds("2026-11-03",now),{minDate:"2026-11-02",minTime:undefined});
  const midnight=Date.parse("2026-11-02T23:59:01+08:00");
  assert.deepEqual(schedulingBounds("2026-11-03",midnight),{minDate:"2026-11-03",minTime:"00:00"});
  assert.deepEqual(schedulingBounds("2026-11-02",midnight),{minDate:"2026-11-03",minTime:undefined});
  assert.equal(schedulingError("2026-11-02","12:00",Date.parse("2026-11-02T11:59:59+08:00")),null);
  assert.ok(schedulingError("2026-11-02","00:00",Date.parse("2026-11-02T12:00:00+08:00")));
});

test("Incomplete drafts can omit scheduling, but supplied past or invalid values are rejected", () => {
  assert.equal(schedulingError("","",now,true),null);
  assert.equal(schedulingError("2026-11-03","",now,true),null);
  for (const [date,time] of [["","08:00"],["2026-11-01",""],["2026-02-30","08:00"],["2026-11-03","24:00"],["2026-11-03","07:60"],["not-a-date","08:00"]]) assert.ok(schedulingError(date,time,now,true));
});

test("Outcome notices preserve the saved audience, date, AM/PM time and bounded follow-up notes", () => {
  const notice=collectionOutcomeNotice({barangay:"Sala",date:"2026-11-01",time:"13:00"},"Failed","Road blocked");
  assert.equal(notice.recipients,"Sala");assert.equal(notice.type,"schedule");
  for (const value of ["2026-11-01","1:00 PM","failed","Road blocked"]) assert.ok(notice.message.includes(value));
  const long=collectionOutcomeNotice({barangay:"All Barangays",day:"Monday, Wednesday",time:"07:00"},"Unfinished","A".repeat(2000));
  assert.ok(long.message.length<=500);assert.ok(long.message.includes("7:00 AM"));assert.equal(long.recipients,"All Barangays");
  assert.throws(()=>collectionOutcomeNotice({barangay:""},"Completed",""),{status:400});
});
