"use client";

import { useState } from "react";
import { learningResourceType, publicLearningUrl } from "@/lib/learning-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Send, 
  Image as ImageIcon, 
  ArrowLeft, 
  LayoutDashboard, 
  FileText, 
  Video as VideoIcon, 
  Upload, 
  X, 
  Film, 
  File,
  PlayCircle
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function CreateEducationResourcePage() {
  const [form, setForm] = useState({
    title: "",
    category: "Waste Segregation",
    type: "Guide",
    image: "",
    videoUrl: "",
    fileName: "",
    description: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");

  const getFileType = (url: string, fileName = "") => learningResourceType(url, fileName, form.type);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
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
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${document ? "raw" : "auto"}/upload`, {
        method: "POST", body: formData, signal: AbortSignal.timeout(120_000),
      });
      const data = await res.json();
      if (!res.ok || !data.secure_url) throw new Error(data.error?.message || "Upload failed. Check Cloudinary upload settings and retry.");
      const url = publicLearningUrl(data.secure_url);
      if (document) {
        const delivery = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
        if (!delivery.ok) throw new Error("The file uploaded but cannot be downloaded. In Cloudinary Security settings, enable PDF delivery and verify the upload preset allows documents. Then upload again, or use a public PDF link.");
      }
      setForm(prev => ({ ...prev, image: url, videoUrl: "", fileName: file.name }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally { setIsUploading(false); e.target.value = ""; }
  };

  const handlePublish = async () => {
    if (!form.title) {
      alert("Title is required");
      return;
    }

    if (isUploading) return;
    setUploadError("");
    setIsSubmitting(true);
    try {
      const source = publicLearningUrl(form.image || form.videoUrl);
      const detectedFileType = getFileType(source, form.fileName);
      const finalImage = detectedFileType === "image" ? source : "";

      await addDoc(collection(db, "educational_resources"), {
        title: form.title,
        category: form.category,
        type: form.type,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: "Published",
        image: finalImage,
        videoUrl: detectedFileType === "video" ? source : "",
        fileUrl: source,
        fileType: detectedFileType,
        fileName: form.fileName || "",
        description: form.description,
        createdAt: serverTimestamp()
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
                          <SelectItem value="Waste Segregation">Waste Segregation</SelectItem>
                          <SelectItem value="Composting">Composting</SelectItem>
                          <SelectItem value="Recycling">Recycling</SelectItem>
                          <SelectItem value="Environmental Awareness">Environmental Awareness</SelectItem>
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
                          <SelectItem value="Guide">Guide</SelectItem>
                          <SelectItem value="Video">Video</SelectItem>
                          <SelectItem value="Article">Article</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Description / Content</label>
                    <textarea 
                      rows={5}
                      value={form.description}
                      onChange={(e) => setForm({...form, description: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2E7D32] resize-none"
                      placeholder="Provide a brief summary or the content of the educational resource..."
                    />
                  </div>

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
                          onChange={(e) => setForm({ ...form, videoUrl: e.target.value, image: e.target.value, fileName: "" })}
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
                                <img src={form.image} alt="Preview" className="w-full h-full object-cover rounded-lg" />
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
                  <Button disabled={isSubmitting || isUploading} onClick={handlePublish} className="px-6 h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm">
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
