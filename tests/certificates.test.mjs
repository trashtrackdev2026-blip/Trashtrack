import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { assertCertificateEligible, buildCertificateSnapshot, eventDate, validId } from "../src/lib/certificate-data.ts";
import { generateCertificatePdf, wrapCertificateText } from "../src/lib/certificate-pdf.ts";

const event = {
  title: "TrashTrack Clean-up Drive", dateISO: "2026-10-01", status: "Completed", certificateEnabled: true,
  certificateSignatory: "Juan dela Cruz", certificatePosition: "Lead Trainer",
};
const attended = { eventId: "event-1", userId: "resident-1", attended: true, attendanceVerifiedBy: "admin-1" };

test("only completed events with confirmed attendance for the exact event and user qualify", () => {
  assert.doesNotThrow(() => assertCertificateEligible("event-1", "resident-1", event, attended));
  for (const registration of [undefined, { ...attended, attended: false }, { ...attended, attendanceVerifiedBy: "" },
    { ...attended, attendanceVerifiedBy: undefined }, { ...attended, eventId: "same-date-different-event" }, { ...attended, userId: "another-resident" }]) {
    assert.throws(() => assertCertificateEligible("event-1", "resident-1", event, registration), /confirm your attendance/);
  }
  assert.throws(() => assertCertificateEligible("event-1", "resident-1", { ...event, status: "Upcoming" }, attended), /completed/);
  assert.throws(() => assertCertificateEligible("event-1", "resident-1", { ...event, certificateEnabled: false }, attended), /disabled/);
});

test("certificate dates use the event day and preserve both new ISO and existing saved dates", () => {
  assert.deepEqual(eventDate({ dateISO: "2026-10-01" }), { iso: "2026-10-01", display: "October 1, 2026" });
  assert.equal(eventDate({ date: "Oct 1, 2026" }).iso, "2026-10-01");
  assert.throws(() => eventDate({ date: "Feb 30, 2026" }), /valid event date/);
  for (const dateISO of ["2026-02-30", "", "not-a-date", "2026-10-01T12:00:00Z"]) {
    assert.throws(() => eventDate({ dateISO }), /valid event date/);
  }
});

test("issued details are a snapshot, and missing names or signatories do not create fake certificates", () => {
  const original = { ...event };
  const snapshot = buildCertificateSnapshot("certificate-1", "event-1", "resident-1", original, "José Niño de la Cruz");
  original.title = "Renamed event"; original.dateISO = "2026-12-01"; original.certificateSignatory = "New organizer";
  assert.equal(snapshot.eventTitle, event.title);
  assert.equal(snapshot.eventDate, "October 1, 2026");
  assert.equal(snapshot.signatory, event.certificateSignatory);
  assert.equal(snapshot.participantName, "José Niño de la Cruz");
  assert.throws(() => buildCertificateSnapshot("id", "event-1", "resident-1", event, ""), /Participant name/);
  assert.throws(() => buildCertificateSnapshot("id", "event-1", "resident-1", { ...event, certificateSignatory: "" }, "Resident"), /Signatory/);
  for (const id of ["../another-user", "event/user", "", null]) assert.throws(() => validId(id));
});

test("PDF is one A4 landscape page with the supplied template, including accented names", async () => {
  const details = buildCertificateSnapshot("id", "event-1", "resident-1", event, "José Niño de la Cruz");
  const bytes = await generateCertificatePdf(details);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 841.89) < 0.1);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - 595.28) < 0.1);
  assert.equal(pdf.getTitle(), "Certificate of Appreciation - José Niño de la Cruz");
  assert.ok(bytes.length > 100_000);
});

test("long words and event titles wrap within the certificate text area", async () => {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.TimesRoman);
  const words = "VeryLongEventTitle".repeat(9) + " Barangay Sala cleanup";
  const lines = wrapCertificateText(words, font, 18, 650);
  assert.ok(lines.length > 1);
  assert.ok(lines.every(line => font.widthOfTextAtSize(line, 18) <= 650));
});
