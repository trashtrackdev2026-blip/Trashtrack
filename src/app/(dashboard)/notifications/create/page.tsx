"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Bell, Send, HelpCircle, Users, CalendarIcon, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { BALETE_BARANGAYS } from "@/lib/barangay-geofence";

export default function CreateNotificationPage() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [savedNotificationId, setSavedNotificationId] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState("");
  
  const [form, setForm] = useState({
    title: "Collection Schedule Update",
    category: "Collection Schedule",
    recipients: "All Barangays",
    message: "Waste collection in Barangay Poblacion will take place on Monday at 8:00 AM. Please place garbage outside before collection time.",
    push: true
  });

  const handleSendNotification = async () => {
    const user = auth.currentUser;
    if (!user || !form.title.trim() || !form.message.trim()) return;
    setIsSending(true);
    setDeliveryError("");
    let notificationId = savedNotificationId;
    try {
      if (!notificationId) {
        const record = await addDoc(collection(db, "notifications"), {
          title: form.title.trim(), message: form.message.trim(),
          type: form.category === "Collection Schedule" ? "schedule" : form.category === "System Alert" ? "alert" : "event",
          recipients: form.recipients, push: form.push, pushStatus: form.push ? "pending" : "disabled",
          isRead: false, createdBy: user.uid,
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          timestamp: serverTimestamp(), createdAt: serverTimestamp(),
        });
        notificationId = record.id;
        setSavedNotificationId(notificationId);
      }
      if (form.push) {
        const token = await user.getIdToken();
        const response = await fetch("/api/notifications/send", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ notificationId }), signal: AbortSignal.timeout(20_000),
        });
        const result = await response.json();
        if (!response.ok || result.queued !== true) throw new Error(result.error || "Phone delivery could not be queued.");
      }
      alert(form.push ? "Notification saved and queued for phones." : "Notification saved in the app's notification history.");
      router.push("/notifications");
    } catch (error) {
      const message = error instanceof Error && error.name !== "TimeoutError" ? error.message : "Delivery could not be confirmed. Retry to check its status.";
      setDeliveryError(`${notificationId ? "Notification saved. " : "Notification could not be saved. "}${message}`);
    } finally {
      setIsSending(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <div className="space-y-8 max-w-[1400px] mx-auto relative">
        
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Create Notification</h1>
          <p className="text-sm text-slate-500">Compose and send a notification to residents.</p>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column - Form */}
          <div className="flex-1">
            <h2 className="font-bold text-lg text-slate-900 mb-1">Notification Information</h2>
            <p className="text-sm text-slate-500 mb-8">Provide the details of the notification you want to send.</p>

            <div className="space-y-6 max-w-2xl">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Title <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Input 
                    disabled={isSending || savedNotificationId !== null}
                    maxLength={100}
                    value={form.title} 
                    onChange={(e) => setForm({...form, title: e.target.value})}
                    className="w-full bg-white border-slate-200 h-11 text-slate-800" 
                  />
                  <span className="absolute -bottom-5 right-0 text-[10px] text-slate-400 font-medium">
                    {form.title.length}/100
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Category <span className="text-red-500">*</span></label>
                  <Select disabled={isSending || savedNotificationId !== null}
                    value={form.category === "Collection Schedule" ? "schedule" : form.category === "System Alert" ? "alert" : "event"}
                    onValueChange={(val) => {
                      const mapping: Record<string, string> = {
                        "schedule": "Collection Schedule",
                        "alert": "System Alert",
                        "event": "Community Event"
                      };
                      if (val && mapping[val]) setForm({...form, category: mapping[val]});
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-200 h-11">
                      <div className="flex items-center gap-2">
                        {form.category === "Collection Schedule" ? <CalendarIcon className="w-4 h-4 text-[#2E7D32]" /> :
                         form.category === "System Alert" ? <AlertTriangle className="w-4 h-4 text-orange-500" /> :
                         <Bell className="w-4 h-4 text-blue-500" />}
                        <span className="text-slate-800">{form.category}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="schedule">Collection Schedule</SelectItem>
                      <SelectItem value="alert">System Alert</SelectItem>
                      <SelectItem value="event">Community Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Recipients <span className="text-red-500">*</span></label>
                  <Select value={form.recipients} disabled={isSending || savedNotificationId !== null}
                    onValueChange={value => { if (value) setForm({ ...form, recipients: value }); }}>
                    <SelectTrigger className="w-full bg-white border-slate-200 h-11">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-600" />
                        <span className="text-slate-800">{form.recipients}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} className="max-h-72">
                      <SelectItem value="All Barangays">All Barangays</SelectItem>
                      {BALETE_BARANGAYS.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-slate-400 mt-1">{form.recipients === "All Barangays" ? "Send to residents in all barangays." : `Send to residents of ${form.recipients}.`}</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Message <span className="text-red-500">*</span></label>
                <div className="relative">
                  <textarea 
                    disabled={isSending || savedNotificationId !== null}
                    maxLength={500}
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({...form, message: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] resize-none"
                  />
                  <span className="absolute bottom-3 right-3 text-[10px] text-slate-400 font-medium bg-white px-1">
                    {form.message.length}/500
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Delivery Options <span className="text-red-500">*</span></label>
                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl bg-white w-max">
                  <input type="checkbox" aria-label="Send phone notification" checked={form.push}
                    disabled={isSending || savedNotificationId !== null}
                    onChange={event => setForm({ ...form, push: event.target.checked })}
                    className="w-5 h-5 shrink-0 mt-0.5 accent-[#2E7D32]" />
                  <div className="flex flex-col gap-0.5 pr-8">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-800" />
                      <span className="text-sm font-bold text-slate-800">Push Notification</span>
                    </div>
                    <span className="text-[10px] text-slate-500 ml-6">Show in the phone notification tray, including while TrashTrack is in the background.</span>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="mt-12 flex items-center gap-4 pt-8">
                <Link href="/notifications">
                  <Button variant="outline" className="px-8 h-11 border-slate-200 text-slate-600 font-semibold rounded-xl">
                    Cancel
                  </Button>
                </Link>
                <Button disabled={isSending || !form.title.trim() || !form.message.trim()} onClick={() => setShowConfirm(true)} className="px-8 h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm">
                  {savedNotificationId ? "Retry Phone Delivery" : "Send Notification"} <Send className="w-4 h-4 ml-2" />
                </Button>
              </div>
              {deliveryError && <div role="alert" className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">{deliveryError}</div>}

            </div>
          </div>

          {/* Right Column - Preview Box */}
          <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-6">
            
            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 flex flex-col">
              <h3 className="font-bold text-slate-900 mb-2">Notification Preview</h3>
              <p className="text-xs text-slate-500 mb-6">This is how residents will see your notification.</p>
              
              <div className="bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 overflow-hidden relative">
                <div className="bg-[#E8F5E9]/50 px-4 py-3 border-b border-green-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full overflow-hidden relative bg-white border border-green-100 flex items-center justify-center p-0.5">
                       <Image src="/images/logo.png" alt="TrashTrack" fill className="object-contain p-0.5" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700">TrashTrack</span>
                  </div>
                  <span className="text-[10px] text-slate-400">now</span>
                </div>
                
                <div className="p-5 relative overflow-hidden">
                  <h4 className="text-[15px] font-bold text-slate-800 mb-2 leading-tight pr-8">{form.title}</h4>
                  <p className="text-[13px] text-slate-600 leading-snug pr-8">{form.message}</p>
                  
                  <div className="absolute right-[-10px] bottom-4 opacity-10 pointer-events-none">
                    <CalendarIcon className="w-24 h-24 text-[#2E7D32]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">Notification Summary</h3>
              
              <div className="space-y-5 mt-5">
                <div className="flex items-center">
                  <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">Category</span>
                  <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full uppercase tracking-wider">{form.category}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">Recipients</span>
                  <span className="text-xs font-bold text-slate-800">{form.recipients}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">Delivery via</span>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <Bell className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">Push Notification</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#F1F8F5] p-5 rounded-2xl flex items-start gap-3 border border-green-100">
              <div className="w-6 h-6 rounded-full bg-[#2E7D32] flex items-center justify-center text-white shrink-0 mt-0.5">
                <span className="font-serif font-bold text-xs italic">i</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800 mb-0.5">Important Reminder</span>
                <span className="text-xs text-slate-600 leading-relaxed">Please review your notification carefully before sending it to residents.</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Confirm Modal Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="p-8 flex flex-col items-center text-center">
              <button 
                onClick={() => setShowConfirm(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
              >
                <span className="text-xl leading-none">&times;</span>
              </button>

              <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-6">
                <HelpCircle className="w-8 h-8" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 mb-2">Confirm Notification</h2>
              <p className="text-sm text-slate-500 mb-8 max-w-xs">
                Are you sure you want to send this notification to residents in the selected barangay?
              </p>

              <div className="w-full text-left space-y-3 mb-8">
                <div className="flex">
                  <span className="text-xs font-semibold text-slate-500 w-28 shrink-0">Title:</span>
                  <span className="text-xs font-bold text-slate-800">{form.title}</span>
                </div>
                <div className="flex">
                  <span className="text-xs font-semibold text-slate-500 w-28 shrink-0">Category:</span>
                  <span className="text-xs font-bold text-slate-800">{form.category}</span>
                </div>
                <div className="flex">
                  <span className="text-xs font-semibold text-slate-500 w-28 shrink-0">Target Barangay:</span>
                  <span className="text-xs font-bold text-slate-800">{form.recipients}</span>
                </div>
              </div>

              <div className="w-full bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2 mb-8">
                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <span className="text-[11px] font-semibold text-orange-700">This action cannot be undone.</span>
              </div>

              <div className="flex w-full gap-3">
                <Button 
                  onClick={() => setShowConfirm(false)}
                  variant="outline" 
                  className="flex-1 h-11 border-slate-200 text-slate-600 font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendNotification} 
                  disabled={isSending}
                  className="w-full h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm flex-1"
                >
                  {isSending ? "Sending..." : "Send Notification"} {!isSending && <Send className="w-4 h-4 ml-2" />}
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
