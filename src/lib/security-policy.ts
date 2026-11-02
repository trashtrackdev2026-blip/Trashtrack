import {createHash} from "node:crypto";

// Content pin for the reviewed production policy. Re-publishing identical rules
// must not require copying credentials or changing private hosting variables.
export const APPROVED_FIRESTORE_PROJECT = "trashtrackprod";
export const APPROVED_FIRESTORE_POLICY_SHA256 = "78fc24777b1265404ac29784df83ea7900e258b68774f9ac260156d34451c64f";

export function matchesFirestorePolicy(live: {name:string;source:readonly {content:string}[]}, configuredRuleset: string, projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  if (!configuredRuleset) return false;
  if (projectId !== APPROVED_FIRESTORE_PROJECT) return live.name === configuredRuleset;
  return live.source?.length === 1 && createHash("sha256").update(live.source[0].content.replace(/\r\n/g,"\n")).digest("hex") === APPROVED_FIRESTORE_POLICY_SHA256;
}
