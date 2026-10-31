export function learningResourceType(url: string, fileName = "", resourceType = "Guide"): "none" | "document" | "video" | "image" | "article" {
  if (!url.trim()) return "none";
  let path = "";
  let host = "";
  try { const parsed = new URL(url); path = decodeURIComponent(parsed.pathname).toLowerCase(); host = parsed.hostname.toLowerCase(); } catch { /* Publishing validates the URL. */ }
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(host)) return "video";
  const target = fileName.toLowerCase() || path;
  if (/\.(pdf|docx?|pptx?|txt)$/.test(target)) return "document";
  if (/\.(mp4|webm|mov|avi|mkv|m4v|3gp)$/.test(target) || path.includes("/video/upload/")) return "video";
  if (/\.(jpe?g|png|gif|webp|bmp|heic)$/.test(target)) return "image";
  if (resourceType === "Video") return "video";
  return resourceType === "Article" ? "article" : "document";
}

export function publicLearningUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a complete https:// PDF, article or video link."); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error("Use a public HTTPS link for this learning material.");
  return url.href;
}

export function learningPreviewUrl(value: string): string | null {
  try {
    const url = new URL(publicLearningUrl(value));
    if (url.hostname === "res.cloudinary.com") {
      // Legacy upload links sometimes force attachment download, preventing an
      // embedded reader. Keep the original resource and all other URL options.
      url.pathname = url.pathname.replace(/\/fl_attachment(?::[^/,]+)?\//g, "/");
    }
    return url.href;
  } catch { return null; }
}
