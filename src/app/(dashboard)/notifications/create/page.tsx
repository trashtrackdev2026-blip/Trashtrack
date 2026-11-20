"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Bell, Send, BellRing, Check, Smartphone, Users, CalendarIcon, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/layout/Brand";
import { useRouter } from "next/navigation";
import { collection, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { BALETE_BARANGAYS } from "@/lib/barangay-geofence";
import { staffRequest } from "@/lib/staff-client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { manilaDateTime } from "@/lib/scheduling-time";
import styles from "./notification-dialog.module.css";

export default function CreateNotificationPage() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notificationSaved, setNotificationSaved] = useState(false);
  const [receipt, setReceipt] = useState<"queued" | "in-app" | null>(null);
  const [notificationId] = useState(() => doc(collection(db, "notifications")).id);
  const [deliveryError, setDeliveryError] = useState("");

  const [form, setForm] = useState({
    title: "Collection Schedule Update",
    category: "Collection Schedule",
    recipients: "All Barangays",
    message: "Waste collection in Barangay Poblacion will take place on Monday at 8:00 AM. Please place garbage outside before collection time.",
    push: true,
    endDate: "",
  });
  const dialogTitle = receipt === "queued" ? "Saved and queued" : receipt || notificationSaved ? "Notification saved" : "Review notification";
  const dialogDescription = receipt === "queued"
    ? "The announcement is in the app. Phone delivery has been queued."
    : receipt === "in-app"
      ? "Residents can find this announcement in their TrashTrack notification history."
      : notificationSaved
        ? "The announcement is in the app. You can retry phone delivery."
        : "Check the message, audience, and delivery before sending.";
  const deliveryStatus = receipt === "queued" ? "Phone delivery queued"
    : notificationSaved && !receipt ? "Phone delivery pending"
    : form.push ? "In-app and phone notification" : "In-app notification";
  const locked = isSending || notificationSaved;

  const handleSendNotification = async () => {
    const user = auth.currentUser;
    if (isSending || receipt || !form.title.trim() || !form.message.trim()) return;
    if (!user) {
      setDeliveryError("Sign in again before sending this notification.");
      return;
    }
    setIsSending(true);
    setDeliveryError("");
    try {
      const result = await staffRequest<{ saved: boolean; queued: boolean; deliveryError?: string }>("/api/notifications/create", {
        id: notificationId, title: form.title, message: form.message, recipients: form.recipients,
        type: form.category === "Collection Schedule" ? "schedule" : form.category === "System Alert" ? "alert" : "event", push: form.push, endDate: form.endDate,
      });
      if (!result.saved) throw new Error("The save could not be confirmed. Try again to check its status.");
      setNotificationSaved(true);
      if (form.push && !result.queued) {
        setDeliveryError(result.deliveryError || "Phone delivery could not be queued. Try again.");
        return;
      }
      setReceipt(result.queued ? "queued" : "in-app");
    } catch (error) {
      const message = error instanceof Error && error.name !== "TimeoutError" ? error.message : "Delivery could not be confirmed. Retry to check its status.";
      setDeliveryError(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="space-y-8 relative">

        {/* Header */}
        <div className="tt-legacy-heading flex flex-col gap-2">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Create Notification</h1>
          <p className="text-sm text-slate-500">Compose and send a notification to residents.</p>
        </div>

        <nav className="tt-tabs" aria-label="Announcements"><Link href="/notifications">Notification history</Link><Link href="/notifications/create" aria-current="page">Create notification</Link></nav>
        {/* Main Content Area */}
        <div className="tt-notification-compose">

          {/* Left Column - Form */}
          <div className="tt-compose-form">
            <h2 className="font-bold text-lg text-slate-900 mb-1">Notification Information</h2>
            <p className="text-sm text-slate-500 mb-8">Provide the details of the notification you want to send.</p>

            <div className="space-y-6 max-w-2xl">

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Title <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Input 
                    disabled={locked}
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
                  <Select disabled={locked}
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
                  <Select value={form.recipients} disabled={locked}
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
                    disabled={locked}
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

              <label className="block max-w-xs text-sm font-semibold">
                End date (optional)
                <Input type="date" className="mt-2" min={manilaDateTime().date} value={form.endDate}
                  disabled={locked}
                  onChange={event => setForm({ ...form, endDate: event.target.value })} />
                <span className="mt-2 block text-xs font-normal text-muted-foreground">Editing closes after this date in Philippine time.</span>
              </label>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Delivery Options <span className="text-red-500">*</span></label>
                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl bg-white w-max">
                  <input type="checkbox" aria-label="Send phone notification" checked={form.push}
                    disabled={locked}
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
                  {receipt ? "View receipt" : notificationSaved ? "Retry phone delivery" : "Review & send"} <Send className="w-4 h-4 ml-2" />
                </Button>
              </div>
              {!showConfirm && deliveryError && <div role="alert" className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">{deliveryError}</div>}

            </div>
          </div>

          {/* Right Column - Preview Box */}
          <aside className="tt-notification-preview tt-dark-panel"><h2>Resident preview</h2><p className="mb-5 text-xs text-muted-foreground">This is how the notification will appear to residents.</p><div className="tt-resident-notice"><Brand /><h3>{form.title || "Notification title"}</h3><p>{form.message || "Your message will appear here."}</p><span className="tt-status mt-5">{form.recipients}</span></div><div className="mt-6 space-y-5 border-t pt-5 text-sm"><h3>Delivery information</h3><div><p className="text-xs text-muted-foreground">Audience</p><p className="mt-1">{form.recipients}</p></div><div><p className="text-xs text-muted-foreground">Delivery</p><p className="mt-1">{form.push ? "In-app + phone notification" : "In-app notification history"}</p></div></div></aside>
        </div>
      </div>

      <Dialog open={showConfirm} onOpenChange={open => { if (!isSending) setShowConfirm(open); }}>
        <DialogContent showCloseButton={false} className={`gap-0 rounded-2xl p-0 sm:max-w-lg ${styles.dialog}`}>
          <header className={styles.banner}>
            <div className={styles.mark} aria-hidden="true">{notificationSaved ? <Check /> : <BellRing />}</div>
            <DialogTitle className={styles.title}>{dialogTitle}</DialogTitle>
            <DialogDescription className={styles.description}>{dialogDescription}</DialogDescription>
            <span className="sr-only" role="status">{isSending ? "Sending notification" : notificationSaved ? dialogDescription : ""}</span>
          </header>
          <div className={styles.body}>
            <div className={styles.preview}>
              <p className={styles.category}>{form.category}</p>
              <h3>{form.title.trim()}</h3>
              <p className={styles.message}>{form.message.trim()}</p>
            </div>
            <dl className={styles.details}>
              <div><dt><Users aria-hidden="true" /> Audience</dt><dd>{form.recipients}</dd></div>
              <div><dt><Smartphone aria-hidden="true" /> Delivery</dt><dd>{deliveryStatus}</dd></div>
            </dl>
            {deliveryError && <p className={styles.notice} role="alert"><AlertTriangle aria-hidden="true" />{deliveryError}</p>}
            {!notificationSaved && !deliveryError && <p className={styles.notice}><AlertTriangle aria-hidden="true" />Residents may see this announcement as soon as it is saved.</p>}
            <div className={styles.actions}>
              {!receipt && <Button variant="outline" disabled={isSending} onClick={() => notificationSaved ? router.push("/notifications") : setShowConfirm(false)}>
                {notificationSaved ? "Notification history" : "Back to editing"}
              </Button>}
              <Button disabled={isSending} onClick={receipt ? () => router.push("/notifications") : handleSendNotification}>
                {receipt ? "View notification history" : isSending ? (notificationSaved ? "Retrying…" : "Sending…") : notificationSaved ? "Retry phone delivery" : "Send notification"}
                {!receipt && !isSending && <Send aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
