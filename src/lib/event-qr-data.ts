import { CertificateError, validId } from "./certificate-data";

export function attendanceQrPayload(eventId: string, token: string) {
  validId(eventId);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CertificateError("Invalid attendance QR code.");
  return "trashtrack://attendance/" + eventId + "?token=" + token;
}

export function parseAttendanceQr(value: unknown) {
  if (typeof value !== "string" || value.length > 240) throw new CertificateError("Scan the event attendance QR supplied by MENRO.");
  const match = /^trashtrack:\/\/attendance\/([A-Za-z0-9_-]{1,128})\?token=([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) throw new CertificateError("Scan the event attendance QR supplied by MENRO.");
  return { eventId: match[1], token: match[2] };
}

export function assertQrCheckIn(event: Record<string, unknown>, qr: Record<string, unknown> | undefined, registration: Record<string, unknown> | undefined) {
  if (String(event.status).toLowerCase() === "cancelled") throw new CertificateError("This event was cancelled.", 409);
  if (event.attendanceMethod === "manual") throw new CertificateError("The organizer records attendance manually for this event.", 409);
  if (!qr || qr.open !== true || typeof qr.issuedBy !== "string" || !qr.issuedBy) {
    throw new CertificateError("QR attendance is closed. Ask the organizer to open it.", 409);
  }
  if (!registration) throw new CertificateError("Register for this event before scanning its attendance QR.", 409);
  if (registration.attended === false && typeof registration.attendanceVerifiedBy === "string" && registration.attendanceVerifiedBy) {
    throw new CertificateError("The organizer has revoked this attendance. Ask MENRO to review it.", 403);
  }
}
