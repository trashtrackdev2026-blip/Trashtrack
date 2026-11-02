import {createHash} from "node:crypto";

// Content pin for the reviewed production policy. Re-publishing identical rules
// must not require copying credentials or changing private hosting variables.
export const APPROVED_FIRESTORE_PROJECT = "trashtrackprod";
export const APPROVED_FIRESTORE_POLICY_SHA256 = "d932b61d62d768098a8637292ac0cec7339a4db7929c2440472310758234fcd8";

export function matchesFirestorePolicy(live: {name:string;source:readonly {content:string}[]}, configuredRuleset: string, projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  if (!configuredRuleset) return false;
  if (projectId !== APPROVED_FIRESTORE_PROJECT) return live.name === configuredRuleset;
  return live.source?.length === 1 && createHash("sha256").update(live.source[0].content.replace(/\r\n/g,"\n")).digest("hex") === APPROVED_FIRESTORE_POLICY_SHA256;
}
