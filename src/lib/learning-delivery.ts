export function learningDeliveryUrl(value: unknown, cloudName: string): string {
  const url = new URL(typeof value === "string" ? value : "");
  if (!cloudName || url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.port || url.username || url.password
      || !["raw","image"].some(kind => url.pathname.startsWith(`/${cloudName}/${kind}/upload/`))) throw new Error("Choose a document uploaded to this system's file host.");
  return url.href;
}

export async function verifyLearningDelivery(url: string, request: typeof fetch = fetch) {
  const response = await request(url,{method:"GET",headers:{Range:"bytes=0-1023"},redirect:"error",signal:AbortSignal.timeout(20000)});
  if (!response.ok) {
    await response.body?.cancel();
    if ([401,403].includes(response.status)) throw new Error("Cloudinary is blocking document delivery. In the Cloudinary product environment, open Settings → Security and enable ‘Allow delivery of PDF and ZIP files’. Wait for cached errors to expire, then use Recheck file delivery. Your uploaded file is kept.");
    throw new Error(response.status === 404 ? "The uploaded document could not be found. Upload the original file again." : "The document host is unavailable. Recheck delivery after your connection recovers.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The document host returned an empty file.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < 1024) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value.subarray(0,1024-length);
      chunks.push(chunk); length += chunk.length;
    }
  } finally { await reader.cancel(); }
  if (!length) throw new Error("The document host returned an empty file.");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  const text = new TextDecoder().decode(bytes);
  if (/\.pdf(?:$|[?#])/i.test(url) && !text.includes("%PDF-")) throw new Error("The file host returned a page instead of a PDF. Upload the original PDF again or use a direct public PDF link.");
  return {available:true};
}
