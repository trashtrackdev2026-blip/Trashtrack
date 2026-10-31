import { StaffAccessError, STAFF_BARANGAYS } from "./staff-access.ts";

export function residentProfileEdit(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const barangay = typeof body.barangay === "string" ? body.barangay.trim() : "";
  if (!name || name.length > 120) throw new StaffAccessError("Enter your name using 1–120 characters.", 400);
  if (!(STAFF_BARANGAYS as readonly string[]).includes(barangay)) throw new StaffAccessError("Choose a valid Balete barangay.", 400);
  return { name, barangay };
}
