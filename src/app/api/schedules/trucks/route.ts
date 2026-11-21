import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { db } = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const snapshot = await db.collection("collection_trucks").orderBy("name").get();
    const trucks = snapshot.docs.map(doc => ({ id: doc.id, name: String(doc.data().name), available: doc.data().available === true }));
    return Response.json({ trucks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return staffApiError(error); }
}

export async function POST(request: Request) {
  try {
    const { db, identity } = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const adding = body?.action === "add";
    if (adding ? !name || name.length > 60 : body?.action !== "availability" || !/^[a-f0-9]{32}$/.test(body.id || "") || typeof body.available !== "boolean") {
      throw new StaffAccessError("Enter a truck name up to 60 characters or choose an existing truck.", 400);
    }

    const id = adding ? createHash("sha256").update(name.toLowerCase()).digest("hex").slice(0, 32) : body.id as string;
    const ref = db.collection("collection_trucks").doc(id);
    const available = adding || body.available === true;
    await db.runTransaction(async tx => {
      const [actor, saved] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)), tx.get(ref)]);
      const profile = actor.data() || {};
      if (staffRole(profile.role) !== "admin" || staffAccessProblem(profile, identity as unknown as Record<string, unknown>)) throw new StaffAccessError("Your MENRO access changed. Sign in again.");
      if (adding && saved.exists) throw new StaffAccessError("A truck with this name is already registered.", 409);
      if (!adding && !saved.exists) throw new StaffAccessError("This truck no longer exists. Reload the fleet.", 404);
      if (adding) tx.create(ref, { name, available, createdBy: identity.uid, createdAt: FieldValue.serverTimestamp() });
      else if (saved.data()?.available === available) return;
      else tx.update(ref, { available, updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection("audit_logs").doc(), {
        action: adding ? "truck.add" : "truck.availability", target: id, actor: identity.uid, available, at: FieldValue.serverTimestamp(),
      });
    });
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}
