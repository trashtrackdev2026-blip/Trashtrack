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

export function learningCover(resource: {coverUrl?: string; thumbnailUrl?:string; image?: string; fileUrl?:string; videoUrl?:string; fileName?:string; type?:string}): string | null {
  for (const value of [resource.coverUrl,resource.thumbnailUrl]) {
    const url=learningPreviewUrl(value || "");
    if(url && learningResourceType(url)==="image") return url;
  }
  const source = learningPreviewUrl(resource.fileUrl || resource.videoUrl || resource.image || "");
  if (source) {
    if (learningResourceType(source,resource.fileName,resource.type) === "image") return source;
    const url = new URL(source);
    // Provider transformations refer only to an existing uploaded asset; no server URL fetch.
    if (url.hostname === "res.cloudinary.com" && !url.port && !url.username && !url.password) {
      if (/^\/[^/]+\/video\/upload\//.test(url.pathname)) {
        url.pathname = url.pathname.replace("/video/upload/","/video/upload/so_0,w_640,h_360,c_fill/").replace(/\.[a-z0-9]+$/i,".jpg");return url.href;
      }
      if (/^\/[^/]+\/image\/upload\//.test(url.pathname) && /\.pdf$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace("/image/upload/","/image/upload/pg_1,w_640,h_420,c_fit,b_white/").replace(/\.pdf$/i,".jpg");return url.href;
      }
    }
    const embedded = learningEmbeddedVideo(source);
    const id = embedded?.split("/").at(-1);
    if (id && /^[\w-]{11}$/.test(id)) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

export function learningEmbeddedVideo(value: string): string | null {
  try {
    const url=new URL(value),host=url.hostname.toLowerCase().replace(/^www\./,"");
    const id=host==="youtu.be"?url.pathname.split("/")[1]:["youtube.com","m.youtube.com","youtube-nocookie.com"].includes(host)?url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]:null;
    return id && /^[\w-]{11}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}`:null;
  } catch {return null;}
}
