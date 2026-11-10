import { readFileSync } from "node:fs";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedAccount, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError } from "@/lib/staff-access";
import { validateBaleteBoundaries } from "@/lib/barangay-geofence";
import { reportSubmission } from "@/lib/report-submission";
import { manilaDateTime } from "@/lib/scheduling-time";
import { analyticsReportDate } from "@/lib/analytics-data";

export const runtime = "nodejs";
const boundaries = validateBaleteBoundaries(JSON.parse(readFileSync(path.join(process.cwd(), "public/geojson/balete_barangays.json"), "utf8")));
const dailyLimit = 5;

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
      if (previous.exists) return ref.id;

      const { date, time } = manilaDateTime();
      const quotaRef = db.collection("resident_report_quota").doc(identity.uid);
      const quota = (await tx.get(quotaRef)).data();
      let count = quota?.day === date ? quota.count : 0;
      if (!quota) {
        // On first use, count earlier submissions from today without reading evidence or report text.
        const history = await tx.get(db.collection("reports").where("userId", "==", identity.uid).select("date", "createdAt", "timestamp"));
        count = history.docs.filter(item => {
          const submitted = analyticsReportDate(item.data());
          return submitted && manilaDateTime(submitted.getTime()).date === date;
        }).length;
      }
      if (count >= dailyLimit) {
        throw new StaffAccessError("You've reached today's limit of 5 reports. Your draft is still here. You can submit again after midnight (Philippine time).", 429);
      }
      tx.create(ref, { ...report, userId: identity.uid, date: `${date} ${time}`, createdAt: FieldValue.serverTimestamp() });
      tx.set(quotaRef, { day: date, count: count + 1 });
      return ref.id;
    });
    return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return staffApiError(error); }
}
