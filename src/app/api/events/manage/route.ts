import { FieldValue } from "firebase-admin/firestore";
import { authenticatedResident, certificateApiError } from "@/lib/firebase-request-auth";
import { CertificateError, certificateSettings, eventDate, validId } from "@/lib/certificate-data";
import { requireCertificateSecurity } from "@/lib/certificate-security";
import { timingSafeEqual } from "node:crypto";
import { parseAttendanceQr, assertQrCheckIn } from "@/lib/event-qr-data";
import { eventRegistrationClosed } from "@/lib/event-lifecycle";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !["register", "checkIn", "attendance", "complete", "certificateSettings"].includes(body.action)) {
      throw new CertificateError("Choose a valid event action.");
    }
    const { db, identity, profile } = await authenticatedResident(request, !["register", "checkIn"].includes(body.action));
    if (body.action !== "register") await requireCertificateSecurity();
    if (body.action === "checkIn") {
      const { eventId, token } = parseAttendanceQr(body.payload);
      const result = await db.runTransaction(async tx => {
        const eventRef = db.collection("events").doc(eventId);
        const registrationRef = db.collection("registrations").doc(eventId + "_" + identity.uid);
        const [eventSnap, qrSnap, registrationSnap] = await Promise.all([
          tx.get(eventRef), tx.get(eventRef.collection("attendance").doc("qr")), tx.get(registrationRef),
        ]);
        const event = eventSnap.data();
        if (!event) throw new CertificateError("Event not found.", 404);
        const qr = qrSnap.data();
        const supplied = Buffer.from(token);
        const expected = Buffer.from(typeof qr?.token === "string" ? qr.token : "");
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new CertificateError("This attendance QR is invalid. Ask MENRO for the current code.", 403);
        const registration = registrationSnap.data();
        assertQrCheckIn(event, qr, registration);
        if (registration?.userId !== identity.uid || registration?.eventId !== eventId) throw new CertificateError("Your event registration is invalid.", 403);
        if (!(registration.attended === true && registration.attendanceVerifiedBy)) {
          tx.update(registrationRef, {
            attended: true, attendanceVerifiedBy: "qr:" + qr!.issuedBy,
            attendanceSource: "qr", attendanceVerifiedAt: FieldValue.serverTimestamp(),
          });
        }
        return { eventId, title: event.title, status: event.status, confirmed: true };
      });
      return Response.json(result);
    }
    if (body.action === "attendance") {
      if (typeof body.registrationId !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(body.registrationId) || typeof body.attended !== "boolean") {
        throw new CertificateError("A registration and attendance status are required.");
      }
      const registration = db.collection("registrations").doc(body.registrationId);
      await db.runTransaction(async tx => {
        const data = (await tx.get(registration)).data();
        if (!data) throw new CertificateError("Registration not found.", 404);
        validId(data.eventId); validId(data.userId);
        tx.update(registration, {
          attended: body.attended, attendanceVerifiedBy: identity.uid,
          attendanceSource: "manual",
          attendanceVerifiedAt: FieldValue.serverTimestamp(),
        });
      });
      return Response.json({ saved: true });
    }
    const eventId = validId(body.eventId);
    const eventRef = db.collection("events").doc(eventId);
    if (body.action === "register") {
      const registration = db.collection("registrations").doc(eventId + "_" + identity.uid);
      await db.runTransaction(async tx => {
        const [eventSnap, registrationSnap] = await Promise.all([tx.get(eventRef), tx.get(registration)]);
        if (registrationSnap.exists) return; // Preserve confirmed attendance and avoid duplicate counts.
        const event = eventSnap.data();
        if (!event) throw new CertificateError("Event not found.", 404);
        if (eventRegistrationClosed(event)) throw new CertificateError("Registration for this event is closed.", 409);
        if (Number(event.totalSlots) > 0 && Number(event.availableSlots) <= 0) throw new CertificateError("This event has no available slots.", 409);
        tx.create(registration, {
          eventId, userId: identity.uid, userName: profile.name || "Resident",
          barangay: profile.barangay || "", registeredAt: Date.now(), attended: false,
        });
        tx.update(eventRef, {
          participants: FieldValue.increment(1),
          ...(Number(event.totalSlots) > 0 ? { availableSlots: FieldValue.increment(-1) } : {}),
        });
      });
      return Response.json({ registered: true });
    }
    await db.runTransaction(async tx => {
      const event = (await tx.get(eventRef)).data();
      if (!event) throw new CertificateError("Event not found.", 404);
      if (body.action === "certificateSettings") {
        const date = eventDate({ dateISO: body.dateISO, date: event.date });
        const settings = body.certificateEnabled === false ? {
          certificateEnabled: false,
          certificateSignatory: String(body.certificateSignatory || "").trim().slice(0, 100),
          certificatePosition: String(body.certificatePosition || "").trim().slice(0, 100),
          certificateOrganizer: String(body.certificateOrganizer || "").trim().slice(0, 160),
        } : certificateSettings(body);
        tx.update(eventRef, { ...settings, dateISO: date.iso, date: date.display });
      } else {
        if (event.certificateEnabled !== false) { certificateSettings(event); eventDate(event); }
        tx.update(eventRef, { status: "Completed", completedBy: identity.uid, completedAt: FieldValue.serverTimestamp() });
      }
    });
    return Response.json({ saved: true });
  } catch (error) { return certificateApiError(error); }
}
