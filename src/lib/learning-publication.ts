import { learningResourceType, publicLearningUrl, learningCover } from "./learning-resource.ts";

export const LEARNING_CATEGORIES = ["Waste Segregation", "Composting", "Recycling", "Environmental Awareness"] as const;
export const LEARNING_TYPES = ["Guide", "Video", "Article"] as const;
export const learningCategoryKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "-");

export function learningPublicationFields(form: {title:string;category:string;type:string;description:string;image:string;videoUrl:string;fileName:string;coverUrl:string}) {
  const title=form.title.trim(), description=form.description.trim();
  if (!title || title.length>150) throw new Error("Enter a resource title of 1–150 characters.");
  if (!(LEARNING_CATEGORIES as readonly string[]).includes(form.category) || !(LEARNING_TYPES as readonly string[]).includes(form.type)) throw new Error("Choose a learning category and resource type.");
  if (description.length>20_000) throw new Error("Keep article content or the description within 20,000 characters.");
  const raw=(form.image || form.videoUrl).trim();
  if (!raw && (form.type!=="Article" || !description)) throw new Error(form.type==="Article" ? "Write the article content, upload a document, or paste its public link." : "Upload the learning file or paste its public HTTPS link.");
  const source=raw ? publicLearningUrl(raw) : "";
  const detected=source ? learningResourceType(source,form.fileName,form.type) : "article";
  const coverUrl=form.coverUrl.trim() ? publicLearningUrl(form.coverUrl) : "";
  if(coverUrl && learningResourceType(coverUrl)!=="image") throw new Error("Use a public JPG, PNG or WebP URL for the optional cover image.");
  if(form.type==="Video" && detected!=="video") throw new Error("Choose a playable video file or video link. Upload a cover using the optional cover control.");
  return { title,category:form.category,type:form.type,description,status:"Published",image:detected==="image"?source:"",coverUrl,
    thumbnailUrl:learningCover({coverUrl,fileUrl:source,fileName:form.fileName,type:form.type}) || "",
    videoUrl:detected==="video"?source:"",fileUrl:source,fileType:detected,fileName:form.fileName || "" };
}
