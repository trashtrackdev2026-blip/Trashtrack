import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { authenticatedResident, certificateApiError } from "@/lib/firebase-request-auth";
import { assertCertificateEligible, buildCertificateSnapshot, CertificateError, validId, type CertificateSnapshot } from "@/lib/certificate-data";
import { generateCertificatePdf } from "@/lib/certificate-pdf";
import { requireCertificateSecurity } from "@/lib/certificate-security";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { db, identity, role } = await authenticatedResident(request);
    await requireCertificateSecurity();
    const body = await request.json().catch(() => null);
    const eventId = validId(body?.eventId);
    const userId = body?.userId ? validId(body.userId) : identity.uid;
    if (userId !== identity.uid && role !== "admin") throw new CertificateError("You can only download your own certificate.", 403);
    const id = createHash("sha256").update(eventId + "\0" + userId).digest("hex");
    const certificate = db.collection("certificates").doc(id);
    const snapshot = await db.runTransaction(async tx => {
      const [eventSnap, registrationSnap, existing] = await Promise.all([
        tx.get(db.collection("events").doc(eventId)),
        tx.get(db.collection("registrations").doc(eventId + "_" + userId)),
        tx.get(certificate),
      ]);
      const event = eventSnap.data();
      if (!event) throw new CertificateError("Event not found.", 404);
      assertCertificateEligible(eventId, userId, event, registrationSnap.data());
      if (existing.exists) return existing.data() as CertificateSnapshot;
      const user = (await tx.get(db.collection("users").doc(userId))).data();
      const details = buildCertificateSnapshot(id, eventId, userId, event, user?.name);
      tx.create(certificate, { ...details, issuedAt: FieldValue.serverTimestamp() });
      return details;
    });
    const pdf = await generateCertificatePdf(snapshot);
    return new Response(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="TrashTrack-certificate-' + eventId + '.pdf"',
      "Cache-Control": "private, no-store",
    } });
  } catch (error) { return certificateApiError(error); }
}
