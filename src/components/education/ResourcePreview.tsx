"use client";
import { useState } from "react";
import Image from "next/image";
import { learningResourceType, learningPreviewUrl, learningEmbeddedVideo } from "@/lib/learning-resource";

export function ResourcePreview({ resource }: { resource: { title: string; type: string; image: string; fileUrl?: string; videoUrl?: string; fileName?: string; fileType?: string; description?:string } }) {
  const [failed, setFailed] = useState(false);
  const source = learningPreviewUrl(resource.fileUrl || resource.videoUrl || resource.image || "");
  const kind = learningResourceType(source || "", resource.fileName, resource.type);
  const embedded=learningEmbeddedVideo(source || "");
  const isPdf = resource.fileType === "application/pdf" || /\.pdf(?:$|[?#])/i.test(source || "") || /\.pdf$/i.test(resource.fileName || "");
  if (!source && resource.type.toLowerCase()==="article" && resource.description?.trim()) return <article className="mb-5 whitespace-pre-wrap break-words rounded-xl border bg-white/60 p-5 text-sm leading-relaxed">{resource.description}</article>;
  if (!source) return <p className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">This resource has no usable public link. Upload the original file again or publish a public HTTPS link.</p>;
  return <div key={source} className="mb-5 space-y-3">
    {kind === "image" && !failed && <div className="relative h-64"><Image src={source} alt={resource.title} fill sizes="(max-width: 767px) 90vw, 720px" className="rounded-lg object-contain" onError={()=>setFailed(true)} /></div>}
    {kind === "video" && !failed && (embedded ? <iframe title={resource.title + " video"} src={embedded} className="aspect-video w-full rounded-lg border" allow="fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" /> : <video src={source} controls preload="metadata" className="max-h-72 w-full rounded-lg" onError={() => setFailed(true)} />)}
    {isPdf && !failed && <iframe title={`${resource.title} PDF preview`} src={source + (source.includes("#") ? "" : "#view=FitH")} className="h-[min(55dvh,560px)] w-full rounded-lg border bg-white" onError={() => setFailed(true)} />}
    <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold text-green-800 underline">{isPdf ? "Open PDF in a new tab" : kind === "article" ? "Read article" : kind === "video" ? "Open video" : "Open document"}</a>
    {(isPdf || failed) && <p className="text-xs text-muted-foreground">If the preview is unavailable, open the file in a new tab. An access-denied or missing-file response requires MENRO to restore file delivery or republish the original document.</p>}
  </div>;
}
