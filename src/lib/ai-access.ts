import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { authenticatedAccount } from "./staff-auth";
import { StaffAccessError } from "./staff-access";
// The counter is stored server-side so restarting the LAN server does not reset limits.
export async function authenticatedAi(request: Request) {
  const account = await authenticatedAccount(request);
  if (!account.profile.role) throw new StaffAccessError("Complete account registration first.");
  const bucket = Math.floor(Date.now() / 60000);
  const ref = account.db.collection("api_limits").doc(account.identity.uid);
  await account.db.runTransaction(async tx => {
    const previous = (await tx.get(ref)).data();
    const count = previous?.bucket === bucket ? Number(previous.count) : 0;
    if (count >= 15) throw new StaffAccessError("Too many AI requests. Wait a minute before trying again.", 429);
    tx.set(ref, { bucket, count: count + 1, expiresAt: Timestamp.fromMillis(Date.now() + 2 * 60000) });
  });
  return account;
}
