import { locateBarangay, type BarangayBoundaries } from "./barangay-geofence.ts";
import { StaffAccessError, validStaffBarangay } from "./staff-access.ts";

export type ReportAttachment = { url: string; type: "image" | "video" };

export function reportSubmission(body: Record<string, unknown>, profile: Record<string, unknown>, boundaries: BarangayBoundaries, cloudName: string) {
  if (String(profile.role).toLowerCase() !== "resident" || !validStaffBarangay(profile.barangay)) {
    throw new StaffAccessError("A resident account with an assigned barangay is required.");
  }
  const pin = locateBarangay(boundaries, body.latitude, body.longitude);
  if (pin.status !== "inside" || pin.barangay !== profile.barangay) {
    throw new StaffAccessError(`Place the report pin inside your registered barangay (${profile.barangay}).`, 400);
  }
  if (typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.requestId)
      || typeof body.type !== "string" || !["Garbage Overflow", "Illegal Dumping", "Missed Collection", "Other"].includes(body.type)
      || typeof body.description !== "string" || !body.description.trim() || body.description.length > 5000
      || !Array.isArray(body.attachments) || body.attachments.length > 5) {
    throw new StaffAccessError("Enter a description and attach up to five photos or videos.", 400);
  }
  const attachments: ReportAttachment[] = body.attachments.map(value => {
    if (!value || typeof value !== "object" || !["image", "video"].includes(value.type) || typeof value.url !== "string") {
      throw new StaffAccessError("Invalid report attachment.", 400);
    }
    let url: URL;
    try { url = new URL(value.url); } catch { throw new StaffAccessError("Invalid attachment URL.", 400); }
    if (!cloudName || url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password || url.port
        || !url.pathname.startsWith(`/${cloudName}/${value.type}/upload/`)) {
      throw new StaffAccessError("Upload report photos and videos before submitting.", 400);
    }
    return { url: url.href, type: value.type };
  });
  return {
    type: body.type, description: body.description.trim(), location: pin.barangay,
    latitude: body.latitude as number, longitude: body.longitude as number,
    attachments, imageUrl: attachments.find(item => item.type === "image")?.url || "",
    status: "Pending", reporterName: String(profile.name || "Resident").slice(0, 120),
  };
}
