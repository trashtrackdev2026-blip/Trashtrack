import { FieldValue } from "firebase-admin/firestore";
import { authenticatedAccount, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError } from "@/lib/staff-access";
import { residentProfileEdit } from "@/lib/resident-profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { db, identity } = await authenticatedAccount(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new StaffAccessError("Provide your name and barangay.", 400);
    const fields = residentProfileEdit(body);
    const reference = db.collection("users").doc(identity.uid);
    await db.runTransaction(async tx => {
      const current = (await tx.get(reference)).data();
      if (!current || String(current.role).trim().toLowerCase() !== "resident" || ["suspended", "disabled"].includes(current.accessStatus)) {
        throw new StaffAccessError("Only an active resident can edit their resident profile.", 403);
      }
      if (current.name === fields.name && current.barangay === fields.barangay) return;
      tx.update(reference, { ...fields, updatedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection("audit_logs").doc(), {
        action: "resident.profile.edit", actor: identity.uid, target: identity.uid,
        fromBarangay: typeof current.barangay === "string" ? current.barangay : "",
        barangay: fields.barangay, at: FieldValue.serverTimestamp(),
      });
    });
    return Response.json({ saved: true, profile: fields }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return staffApiError(error); }
}
