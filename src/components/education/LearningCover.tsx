"use client";
import {useState} from "react";
import Image from "next/image";
import {FileText,PlayCircle} from "lucide-react";
import {learningCover,learningResourceType} from "@/lib/learning-resource";

export function LearningCover({resource}:{resource:{title:string;type:string;coverUrl?:string;thumbnailUrl?:string;image?:string;fileUrl?:string;videoUrl?:string;fileName?:string}}) {
  const url=learningCover(resource);
  const [failed,setFailed]=useState<string|null>(null);
  const video=learningResourceType(resource.fileUrl||resource.videoUrl||resource.image||"",resource.fileName,resource.type)==="video";
  return url&&failed!==url?<Image src={url} alt={`Preview of ${resource.title}`} unoptimized fill sizes="(max-width:767px) 90px, 150px" className="object-cover" onError={()=>setFailed(url)}/>:video?<PlayCircle className="h-10 w-10" aria-hidden="true"/>:<FileText className="h-10 w-10" aria-hidden="true"/>;
}
