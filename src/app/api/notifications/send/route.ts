import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffRole } from "@/lib/staff-access";
import { queuePhoneNotification } from "@/lib/notification-delivery";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { app, db, profile } = await authenticatedStaff(request);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (typeof body?.notificationId !== "string" || !/^[\w-]{1,256}$/.test(body.notificationId)) throw new StaffAccessError("A valid saved notification ID is required.", 400);
    const data = (await db.collection("notifications").doc(body.notificationId).get()).data();
    if (!data) throw new StaffAccessError("Notification not found.", 404);
    if (staffRole(profile.role) !== "admin" && data.recipients !== profile.barangay) throw new StaffAccessError("Send notifications only to your assigned barangay.");
    await queuePhoneNotification(app, db, body.notificationId);
    return Response.json({ queued: true });
  } catch (error) { return staffApiError(error); }
}
