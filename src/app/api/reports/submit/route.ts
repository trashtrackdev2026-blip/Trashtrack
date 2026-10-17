import { readFileSync } from "node:fs";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedAccount, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError } from "@/lib/staff-access";
import { validateBaleteBoundaries } from "@/lib/barangay-geofence";
import { reportSubmission } from "@/lib/report-submission";

export const runtime = "nodejs";
const boundaries = validateBaleteBoundaries(JSON.parse(readFileSync(path.join(process.cwd(), "public/geojson/balete_barangays.json"), "utf8")));

export async function POST(request: Request) {
  try {
    const { db, identity } = await authenticatedAccount(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new StaffAccessError("Provide valid report details.", 400);
    // The profile and pin are validated together so a changed assignment cannot race submission.
    const id = await db.runTransaction(async tx => {
      const profile = (await tx.get(db.collection("users").doc(identity.uid))).data() || {};
      if (["suspended", "disabled"].includes(profile.accessStatus)) throw new StaffAccessError("This account is suspended.");
      const report = reportSubmission(body, profile, boundaries, process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "");
      const ref = db.collection("reports").doc(`${identity.uid}_${body.requestId}`);
      const previous = await tx.get(ref);
      if (!previous.exists) tx.create(ref, { ...report, userId: identity.uid,
        date: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).slice(0, 16), createdAt: FieldValue.serverTimestamp() });
      return ref.id;
    });
    return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return staffApiError(error); }
}
