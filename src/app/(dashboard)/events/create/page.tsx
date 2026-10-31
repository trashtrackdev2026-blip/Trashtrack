"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Image as ImageIcon, Calendar as CalendarIcon, Clock, MapPin, QrCode, CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, doc } from "firebase/firestore";
import { staffRequest } from "@/lib/staff-client";
import { STAFF_BARANGAYS } from "@/lib/staff-access";
import { QRCodeSVG } from "qrcode.react";
import { CertificatePreview } from "@/components/events/CertificatePreview";
import { certificateSettings, eventDate } from "@/lib/certificate-data";

export default function CreateEventPage() {
  const [attendance, setAttendance] = useState<"qr" | "manual">("qr");

  const [form, setForm] = useState({
    title: "",
    category: "Clean-up Drive",
    description: "",
    date: "",
    time: "",
    endTime: "",
    barangay: "Poblacion",
    location: "",
    image: "/images/events/cleanup.jpg",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [publicationId] = useState(() => doc(collection(db, "events")).id);
  const [isUploading, setIsUploading] = useState(false);
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [certificateSignatory, setCertificateSignatory] = useState("");
  const [certificatePosition, setCertificatePosition] = useState("Lead Trainer");
  const [certificateOrganizer, setCertificateOrganizer] = useState("Municipal Environment and Natural Resources Office (MENRO)");
  const [certificatePreview, setCertificatePreview] = useState<Record<string, unknown> | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");

      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.secure_url) {
        setForm(prev => ({ ...prev, image: data.secure_url }));
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublish = async () => {
    if (!form.title || !form.date || !form.time || !form.barangay) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const settings = { certificateEnabled, certificateSignatory, certificatePosition, certificateOrganizer };
      if (certificateEnabled) certificateSettings(settings);
      const certificateDate = eventDate({ dateISO: form.date });
      await staffRequest("/api/community/publish", {
        kind: "event", id: publicationId,
        title: form.title,
        barangay: form.barangay,
        location: form.location,
        date: certificateDate.display,
        dateISO: certificateDate.iso,
        attendanceMethod: attendance,
        ...settings,
        time: `${form.time} - ${form.endTime || 'TBD'}`,
        startTime: form.time, endTime: form.endTime,
        participants: 0,
        status: "Upcoming",
        description: form.description,
        img: form.image,
        category: form.category,
      });
      setIsSuccess(true);
    } catch (e) {
      console.error("Error publishing event:", e);
      alert(e instanceof Error ? e.message : "Failed to publish event");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <>
        <div className="space-y-8 max-w-[1400px] mx-auto">
          <div className="tt-legacy-heading flex flex-col gap-2">
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Event Created!</h1>
          </div>
          <div className="tt-surface p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-[#2E7D32]" />
            </div>
            <h2 className="text-2xl font-bold text-[#2E7D32] mb-3">Event Published Successfully!</h2>
            <p className="text-sm text-slate-600 mb-8 max-w-md">
              The event &quot;{form.title}&quot; has been created and is now visible to residents.
            </p>
            <Link href="/events">
              <Button className="h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-bold rounded-xl px-8 shadow-sm">
                Back to Events
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {certificatePreview && <CertificatePreview data={certificatePreview} onClose={() => setCertificatePreview(null)} />}
      <div className="space-y-8 max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="tt-legacy-heading flex flex-col gap-2">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Create Community Event</h1>
          <p className="text-sm text-slate-500">Create and publish an environmental community event.</p>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left Column - Form */}
          <div className="flex-1 tt-surface p-8">

            <div className="space-y-10">

              {/* Section 1 */}
              <div>
                <h3 className="text-[15px] font-bold text-[#2E7D32] flex items-center gap-2 border-b border-slate-100 pb-3 mb-6">
                  1. Event Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Event Title <span className="text-red-500">*</span></label>
                    <Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="e.g. Coastal Community Clean-Up Drive" className="h-11 bg-white border-slate-200" />
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Event Category <span className="text-red-500">*</span></label>
                    <Select value={form.category} onValueChange={(v) => v && setForm({...form, category: v})}>
                      <SelectTrigger className="w-full bg-white border-slate-200 h-11">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Clean-up Drive">Clean-up Drive</SelectItem>
                        <SelectItem value="Seminar">Seminar</SelectItem>
                        <SelectItem value="Tree Planting">Tree Planting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Description <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <textarea 
                        rows={4}
                        value={form.description}
                        onChange={(e) => setForm({...form, description: e.target.value})}
                        placeholder="Provide a short description of the event, its objectives, and activities."
                        className="w-full bg-white border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2E7D32] resize-none"
                      />
                      <span className="absolute bottom-3 right-3 text-[10px] text-slate-400 font-medium bg-white px-1">
                        0/200
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Event Image or Document</label>
                    <label className="w-full h-[104px] border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center hover:bg-slate-50 cursor-pointer transition-colors relative overflow-hidden">
                      <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleImageUpload} disabled={isUploading} />
                      {isUploading ? (
                        <div className="flex flex-col items-center justify-center z-10 bg-white/80 absolute inset-0">
                           <span className="text-xs font-semibold text-[#2E7D32]">Uploading...</span>
                        </div>
                      ) : null}

                      {form.image && form.image !== "/images/events/cleanup.jpg" ? (
                        form.image.endsWith(".pdf") || form.image.endsWith(".doc") || form.image.endsWith(".docx") ? (
                          <div className="flex flex-col items-center text-[#2E7D32]">
                            <FileText className="w-8 h-8 mb-2" />
                            <span className="text-xs font-semibold">Document Attached</span>
                          </div>
                        ) : (
                          <img src={form.image} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                        )
                      ) : (
                        <>
                          <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-xs font-semibold text-slate-700">Click to upload</span>
                          <span className="text-[10px] text-slate-400">JPG, PNG, PDF</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div>
                <h3 className="text-[15px] font-bold text-[#2E7D32] flex items-center gap-2 border-b border-slate-100 pb-3 mb-6">
                  2. Date, Time & Location
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Event Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Input value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} type="date" className="h-11 bg-white border-slate-200 pl-4 pr-10 text-slate-500" />
                    </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Start Time <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Input value={form.time} onChange={(e) => setForm({...form, time: e.target.value})} type="time" className="h-11 bg-white border-slate-200 pl-4 pr-10 text-slate-500" />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-700">End Time <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Input value={form.endTime} onChange={(e) => setForm({...form, endTime: e.target.value})} type="time" className="h-11 bg-white border-slate-200 pl-4 pr-10 text-slate-500" />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Barangay <span className="text-red-500">*</span></label>
                    <Select value={form.barangay} onValueChange={(v) => v && setForm({...form, barangay: v})}>
                      <SelectTrigger className="w-full bg-white border-slate-200 h-11">
                        <SelectValue placeholder="Select barangay" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All Barangays">All Barangays</SelectItem>
                        {STAFF_BARANGAYS.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Venue / Location <span className="text-red-500">*</span></label>
                    <Input value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} placeholder="e.g. Poblacion Coastal Area" className="h-11 bg-white border-slate-200" />
                  </div>
                </div>
              </div>

              {/* Section 3 */}
              <div>
                <h3 className="text-[15px] font-bold text-[#2E7D32] flex items-center gap-2 border-b border-slate-100 pb-3 mb-6">
                  3. Attendance Method
                </h3>
                <p className="text-xs text-slate-500 mb-4">Choose how you want to record participation in this event.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* QR Code Option */}
                  <div 
                    className={`rounded-xl border-2 p-5 cursor-pointer transition-all ${attendance === 'qr' ? 'border-[#2E7D32] bg-[#F1F8F5]' : 'border-slate-200 bg-white hover:border-green-200'}`}
                    onClick={() => setAttendance('qr')}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${attendance === 'qr' ? 'border-[#2E7D32] bg-[#2E7D32]' : 'border-slate-300'}`}>
                        {attendance === 'qr' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 mb-1">QR Code Attendance</span>
                        <span className="text-xs text-slate-600 mb-4 leading-relaxed">Residents scan the QR code during the event to record attendance.</span>

                        {attendance === 'qr' && (
                          <div className="bg-[#E8F5E9] rounded-lg p-3 flex items-center gap-3 border border-green-100/50">
                            <div className="w-12 h-12 bg-white rounded flex items-center justify-center shrink-0 border border-slate-100">
                              <QrCode className="w-8 h-8 text-slate-800" />
                            </div>
                            <span className="text-[11px] font-semibold text-[#2E7D32] leading-snug">QR Code will be automatically generated after the event is published.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Manual Option */}
                  <div 
                    className={`rounded-xl border-2 p-5 cursor-pointer transition-all ${attendance === 'manual' ? 'border-[#2E7D32] bg-[#F1F8F5]' : 'border-slate-200 bg-white hover:border-green-200'}`}
                    onClick={() => setAttendance('manual')}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${attendance === 'manual' ? 'border-[#2E7D32] bg-[#2E7D32]' : 'border-slate-300'}`}>
                        {attendance === 'manual' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                      </div>
                      <div className="flex min-w-0 flex-col w-full">
                        <span className="text-sm font-bold text-slate-900 mb-1">Manual Attendance</span>
                        <span className="text-xs text-slate-600 mb-4 leading-relaxed">Administrator will record attendance manually during the event.</span>

                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
                          <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                              <tr>
                                <th className="py-1.5 px-3 font-semibold">Participant Name</th>
                                <th className="py-1.5 px-3 font-semibold">Barangay</th>
                                <th className="py-1.5 px-3 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                              <tr>
                                <td className="py-1.5 px-3">Juan Dela Cruz</td>
                                <td className="py-1.5 px-3">Poblacion</td>
                                <td className="py-1.5 px-3 text-green-600 font-semibold">Present</td>
                              </tr>
                              <tr>
                                <td className="py-1.5 px-3">Maria Santos</td>
                                <td className="py-1.5 px-3">Makina</td>
                                <td className="py-1.5 px-3 text-green-600 font-semibold">Present</td>
                              </tr>
                              <tr>
                                <td className="py-1.5 px-3">Ana Ramirez</td>
                                <td className="py-1.5 px-3">Balete Proper</td>
                                <td className="py-1.5 px-3 text-red-500 font-semibold">Absent</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="mt-4 bg-blue-50/50 p-3 rounded-lg flex items-center gap-2 border border-blue-100/50">
                  <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold">i</span>
                  </div>
                  <span className="text-xs text-blue-800">You can only use one attendance method per event.</span>
                </div>
              </div>

              {/* Section 4 */}
              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-6">
                  <h3 className="text-[15px] font-bold text-[#2E7D32]">
                    4. Certificate (Optional)
                  </h3>
                </div>

                <div className="flex min-w-0 flex-col items-stretch gap-6">
                  <div className="flex min-w-0 items-start gap-3">
                    <input id="enable-certificate" type="checkbox" checked={certificateEnabled} onChange={event => setCertificateEnabled(event.target.checked)} className="h-5 w-5 accent-green-800" />
                    <label htmlFor="enable-certificate" className="text-sm font-bold text-slate-800">Enable digital certificate for participants</label>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700">Certificate Signatory</label>
                      <Input value={certificateSignatory} onChange={event => setCertificateSignatory(event.target.value)} disabled={!certificateEnabled} maxLength={100} placeholder="Organizer's full name" className="h-9 bg-white border-slate-200 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700">Signatory Position</label>
                      <Input value={certificatePosition} onChange={event => setCertificatePosition(event.target.value)} disabled={!certificateEnabled} maxLength={100} placeholder="e.g. Lead Trainer" className="h-9 bg-white border-slate-200 text-sm" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-700">Organizing office</label>
                      <Input value={certificateOrganizer} onChange={event => setCertificateOrganizer(event.target.value)} disabled={!certificateEnabled} maxLength={160} />
                    </div>
                    <p className="text-xs text-slate-500 sm:col-span-2">Your gold and green Certificate of Appreciation template fills each attendee&apos;s name, the event title and event date automatically.</p>
                    <Button type="button" variant="outline" disabled={!certificateEnabled} onClick={() => setCertificatePreview({
                      title: form.title, dateISO: form.date, certificateSignatory, certificatePosition, certificateOrganizer,
                    })}>Preview certificate</Button>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="mt-12 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-6">
                <Link href="/events">
                  <Button variant="ghost" className="px-6 h-11 text-slate-600 font-semibold rounded-xl hover:bg-slate-50">
                    Cancel
                  </Button>
                </Link>
                <Button variant="outline" className="px-6 h-11 border-[#2E7D32] text-[#2E7D32] font-semibold rounded-xl hover:bg-green-50">
                  <FileText className="w-4 h-4 mr-2" /> Save as Draft
                </Button>
                <Button disabled={isSubmitting} onClick={handlePublish} className="px-6 h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm">
                  <Send className="w-4 h-4 mr-2" /> {isSubmitting ? "Publishing..." : "Publish Event"}
                </Button>
              </div>

            </div>
          </div>

          {/* Right Column - Preview Box */}
          <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6">

            <div className="tt-surface p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Event Preview</h3>
                <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full uppercase tracking-wider border border-green-100">Preview</span>
              </div>

              <div className="bg-slate-50 rounded-xl aspect-video w-full flex items-center justify-center border border-slate-100 mb-5 relative overflow-hidden">
                {form.image && form.image !== "/images/events/cleanup.jpg" ? (
                  <img src={form.image} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <ImageIcon className="w-12 h-12 text-slate-200" />
                    <div className="absolute inset-0 bg-slate-200/50 flex" />
                    {/* Diagonal lines placeholder */}
                    <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_11px)]"></div>
                  </>
                )}
              </div>

              <h4 className="text-xl font-bold text-slate-900 mb-2">{form.title || "Event Title"}</h4>
              <div className="flex mb-6">
                <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded uppercase tracking-wider">{form.category || "Category"}</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 w-24">Date & Time</span>
                  <span className="text-xs font-bold text-slate-900 ml-auto text-right">{form.date ? new Date(form.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "-"} • {form.time || "-"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 w-24">Location</span>
                  <span className="text-xs font-bold text-slate-900 ml-auto text-right max-w-[120px] truncate">{form.location || "-"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 text-slate-400 flex items-center justify-center font-bold text-[10px]">B</span>
                  <span className="text-xs text-slate-500 w-24">Barangay</span>
                  <span className="text-xs font-bold text-slate-900 ml-auto">{form.barangay || "-"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 flex items-center justify-center text-slate-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-slate-500 w-24">Attendance</span>
                  <span className="text-xs font-bold text-[#2E7D32] ml-auto">{attendance === 'qr' ? 'QR Code' : 'Manual'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 w-24">Certificate</span>
                  <span className="text-xs font-bold text-slate-900 ml-auto">-</span>
                </div>
              </div>
            </div>

            {attendance === 'qr' && (
              <div className="tt-surface p-6 flex flex-col">
                <h3 className="font-bold text-slate-900 mb-2">QR Code Preview <span className="text-slate-400 font-normal">(Example)</span></h3>
                <p className="text-xs text-slate-500 mb-6">This QR code will be used to record attendance when the event is active.</p>

                <div className="flex flex-col items-center justify-center">
                  <div className="bg-white p-2 border border-slate-200 rounded-xl mb-3 shadow-sm">
                    {/* Placeholder for QR code with logo */}
                    <div className="w-40 h-40 bg-slate-50 flex items-center justify-center relative rounded-md border border-slate-100 overflow-hidden p-2">
                      <QRCodeSVG value="EVT-PREVIEW" size={144} level="L" />
                      {/* Logo in center */}
                      <div className="absolute bg-white rounded p-1 shadow-sm">
                         <div className="w-6 h-6 rounded-full bg-white border border-green-100 overflow-hidden relative">
                           <Image src="/images/logo.png" alt="TrashTrack" fill className="object-contain p-[2px]" />
                         </div>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-800">Event ID: EVT-006</span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
