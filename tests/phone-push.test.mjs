import test from "node:test";
import assert from "node:assert/strict";
import { BALETE_BARANGAYS } from "../src/lib/barangay-geofence.ts";
import { buildPhonePush } from "../src/lib/phone-push.ts";

const record = { title: "Collection update", message: "Collection starts tomorrow at 8 AM.", type: "schedule", recipients: "All Barangays" };

test("distinct phone updates are non-collapsible and contain everything needed for the tray and inbox", () => {
  const message = buildPhonePush("notice-1", record, BALETE_BARANGAYS);
  assert.equal(message.notification, undefined);
  assert.equal(message.topic, "trashtrack_residents_v1");
  assert.equal(message.android.priority, "high");
  assert.equal(message.android.collapseKey, undefined);
  assert.equal(message.android.ttl, 7 * 24 * 60 * 60 * 1000);
  assert.deepEqual(message.data, { notificationId: "notice-1", openNotifications: "true", type: "schedule",
    title: record.title, message: record.message, recipients: "All Barangays" });
});

test("each of the 13 barangays targets its own subscription, including San Sebastian", () => {
  const topics = BALETE_BARANGAYS.map(recipients => buildPhonePush("notice-2", { ...record, recipients }, BALETE_BARANGAYS).topic);
  assert.equal(new Set(topics).size, 13);
  assert.ok(topics.every(topic => /^trashtrack_barangay_[a-z_]+_v1$/.test(topic)));
  assert.equal(topics.at(-1), "trashtrack_barangay_san_sebastian_v1");
});

test("unknown destinations are rejected instead of broadcasting to everybody", () => {
  for (const recipients of ["Kinalaglagan", "all", "", 123, {}, "Sala OR Poblacion"]) {
    assert.throws(() => buildPhonePush("notice-3", { ...record, recipients }, BALETE_BARANGAYS), /valid Balete barangay/);
  }
});

test("blank, oversized and malformed content is rejected before Firebase delivery", () => {
  for (const overrides of [{ title: " " }, { message: "" }, { title: "x".repeat(101) },
    { message: "x".repeat(501) }, { title: 1 }, { message: null }]) {
    assert.throws(() => buildPhonePush("notice-4", { ...record, ...overrides }, BALETE_BARANGAYS), /required/);
  }
});

test("a retry uses the same Android tag and notification ID instead of creating another tray item", () => {
  const first = buildPhonePush("stable-notice", record, BALETE_BARANGAYS);
  const retry = buildPhonePush("stable-notice", record, BALETE_BARANGAYS);
  assert.equal(first.data.notificationId, retry.data.notificationId);
  assert.notEqual(first.data.notificationId, buildPhonePush("another-notice", record, BALETE_BARANGAYS).data.notificationId);
});
