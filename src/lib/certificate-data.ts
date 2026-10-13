export class CertificateError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export type CertificateSnapshot = {
  version: 1; id: string; eventId: string; userId: string; participantName: string;
  eventTitle: string; eventDate: string; eventDateISO: string; organizer: string;
  signatory: string; position: string;
};

export function requiredText(value: unknown, label: string, maximum = 140): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new CertificateError(label + " is required and must be at most " + maximum + " characters.");
  }
  return value.trim().replace(/\s+/g, " ");
}

export function validId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new CertificateError("A valid event or participant ID is required.");
  }
  return value;
}

export function eventDate(data: Record<string, unknown>) {
  const raw = typeof data.dateISO === "string" && data.dateISO ? data.dateISO : data.date;
  if (typeof raw !== "string" || raw.length > 60) throw new CertificateError("Set a valid event date.");
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    date = new Date(raw + "T00:00:00Z");
    if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== raw) throw new CertificateError("Set a valid event date.");
  } else {
    if (!/^[A-Za-z]{3,9} \d{1,2}, \d{4}$/.test(raw)) throw new CertificateError("Set a valid event date.");
    date = new Date(raw + " 00:00:00 GMT");
    const day = Number(raw.match(/ (\d{1,2}),/)?.[1]);
    if (Number.isNaN(date.valueOf()) || date.getUTCDate() !== day) throw new CertificateError("Set a valid event date.");
  }
  return {
    iso: date.toISOString().slice(0, 10),
    display: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date),
  };
}

export function certificateSettings(data: Record<string, unknown>) {
  return {
    certificateEnabled: data.certificateEnabled !== false,
    certificateSignatory: requiredText(data.certificateSignatory, "Signatory name", 100),
    certificatePosition: requiredText(data.certificatePosition, "Signatory position", 100),
    certificateOrganizer: requiredText(data.certificateOrganizer || "Municipal Environment and Natural Resources Office (MENRO)", "Organizing office", 160),
  };
}

export function assertCertificateEligible(eventId: string, userId: string, event: Record<string, unknown>, registration: Record<string, unknown> | undefined) {
  if (event.status !== "Completed") throw new CertificateError("Certificates become available after the event is completed.", 409);
  if (event.certificateEnabled === false) throw new CertificateError("Certificates are disabled for this event.", 409);
  if (!registration || registration.eventId !== eventId || registration.userId !== userId ||
      registration.attended !== true || typeof registration.attendanceVerifiedBy !== "string" || !registration.attendanceVerifiedBy) {
    throw new CertificateError("An administrator must confirm your attendance before this certificate can be issued.", 403);
  }
}

export function buildCertificateSnapshot(id: string, eventId: string, userId: string, event: Record<string, unknown>, name: unknown): CertificateSnapshot {
  const settings = certificateSettings(event);
  const date = eventDate(event);
  return {
    version: 1, id, eventId, userId, participantName: requiredText(name, "Participant name"),
    eventTitle: requiredText(event.title, "Event title"), eventDate: date.display, eventDateISO: date.iso,
    organizer: settings.certificateOrganizer, signatory: settings.certificateSignatory, position: settings.certificatePosition,
  };
}
