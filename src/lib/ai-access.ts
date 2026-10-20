import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { authenticatedAccount } from "./staff-auth";
import { StaffAccessError } from "./staff-access";
export async function authenticatedScanner(request: Request) {
  const account = await authenticatedAccount(request);
  if (!account.profile.role) throw new StaffAccessError("Complete account registration first.");
  return account;
}

// Chat keeps its server-side counter; object scanning has no per-user request quota.
export async function authenticatedAi(request: Request) {
  const account = await authenticatedScanner(request);
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
