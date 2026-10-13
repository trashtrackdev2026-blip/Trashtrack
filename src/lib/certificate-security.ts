import "server-only";
import { getSecurityRules } from "firebase-admin/security-rules";
import { getFirebaseAdminApp } from "./firebase-admin";
import { CertificateError } from "./certificate-data";

export async function requireCertificateSecurity() {
  const expected = process.env.CERTIFICATE_SECURITY_RULESET;
  // Firebase Admin returns a short ruleset UUID, scoped to its configured project.
  if (!expected || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(expected)) {
    throw new CertificateError("Certificate setup is not complete. Please contact the event organizer.", 503);
  }
  const live = await getSecurityRules(getFirebaseAdminApp()).getFirestoreRuleset();
  if (live.name !== expected) {
    throw new CertificateError("Certificate setup is not complete. Please contact the event organizer.", 503);
  }
}
