import { getAuth } from "firebase-admin/auth";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError } from "@/lib/staff-access";

export async function POST(request: Request) {
  try {
    const { app } = await authenticatedStaff(request, true);
    const body = await request.json().catch(() => null);
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100
      || ids.some(id => typeof id !== "string" || !id.trim() || id.length > 128)) {
      throw new StaffAccessError("Provide up to 100 valid account IDs.", 400);
    }

    await requireStaffSecurity();
    const { users } = await getAuth(app).getUsers([...new Set<string>(ids)].map(uid => ({ uid })));
    return Response.json({
      dates: users.map(user => ({ id: user.uid, createdAt: user.metadata.creationTime })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return staffApiError(error);
  }
}
