import { authenticatedResident, certificateApiError } from "@/lib/firebase-request-auth";
import { buildCertificateSnapshot, CertificateError } from "@/lib/certificate-data";
import { generateCertificatePdf } from "@/lib/certificate-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await authenticatedResident(request, true);
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new CertificateError("Enter the event and signatory details for a preview.");
    const snapshot = buildCertificateSnapshot("preview", "preview", "preview", body, "Olivia Wilson");
    const pdf = await generateCertificatePdf(snapshot);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" } });
  } catch (error) { return certificateApiError(error); }
}
