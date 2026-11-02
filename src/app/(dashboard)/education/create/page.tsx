"use client";

import { staffRequest } from "@/lib/staff-client";
import { useState } from "react";
import { learningResourceType, publicLearningUrl, learningPreviewUrl } from "@/lib/learning-resource";
import { LEARNING_CATEGORIES, LEARNING_TYPES, learningPublicationFields } from "@/lib/learning-publication";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  UploadCloud,
  Send, 
  Image as ImageIcon, 
  LayoutDashboard, 
  FileText, 
  X, 
  Film, 
  PlayCircle
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function CreateEducationResourcePage() {
  const [form, setForm] = useState({
    title: "",
    category: "Waste Segregation",
    type: "Guide",
    image: "",
    coverUrl: "",
    videoUrl: "",
    fileName: "",
    description: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pendingDocument,setPendingDocument]=useState<{url:string;name:string}|null>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const coverPreview=learningPreviewUrl(form.coverUrl);

  const getFileType = (url: string, fileName = "") => learningResourceType(url, fileName, form.type);

  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0];if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024){setUploadError("Choose a JPG, PNG or WebP cover smaller than 8 MB.");event.target.value="";return;}
    setIsUploading(true);setUploadError("");
    try {
      const cloud=process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,preset=process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if(!cloud||!preset)throw new Error("Media upload is not configured.");
      const data=new FormData();data.append("file",file);data.append("upload_preset",preset);
      const response=await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`,{method:"POST",body:data,signal:AbortSignal.timeout(60_000)});
      const result=await response.json();if(!response.ok||!result.secure_url)throw new Error("The cover could not be uploaded. Try again.");
      setForm(current=>({...current,coverUrl:publicLearningUrl(result.secure_url)}));
    }catch(failure){setUploadError(failure instanceof Error?failure.message:"The cover could not be uploaded.");}
    finally{setIsUploading(false);event.target.value="";}
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");setPendingDocument(null);
    const document = /\.(pdf|docx?|pptx?|txt)$/i.test(file.name);
    const limit = (document ? 25 : 50) * 1024 * 1024;
    if (file.size > limit) { setUploadError(`Choose a file smaller than ${document ? 25 : 50} MB.`); return; }
    setIsUploading(true);
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) throw new Error("Media uploads are not configured. Ask MENRO to configure Cloudinary, or paste a public link.");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      // Raw documents preserve the original file and extension for the resident reader.
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${/\.pdf$/i.test(file.name) ? "image" : document ? "raw" : "auto"}/upload`, {
        method: "POST", body: formData, signal: AbortSignal.timeout(120_000),
      });
      const data = await res.json();
      if (!res.ok || !data.secure_url) throw new Error(data.error?.message || "Upload failed. Check Cloudinary upload settings and retry.");
      const url = publicLearningUrl(data.secure_url);
      if (document) {
        setPendingDocument({url,name:file.name});
        await staffRequest("/api/learning/verify",{url});
        setPendingDocument(null);
      }
      setForm(prev => ({ ...prev, image: url, videoUrl: "", fileName: file.name }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally { setIsUploading(false); e.target.value = ""; }
  };

  const handlePublish = async () => {
    if (isSubmitting || isUploading || pendingDocument) return;
    setUploadError("");setIsSubmitting(true);
    try {
      const fields=learningPublicationFields(form);
      await addDoc(collection(db, "educational_resources"), {
        ...fields,
        date:new Date().toLocaleDateString("en-US",{timeZone:"Asia/Manila",month:"short",day:"numeric",year:"numeric"}),
        createdAt:serverTimestamp(),
      });
      setIsSuccess(true);
    } catch (e) {
      console.error("Error publishing resource:", e);
      setUploadError(e instanceof Error ? e.message : "Failed to publish resource. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-8 max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="tt-legacy-heading flex flex-col gap-2">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">
            {isSuccess ? "Resource Published" : "Add Educational Resource"}
          </h1>
          <p className="text-sm text-slate-500">
            {isSuccess 
              ? "The educational resource has been successfully published to residents." 
              : "Create a new guide, video, or article to educate the community on waste management."}
          </p>
        </div>

        {pendingDocument && <div className="tt-surface space-y-3 p-5"><p className="text-sm">“{pendingDocument.name}” uploaded, but delivery has not passed verification. It is not published yet.</p><Button disabled={isUploading} variant="outline" onClick={async()=>{setIsUploading(true);setUploadError("");try{await staffRequest("/api/learning/verify",{url:pendingDocument.url});setForm(current=>({...current,image:pendingDocument.url,videoUrl:"",fileName:pendingDocument.name}));setPendingDocument(null);}catch(error){setUploadError(error instanceof Error?error.message:"Delivery check failed.");}finally{setIsUploading(false);}}}>Recheck file delivery</Button><a href="https://cloudinary.com/documentation/image_delivery_options" target="_blank" rel="noopener noreferrer" className="ml-4 text-sm text-green-800 underline">File delivery setup help</a></div>}
        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-8">

          <div className="flex-1 tt-surface p-8">
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <div className="w-20 h-20 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-6 relative">
                  <Send className="w-10 h-10 text-[#2E7D32]" />
                </div>

                <h2 className="text-2xl font-bold text-[#2E7D32] mb-3">Resource Published Successfully!</h2>
                <p className="text-sm text-slate-600 mb-10 max-w-md">
                  Your new educational material &quot;{form.title}&quot; is now live and accessible to all residents in the TrashTrack app.
                </p>

                <div className="flex gap-4 w-full max-w-md mx-auto mb-4">
                  <Link href="/education" className="w-full">
                    <Button className="w-full h-12 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-bold rounded-xl shadow-sm">
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Back to Resources
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-8">

                <div className="space-y-6 max-w-2xl">
                  <div className="rounded-2xl border border-[#cbd9c7] bg-[#f7f4e9] p-5">
                    <p className="font-semibold">Cover photo <span className="text-xs font-normal">(optional)</span></p>
                    <p className="mt-1 text-sm text-muted-foreground">PDF pages and supported video frames appear automatically. Add your own cover here.</p>
                    <label className="mt-4 flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-[#8ba88f] bg-white/70 p-5 focus-within:ring-2 focus-within:ring-green-800">
                      <UploadCloud aria-hidden="true" className="h-8 w-8 shrink-0 text-[#194f40]"/>
                      <span className="flex-1"><strong className="block">{isUploading ? "Uploading…" : "Choose a cover photo"}</strong><small>JPG, PNG or WebP · up to 8 MB</small></span>
                      <span className="rounded-full bg-[#194f40] px-4 py-2 text-sm font-semibold text-white">Browse files</span>
                      <input aria-label="Choose a cover photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={isUploading||isSubmitting} onChange={event=>void uploadCover(event)} className="sr-only"/>
                    </label>
                    {coverPreview && learningResourceType(coverPreview)==="image" && <div className="mt-3 flex items-center gap-3"><div className="relative h-20 w-28 overflow-hidden rounded-xl"><Image unoptimized src={coverPreview} alt="Selected cover" fill sizes="112px" className="object-cover"/></div><Button type="button" variant="outline" onClick={()=>setForm(current=>({...current,coverUrl:""}))}>Remove cover</Button></div>}
                  </div>
                  <label className="block text-sm font-semibold">Cover image URL (optional)<Input type="url" value={form.coverUrl} onChange={e=>setForm({...form,coverUrl:e.target.value})} placeholder="https://.../cover.jpg" className="mt-2"/><span className="mt-2 block text-xs font-normal text-slate-600">Use a cover photo for a document or video. The original learning file stays separate.</span></label>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Resource Title <span className="text-red-500">*</span></label>
                    <Input 
                      value={form.title} 
                      onChange={(e) => setForm({...form, title: e.target.value})} 
                      placeholder="e.g. Proper Composting at Home" 
                      className="h-11 bg-white border-slate-200" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Category <span className="text-red-500">*</span></label>
                      <Select value={form.category} onValueChange={(val) => val && setForm({...form, category: val})}>
                        <SelectTrigger className="w-full bg-white border-slate-200 h-11">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEARNING_CATEGORIES.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Resource Type <span className="text-red-500">*</span></label>
                      <Select 
                        value={form.type} 
                        onValueChange={(val) => {
                          if (val) {
                            setForm({...form, type: val});
                            if (val === "Video") {
                              setUploadMode("file");
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-full bg-white border-slate-200 h-11">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEARNING_TYPES.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="learning-content" className="text-xs font-bold text-slate-700 uppercase tracking-wide">{form.type==="Article" ? "Article content / description" : "Description / Content"}</label>
                    <textarea id="learning-content" maxLength={20000}
                      rows={5}
                      value={form.description}
                      onChange={(e) => setForm({...form, description: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2E7D32] resize-none"
                      placeholder="Provide a brief summary or the content of the educational resource..."
                    />
                  </div>

                  {form.type==="Article" && <p className="rounded-xl bg-[#eaf0df] p-4 text-sm">Write the article above, or attach a document or public article link below. An attachment and cover photo are optional for a written article.</p>}
                  {/* File Upload Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        {form.type === "Video" ? "Video File, Stream URL, or Cover" : "Cover Image, Video or Document"}
                      </label>
                      {(
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setUploadMode("file")}
                            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${uploadMode === "file" ? "bg-[#1B5E20] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                          >
                            Upload File
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadMode("url")}
                            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${uploadMode === "url" ? "bg-[#1B5E20] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                          >
                            Paste Link
                          </button>
                        </div>
                      )}
                    </div>

                    {uploadMode === "url" ? (
                      <div className="space-y-2">
                        <Input
                          value={form.videoUrl}
                          onChange={(e) => { setPendingDocument(null); setUploadError(""); setForm({ ...form, videoUrl: e.target.value, image: e.target.value, fileName: "" }); }}
                          placeholder="https://... public PDF, article or video link"
                          className="h-11 bg-white border-slate-200"
                        />
                        <p className="text-[11px] text-slate-500">Use a public link that residents can open without signing in. Choose Article for web pages; use a direct file link for PDFs.</p>
                      </div>
                    ) : (
                      <label className="w-full min-h-[160px] border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center hover:bg-slate-50 cursor-pointer transition-colors relative overflow-hidden p-4">
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                          onChange={handleFileUpload} 
                          disabled={isUploading} 
                        />

                        {isUploading ? (
                          <div className="flex flex-col items-center justify-center z-10 bg-white/90 absolute inset-0">
                            <span className="text-xs font-semibold text-[#2E7D32] animate-pulse">Uploading media...</span>
                          </div>
                        ) : null}

                        {form.image ? (
                          <div className="relative w-full h-full min-h-[140px] flex flex-col items-center justify-center">
                            {getFileType(form.image, form.fileName) === "video" ? (
                              form.image.startsWith("data:video") || form.image.match(/\.(mp4|webm|mov)$/i) ? (
                                <video src={form.image} controls className="max-h-48 rounded-lg object-cover" />
                              ) : (
                                <div className="flex flex-col items-center text-blue-600 p-4 bg-blue-50 rounded-xl w-full">
                                  <PlayCircle className="w-10 h-10 mb-2" />
                                  <span className="text-xs font-bold">{form.fileName || "Video File Attached"}</span>
                                  <span className="text-[10px] text-slate-500 mt-1">Click to replace file</span>
                                </div>
                              )
                            ) : getFileType(form.image, form.fileName) === "document" ? (
                              <div className="flex flex-col items-center text-[#2E7D32] p-4 bg-[#E8F5E9] rounded-xl w-full">
                                <FileText className="w-10 h-10 mb-2" />
                                <span className="text-xs font-bold">{form.fileName || "Document Attached"}</span>
                                <span className="text-[10px] text-slate-500 mt-1">Click to replace file</span>
                              </div>
                            ) : (
                              <div className="relative w-full h-40">
                                <Image src={form.image} alt="Preview" fill unoptimized sizes="(max-width: 767px) 90vw, 600px" className="object-cover rounded-lg" />
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setForm(prev => ({ ...prev, image: "", fileName: "", videoUrl: "" }));
                              }}
                              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 z-20 shadow-md"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-4">
                            {form.type === "Video" ? (
                              <Film className="w-8 h-8 text-blue-500 mb-2" />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                            )}
                            <span className="text-xs font-bold text-slate-700 mb-1">
                              {form.type === "Video" ? "Click to upload Video or Cover" : "Click to upload File"}
                            </span>
                            <span className="text-[11px] text-slate-400 max-w-xs">
                              {form.type === "Video" 
                                ? "MP4, WEBM, MOV, JPG, PNG (Max 50MB)" 
                                : "PDF, DOCX, PPTX, TXT (Max 25MB); images and video (Max 50MB)"}
                            </span>
                          </div>
                        )}
                      </label>
                    )}
                  </div>
                </div>

                {uploadError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{uploadError}</p>}
                <div className="mt-10 flex items-center justify-end gap-3 pt-6 border-t border-slate-100 max-w-2xl">
                  <Link href="/education">
                    <Button variant="outline" className="px-6 h-11 border-slate-200 text-slate-600 font-semibold rounded-xl">
                      Cancel
                    </Button>
                  </Link>
                  <Button disabled={isSubmitting || isUploading || !!pendingDocument} onClick={handlePublish} className="px-6 h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm">
                    <Send className="w-4 h-4 mr-2" /> {isSubmitting ? "Publishing..." : "Publish Resource"}
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
