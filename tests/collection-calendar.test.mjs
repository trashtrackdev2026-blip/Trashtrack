import test from "node:test";
import assert from "node:assert/strict";
import { filterCollectionSchedules, collectionTimeLabel } from "../src/lib/collection-calendar.ts";

const schedules = [
  { id: "dated", barangay: "Poblacion", date: "2026-11-02", day: "Tuesday", time: "07:00", status: "Active", description: "Biodegradable collection" },
  { id: "weekly", barangay: "Malabanan", day: "Monday, Wednesday", time: "13:30", status: "Active", notes: "Residual waste" },
  { id: "inactive", barangay: "Poblacion", day: "Monday", time: "09:00", status: "Inactive" },
];
const defaults = { search: "", barangay: "all", day: "all", status: "all" };
test("calendar filters use a dated schedule's actual weekday and include comma-separated legacy days", () => {
  assert.deepEqual(filterCollectionSchedules(schedules, { ...defaults, day: "monday", status: "active" }).map(item => item.id), ["dated", "weekly"]);
  assert.deepEqual(filterCollectionSchedules(schedules, { ...defaults, day: "wednesday" }).map(item => item.id), ["weekly"]);
  assert.deepEqual(filterCollectionSchedules(schedules, { ...defaults, day: "tuesday" }), []);
});
test("collection search, barangay and status filters compose without hiding notes from search", () => {
  assert.deepEqual(filterCollectionSchedules(schedules, { ...defaults, search: "  RESIDUAL  ", barangay: "Malabanan", status: "active" }).map(item => item.id), ["weekly"]);
  assert.deepEqual(filterCollectionSchedules(schedules, { ...defaults, barangay: "Poblacion", status: "inactive" }).map(item => item.id), ["inactive"]);
  assert.equal(filterCollectionSchedules(schedules, defaults).length, 3);
});
test("collection time labels preserve noon, midnight, AM/PM and unavailable times", () => {
  assert.equal(collectionTimeLabel("00:00"), "12:00 AM");
  assert.equal(collectionTimeLabel("12:00"), "12:00 PM");
  assert.equal(collectionTimeLabel("13:30"), "1:30 PM");
  assert.equal(collectionTimeLabel("7:00 am"), "7:00 AM");
  assert.equal(collectionTimeLabel("Time to be announced"), "Time to be announced");
  assert.equal(collectionTimeLabel("25:90"), "25:90");
});
