import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedResident, certificateApiError } from "@/lib/firebase-request-auth";
import { CertificateError, validId } from "@/lib/certificate-data";
import { requireCertificateSecurity } from "@/lib/certificate-security";
import { attendanceQrPayload } from "@/lib/event-qr-data";
import { generateAttendanceQrPdf } from "@/lib/event-qr-pdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { db, identity } = await authenticatedResident(request, true);
    await requireCertificateSecurity();
    const body = await request.json().catch(() => null);
    const eventId = validId(body?.eventId);
    if (!["get", "download", "setOpen"].includes(body?.action)) throw new CertificateError("Choose a valid QR action.");
    if (body.action === "setOpen" && typeof body.open !== "boolean") throw new CertificateError("Choose the attendance status.");
    const result = await db.runTransaction(async tx => {
      const eventRef = db.collection("events").doc(eventId);
      // This subdocument is covered by the protected events namespace and cannot be read by residents.
      const qrRef = eventRef.collection("attendance").doc("qr");
      const [eventSnap, qrSnap] = await Promise.all([tx.get(eventRef), tx.get(qrRef)]);
      const event = eventSnap.data();
      if (!event) throw new CertificateError("Event not found.", 404);
      if (event.attendanceMethod === "manual") throw new CertificateError("This event uses manual attendance.", 409);
      if (String(event.status).toLowerCase() === "cancelled") throw new CertificateError("This event was cancelled.", 409);
      const qr = qrSnap.data() || { token: randomBytes(32).toString("base64url"), open: true, issuedBy: identity.uid };
      if (body.action === "setOpen") qr.open = body.open;
      if (!qrSnap.exists) tx.create(qrRef, { ...qr, createdAt: FieldValue.serverTimestamp() });
      else if (body.action === "setOpen") tx.update(qrRef, { open: body.open, updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp() });
      return { event, payload: attendanceQrPayload(eventId, qr.token), open: qr.open === true };
    });
    if (body.action === "download") {
      const pdf = await generateAttendanceQrPdf(result.event, result.payload);
      return new Response(new Uint8Array(pdf), { headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="TrashTrack-Attendance-QR-' + eventId + '.pdf"',
        "Cache-Control": "private, no-store",
      } });
    }
    return Response.json({ payload: result.payload, open: result.open });
  } catch (error) { return certificateApiError(error); }
}
