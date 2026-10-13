import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, validStaffBarangay, staffAccessProblem, staffAssignmentFields, staffRole } from "@/lib/staff-access";

export async function GET(request: Request) {
  try {
    const { db } = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const [requests, users, logs] = await Promise.all([
      db.collection("staff_requests").get(), db.collection("users").where("role", "in", ["Admin", "Semi-Admin", "admin", "semi-admin"]).get(),
      db.collection("audit_logs").orderBy("at", "desc").limit(40).get(),
    ]);
    return Response.json({
      requests: requests.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      staff: users.docs.filter(doc => ["admin", "semi-admin"].includes(String(doc.data().role).toLowerCase())).map(doc => ({
        id: doc.id, name: doc.data().name, email: doc.data().email || "", role: doc.data().role,
        barangay: doc.data().barangay || "", accessStatus: doc.data().accessStatus || "needs-review",
      })),
      logs: logs.docs.map(doc => ({ id: doc.id, action: doc.data().action, actor: doc.data().actor, target: doc.data().target,
        role: doc.data().role || "", barangay: doc.data().barangay || "", at: doc.data().at?.toDate?.().toISOString() || "" })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return staffApiError(error); }
}

export async function POST(request: Request) {
  try {
    const { app, db, identity } = await authenticatedStaff(request, true, true);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || !["approve", "assign", "reject", "suspend", "reactivate"].includes(body.action) || typeof body.userId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.userId)) throw new StaffAccessError("Choose a valid staff action.", 400);
    if (body.userId === identity.uid) throw new StaffAccessError("You cannot change your own staff access.", 409);
    const assignment = ["approve", "assign"].includes(body.action) ? staffAssignmentFields(body) : null;
    if (body.action === "assign" && body.role === undefined) throw new StaffAccessError("Choose the account's access role.", 400);
    const auth = getAuth(app);
    const targetAuth = await auth.getUser(body.userId);
    if (["approve", "assign", "reactivate"].includes(body.action) && (!targetAuth.emailVerified || !targetAuth.email)) throw new StaffAccessError("The official must verify their email first.", 409);
    const targetRef = db.collection("users").doc(body.userId);
    const requestRef = db.collection("staff_requests").doc(body.userId);
    const operation = randomUUID();
    // Validate before touching Auth. Activation stays blocked across the two services.
    const target = await db.runTransaction(async tx => {
      const [actorSnap, targetSnap, requestSnap, masters] = await Promise.all([
        tx.get(db.collection("users").doc(identity.uid)), tx.get(targetRef), tx.get(requestRef),
        tx.get(db.collection("users").where("role", "in", ["Admin", "admin"])),
      ]);
      if (staffRole(actorSnap.data()?.role) !== "admin" || staffAccessProblem(actorSnap.data() || {}, identity as unknown as Record<string, unknown>)) throw new StaffAccessError("Your access changed. Sign in again.");
      const current = targetSnap.data();
      if (body.action === "approve") {
        if (requestSnap.data()?.status !== "pending" || staffRole(current?.role) === "admin") throw new StaffAccessError("This account has no pending staff request.", 409);
        const approved = { ...assignment!, name: requestSnap.data()!.name,
          email: targetAuth.email, contact: requestSnap.data()!.contact, mfaRequired: current?.mfaRequired === true || actorSnap.data()?.mfaRequired === true };
        tx.set(targetRef, { ...approved, accessStatus: "activating", pendingAccessOperation: operation }, { merge: true });
        return approved;
      }
      if (body.action === "assign") {
        if (!current || !staffRole(current.role) || current.accessStatus !== "active" || targetAuth.disabled) throw new StaffAccessError("Reactivate or approve this staff account before changing its access.", 409);
        if (staffRole(current.role) === "admin" && assignment!.role !== "Admin" && masters.docs.filter(doc => doc.data().accessStatus === "active").length <= 1) throw new StaffAccessError("The last active MENRO Admin cannot be demoted.", 409);
        tx.update(targetRef, { ...assignment!, accessStatus: "activating", pendingAccessOperation: operation,
          accessChangedBy: identity.uid, accessChangedAt: FieldValue.serverTimestamp() });
        return { ...current, ...assignment! };
      }
      if (body.action === "reject") {
        if (requestSnap.data()?.status !== "pending") throw new StaffAccessError("This request is no longer pending.", 409);
        tx.update(requestRef, { status: "rejected", reviewedBy: identity.uid, reviewedAt: FieldValue.serverTimestamp() });
      } else {
        if (!current || !staffRole(current.role)) throw new StaffAccessError("Staff account not found.", 404);
        if (body.action === "suspend" && staffRole(current.role) === "admin" && masters.docs.filter(doc => doc.data().accessStatus === "active").length <= 1) throw new StaffAccessError("The last active Master Admin cannot be suspended.", 409);
        if (body.action === "reactivate" && staffRole(current.role) === "semi-admin" && !validStaffBarangay(current.barangay)) throw new StaffAccessError("Approve a valid barangay assignment before reactivation.", 409);
        tx.update(targetRef, { accessStatus: body.action === "suspend" ? "suspended" : "activating",
          pendingAccessOperation: operation, accessChangedBy: identity.uid, accessChangedAt: FieldValue.serverTimestamp() });
      }
      if (body.action !== "reactivate") tx.create(db.collection("audit_logs").doc(), {
        action: "staff." + body.action, actor: identity.uid, target: body.userId, at: FieldValue.serverTimestamp(),
      });
      return current;
    });
    if (body.action === "suspend") {
      await auth.updateUser(body.userId, { disabled: true });
      await auth.revokeRefreshTokens(body.userId);
    } else if (["approve", "assign", "reactivate"].includes(body.action)) {
      await auth.setCustomUserClaims(body.userId, { ...targetAuth.customClaims,
        staffRole: staffRole(target!.role), staffBarangay: staffRole(target!.role) === "admin" ? "" : target!.barangay });
      await auth.revokeRefreshTokens(body.userId);
      await auth.updateUser(body.userId, { disabled: false });
      await db.runTransaction(async tx => {
        const [latest, actor] = await Promise.all([tx.get(targetRef), tx.get(db.collection("users").doc(identity.uid))]);
        if (staffRole(actor.data()?.role) !== "admin" || staffAccessProblem(actor.data() || {}, identity as unknown as Record<string, unknown>) || latest.data()?.pendingAccessOperation !== operation || latest.data()?.accessStatus !== "activating") throw new StaffAccessError("Access changed during approval. Refresh and try again.", 409);
        tx.update(targetRef, { accessStatus: "active", staffValidAfter: Math.floor(Date.now() / 1000), pendingAccessOperation: FieldValue.delete(),
          approvedBy: identity.uid, approvedAt: FieldValue.serverTimestamp() });
        if (body.action === "approve") tx.update(requestRef, { status: "approved", approvedRole: target!.role, approvedBarangay: target!.barangay, reviewedBy: identity.uid, reviewedAt: FieldValue.serverTimestamp() });
        tx.create(db.collection("audit_logs").doc(), { action: "staff." + body.action, actor: identity.uid,
          target: body.userId, role: target!.role, barangay: target!.barangay || "", at: FieldValue.serverTimestamp() });
      });
    }
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}

