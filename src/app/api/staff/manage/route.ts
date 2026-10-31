import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, validStaffBarangay, staffAccessProblem, staffAssignmentFields, staffRole, requestFields } from "@/lib/staff-access";

export async function GET(request: Request) {
  try {
    const { app, db } = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const auth = getAuth(app);
    const email = new URL(request.url).searchParams.get("email");
    if (email !== null) {
      if (!email.trim() || email.length > 254) throw new StaffAccessError("Enter the registered official's email.", 400);
      const account = await auth.getUserByEmail(email.trim()).catch(error => {
        if (error.code === "auth/user-not-found") throw new StaffAccessError("No registered account uses that email. Ask the official to register first.", 404);
        if (error.code === "auth/invalid-email") throw new StaffAccessError("Enter a valid email address.", 400);
        throw error;
      });
      const [profileSnap, requestSnap] = await Promise.all([
        db.collection("users").doc(account.uid).get(), db.collection("staff_requests").doc(account.uid).get(),
      ]);
      const profile = profileSnap.data() || {};
      return Response.json({ account: { id: account.uid, email: account.email || email.trim(), emailVerified: account.emailVerified,
        disabled: account.disabled, name: profile.name || account.displayName || "", barangay: profile.barangay || "",
        contact: profile.contact || "", position: profile.position || "", role: profile.role || "Resident",
        accessStatus: profile.accessStatus || "needs-review", requestStatus: requestSnap.data()?.status || null } },
      { headers: { "Cache-Control": "private, no-store" } });
    }
    const [requests, users, logs] = await Promise.all([
      db.collection("staff_requests").get(), db.collection("users").where("role", "in", ["Admin", "Semi-Admin", "admin", "semi-admin"]).get(),
      db.collection("audit_logs").orderBy("at", "desc").limit(40).get(),
    ]);
    // Read verification from Auth rather than the original registration token.
    // Verification can happen in another tab without the official signing in again.
    const pending = requests.docs.filter(doc => doc.data().status === "pending");
    const batches = [];
    for (let index = 0; index < pending.length; index += 100) batches.push(auth.getUsers(pending.slice(index, index + 100).map(doc => ({ uid: doc.id }))));
    const accounts = new Map((await Promise.all(batches)).flatMap(batch => batch.users).map(account => [account.uid, account]));
    return Response.json({
      requests: requests.docs.map(doc => {
        const record = doc.data();
        const account = accounts.get(doc.id);
        return { ...record, id: doc.id, ...(record.status === "pending" ? { email: account?.email || record.email || "",
          emailVerified: account?.emailVerified === true, accountUnavailable: !account || account.disabled } : {}) };
      }),
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
    if (!body || !["approve", "assign", "recover", "reject", "suspend", "reactivate"].includes(body.action) || typeof body.userId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.userId)) throw new StaffAccessError("Choose a valid staff action.", 400);
    if (body.userId === identity.uid) throw new StaffAccessError("You cannot change your own staff access.", 409);
    const assignment = ["approve", "assign"].includes(body.action) ? staffAssignmentFields(body) : null;
    const recovery = body.action === "recover" ? requestFields(body) : null;
    if (body.action === "assign" && body.role === undefined) throw new StaffAccessError("Choose the account's access role.", 400);
    const auth = getAuth(app);
    const targetAuth = await auth.getUser(body.userId);
    if (["approve", "assign", "recover", "reactivate"].includes(body.action) && (!targetAuth.emailVerified || !targetAuth.email)) throw new StaffAccessError("The official must verify their email first.", 409);
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
      if (body.action === "recover") {
        if (String(current?.role).toLowerCase() === "resident" && !requestSnap.data()) throw new StaffAccessError("Resident emails cannot be converted into staff accounts. Ask the official to register a separate staff email.", 409);
        if (targetAuth.disabled || ["suspended", "disabled", "activating"].includes(String(current?.accessStatus))) throw new StaffAccessError("Resolve this account's existing staff access before adding a request.", 409);
        if (staffRole(current?.role) === "admin" || (staffRole(current?.role) && current?.accessStatus === "active")) throw new StaffAccessError("This account already has staff access. Use Change access instead.", 409);
        if (requestSnap.data()?.status === "pending") throw new StaffAccessError("This official already appears in pending requests. Refresh the list.", 409);
        if (!current) tx.set(targetRef, { name: recovery!.name, email: targetAuth.email, contact: recovery!.contact,
          barangay: recovery!.barangay, role: "Semi-Admin", accessStatus: "needs-review", points: 0, createdAt: FieldValue.serverTimestamp() });
        tx.set(requestRef, { ...recovery!, userId: body.userId, email: targetAuth.email, status: "pending",
          submittedBy: identity.uid, submittedAt: FieldValue.serverTimestamp() });
        tx.create(db.collection("audit_logs").doc(), { action: "staff.request.recovered", actor: identity.uid,
          target: body.userId, barangay: recovery!.barangay, at: FieldValue.serverTimestamp() });
        return current;
      }
      if (body.action === "approve") {
        if (requestSnap.data()?.status !== "pending" || staffRole(current?.role) === "admin") throw new StaffAccessError("This account has no pending staff request.", 409);
        const details = requestFields({ ...requestSnap.data(), ...(typeof body.position === "string" ? { position: body.position } : {}) });
        const approved = { ...assignment!, name: details.name, position: details.position,
          email: targetAuth.email, contact: details.contact, mfaRequired: current?.mfaRequired === true || actorSnap.data()?.mfaRequired === true };
        tx.set(targetRef, { ...approved, accessStatus: "activating", pendingAccessOperation: operation }, { merge: true });
        return approved;
      }
      if (body.action === "assign") {
        if (staffRole(current?.role) === "admin") throw new StaffAccessError("MENRO Admin roles cannot be changed through barangay staff management.", 403);
        if (!current || !staffRole(current.role) || current.accessStatus !== "active" || targetAuth.disabled) throw new StaffAccessError("Reactivate or approve this staff account before changing its access.", 409);
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
        if (body.action === "approve") tx.update(requestRef, { status: "approved", position: target!.position, needsOfficialDetails: false, approvedRole: target!.role, approvedBarangay: target!.barangay, reviewedBy: identity.uid, reviewedAt: FieldValue.serverTimestamp() });
        tx.create(db.collection("audit_logs").doc(), { action: "staff." + body.action, actor: identity.uid,
          target: body.userId, role: target!.role, barangay: target!.barangay || "", at: FieldValue.serverTimestamp() });
      });
    }
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}

