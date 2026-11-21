import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { assertUniqueCollectionTruck, collectionTruckDetails, collectionTruckRecord } from "@/lib/collection-trucks";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { db } = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const snapshot = await db.collection("collection_trucks").orderBy("name").get();
    const trucks = snapshot.docs.map(doc => collectionTruckRecord(doc.id, doc.data()));
    return Response.json({ trucks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return staffApiError(error); }
}

export async function POST(request: Request) {
  try {
    const { db, identity } = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    const action = body?.action;
    const adding = action === "add";
    if (!adding && (!["edit", "availability"].includes(action) || typeof body.id !== "string" || !/^[a-f0-9]{32}$/.test(body.id))) {
      throw new StaffAccessError("Choose an existing truck.", 400);
    }
    if ((action === "availability" || (adding && body.available !== undefined)) && typeof body.available !== "boolean") {
      throw new StaffAccessError("Choose whether the truck is available.", 400);
    }
    if (action === "edit" && (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0)) {
      throw new StaffAccessError("Reopen the truck to review its latest details.", 400);
    }
    const details = action === "availability" ? null : collectionTruckDetails(body);
    const available = adding ? body.available !== false : body.available === true;
    const fleet = db.collection("collection_trucks");
    const ref = fleet.doc(adding ? randomUUID().replaceAll("-", "") : body.id);
    const rosterLock = db.collection("collection_fleet").doc("roster");

    await db.runTransaction(async tx => {
      const [actor, saved] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)), tx.get(ref)]);
      const profile = actor.data() || {};
      if (staffRole(profile.role) !== "admin" || staffAccessProblem(profile, identity as unknown as Record<string, unknown>)) {
        throw new StaffAccessError("Your MENRO access changed. Sign in again.");
      }
      const savedData = saved.data();
      if (!adding && !savedData) throw new StaffAccessError("This truck no longer exists. Reload the fleet.", 404);
      const current = collectionTruckRecord(ref.id, savedData || {});
      const update = { updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp() };
      if (details) {
        if (!adding) {
          if (Object.entries(details).every(([key, value]) => current[key as keyof typeof details] === value)) return;
          if (current.detailsRevision !== body.expectedRevision) throw new StaffAccessError("The truck details changed. Close this form and reopen the truck to review the latest details.", 409);
        }
        // Serialize name and plate changes so concurrent staff edits cannot introduce duplicates.
        const [, roster] = await Promise.all([tx.get(rosterLock), tx.get(fleet)]);
        assertUniqueCollectionTruck(details, roster.docs.filter(doc => doc.id !== ref.id).map(doc => collectionTruckRecord(doc.id, doc.data())));
        tx.set(rosterLock, { updatedAt: FieldValue.serverTimestamp() });
        if (adding) tx.create(ref, { ...details, available, detailsRevision: 0, createdBy: identity.uid, createdAt: FieldValue.serverTimestamp() });
        else tx.update(ref, { ...details, detailsRevision: current.detailsRevision + 1, ...update });
      } else {
        if (current.available === available) return;
        tx.update(ref, { available, ...update });
      }
      tx.create(db.collection("audit_logs").doc(), {
        action: "truck." + action, target: ref.id, actor: identity.uid,
        available: action === "edit" ? current.available : available, at: FieldValue.serverTimestamp(),
      });
    });
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}
