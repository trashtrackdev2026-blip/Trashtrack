"use client";

import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Calendar as CalendarIcon, Clock, MapPin, FileText, Send, ArrowRight, ArrowLeft, Info, CalendarCheck2, LayoutDashboard, PenSquare } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { BALETE_BARANGAYS } from "@/lib/barangay-geofence";
import { collection, doc } from "firebase/firestore";
import { staffRequest } from "@/lib/staff-client";

export default function CreateSchedulePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form state
  const [form, setForm] = useState({
    barangay: "Poblacion",
    day: format(new Date(), "EEEE"),
    time: "08:00",
    date: format(new Date(), "yyyy-MM-dd"),
    notes: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publicationId] = useState(() => doc(collection(db, "schedules")).id);
  const [deliveryError, setDeliveryError] = useState("");

  const handlePublish = async () => {
    if (!form.date || !isValid(parseISO(form.date)) || !form.time || !form.barangay) return;
    setIsSubmitting(true);
    setDeliveryError("");
    try {
      await staffRequest("/api/community/publish", {
        kind: "schedule", id: publicationId,
        barangay: form.barangay,
        day: format(parseISO(form.date), "EEEE"),
        time: form.time,
        date: form.date,
        status: "Active",
        description: form.notes,
      });
      setStep(3);
    } catch (e) {
      console.error("Error publishing schedule:", e);
      setDeliveryError(e instanceof Error ? e.message : "Publishing could not be confirmed. Retry with the same details; the saved schedule will not be duplicated.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-8 max-w-[1400px] mx-auto">
        {deliveryError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{deliveryError}</p>}
        
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">
            {step === 1 ? "Create Collection Schedule" : step === 2 ? "Review Collection Schedule" : "Publish Collection Schedule"}
          </h1>
          <p className="text-sm text-slate-500">
            {step === 1 
              ? "Set up a new waste collection schedule for a specific barangay." 
              : step === 2 ? "Please review the details of the collection schedule before publishing."
              : "The collection schedule has been successfully published."}
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between max-w-3xl mx-auto mb-12 relative px-4">
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 z-0"></div>
          <div className="absolute left-8 top-1/2 -translate-y-1/2 h-0.5 bg-[#2E7D32] z-0 transition-all duration-500" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div>
          
          <div className="flex flex-col items-center gap-2 z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-500 ${
              step >= 1 ? 'bg-[#E8F5E9] border-2 border-[#2E7D32] text-[#2E7D32]' : 'bg-white border-2 border-slate-200 text-slate-400'
            }`}>
              {step > 1 ? <Check className="w-5 h-5" /> : <Check className="w-4 h-4" />}
            </div>
            <span className={`text-xs font-semibold ${step >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>Schedule Details</span>
          </div>

          <div className="flex flex-col items-center gap-2 z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-500 ${
              step > 2 ? 'bg-[#E8F5E9] border-2 border-[#2E7D32] text-[#2E7D32]' : step === 2 ? 'bg-[#E8F5E9] border-2 border-[#2E7D32] text-[#2E7D32]' : 'bg-white border-2 border-slate-200 text-slate-400'
            }`}>
              {step > 2 ? <Check className="w-5 h-5" /> : <Check className="w-4 h-4" />}
            </div>
            <span className={`text-xs font-semibold transition-colors duration-500 ${step >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>Review</span>
          </div>

          <div className="flex flex-col items-center gap-2 z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-500 ${
              step >= 3 ? 'bg-[#2E7D32] text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-400'
            }`}>
              3
            </div>
            <span className={`text-xs font-semibold transition-colors duration-500 ${step >= 3 ? 'text-slate-900' : 'text-slate-400'}`}>Publish</span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column - Form / Review / Success Details */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            {step === 3 ? (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-6 relative">
                  <Check className="w-10 h-10 text-[#2E7D32]" />
                  {/* Confetti dots placeholder */}
                  <div className="absolute top-0 left-0 w-2 h-2 bg-green-400 rounded-full -translate-x-4 -translate-y-2"></div>
                  <div className="absolute top-4 right-0 w-1.5 h-1.5 bg-blue-400 rounded-full translate-x-6"></div>
                  <div className="absolute bottom-2 left-2 w-1.5 h-1.5 bg-yellow-400 rounded-full -translate-x-6"></div>
                </div>
                
                <h2 className="text-2xl font-bold text-[#2E7D32] mb-3">Schedule Published Successfully!</h2>
                <p className="text-sm text-slate-600 mb-10 max-w-md">
                  The waste collection schedule has been published and is now visible to residents. It will also appear on the collection calendar.
                </p>

                <div className="w-full max-w-2xl text-left border border-slate-100 rounded-xl overflow-hidden mb-10">
                  <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Barangay</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{form.barangay}</span>
                  </div>
                  <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Collection Day</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{form.day}</span>
                  </div>
                  <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                        <Clock className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Collection Time</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{form.time}</span>
                  </div>
                  <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Collection Date</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{form.date}</span>
                  </div>
                  <div className="flex items-start justify-between p-4 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Notes</span>
                    </div>
                    <span className="text-sm font-medium text-slate-600 max-w-[200px] text-right leading-snug">{form.notes}</span>
                  </div>
                </div>

                <div className="flex gap-4 w-full max-w-2xl mx-auto mb-4">
                  <Button variant="outline" className="flex-1 h-12 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50">
                    <CalendarIcon className="w-4 h-4 mr-2" /> View Schedule
                  </Button>
                  <Link href="/schedules" className="flex-1">
                    <Button className="w-full h-12 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-bold rounded-xl shadow-sm">
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Back to Collection Schedules
                    </Button>
                  </Link>
                </div>
                
                <div className="w-full max-w-2xl bg-blue-50/50 p-4 rounded-xl flex items-start gap-3 border border-blue-100/50 text-left mt-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">Reminder</span>
                    <span className="text-[11px] text-slate-600 mt-0.5">Changes to a published schedule will require republishing to notify residents of the updates.</span>
                  </div>
                </div>

              </div>
            ) : (
              <>
                <h2 className="font-bold text-lg text-slate-900 mb-1">
                  {step === 1 ? "Schedule Details" : "Review Schedule Details"}
                </h2>
                <p className="text-sm text-slate-500 mb-8">
                  {step === 1 ? "Provide the required information for the collection schedule." : "Please verify all information before publishing the schedule."}
                </p>

                {step === 1 ? (
                  <div className="space-y-5 max-w-xl">
                    <div className="space-y-1.5">
                      <label id="schedule-barangay-label" className="text-xs font-bold text-slate-700 uppercase tracking-wide">Barangay <span className="text-red-500">*</span></label>
                      <Select value={form.barangay} onValueChange={(val) => setForm({...form, barangay: val || ""})}>
                        <SelectTrigger aria-labelledby="schedule-barangay-label" className="w-full bg-white border-slate-200 h-11">
                          <SelectValue>{form.barangay || "Select barangay"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false} className="max-h-72">
                          {BALETE_BARANGAYS.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Day of Collection <span className="text-red-500">*</span></label>
                      <Input value={form.day} readOnly className="w-full bg-slate-50 border-slate-200 h-11" />
                      <p className="text-[10px] text-slate-400 mt-1">The weekday follows the collection date. This schedule runs once on that date.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Start Time <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Input value={form.time} onChange={(e) => setForm({...form, time: e.target.value})} type="time" className="w-full bg-white border-slate-200 h-11 pl-4 pr-10" />
                        <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Select the time when collection is scheduled to start.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Collection Date <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Input value={form.date} onChange={(e) => { const date = e.target.value; setForm({...form, date, day: date && isValid(parseISO(date)) ? format(parseISO(date), "EEEE") : ""}); }} type="date" className="w-full bg-white border-slate-200 h-11 pl-4 pr-10 text-slate-700" />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Collection appears only on the selected date.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Notes (Optional)</label>
                      <textarea 
                        rows={4}
                        value={form.notes}
                        onChange={(e) => setForm({...form, notes: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2E7D32] resize-none"
                        placeholder="Enter any additional notes or instructions..."
                      />
                      <p className="text-[10px] text-slate-400 mt-1">These notes are shown to residents with the collection schedule.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0 border border-slate-100 rounded-xl overflow-hidden max-w-2xl">
                    <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Barangay</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{form.barangay}</span>
                    </div>
                    
                    <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Collection Day</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{form.day}</span>
                    </div>

                    <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                          <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Start Time</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{form.time}</span>
                    </div>

                    <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Collection Date</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{form.date}</span>
                    </div>

                    <div className="flex items-start justify-between p-4 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Notes</span>
                      </div>
                      <span className="text-sm font-medium text-slate-600 max-w-xs text-right leading-snug">{form.notes}</span>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="mt-6 bg-[#F1F8F5] p-4 rounded-xl flex items-start gap-3 border border-green-100 max-w-2xl">
                    <Info className="w-5 h-5 text-[#2E7D32] shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">Please confirm</span>
                      <span className="text-xs text-slate-600 mt-0.5">Once published, this schedule will be visible to residents and included in the collection calendar.</span>
                    </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="mt-10 flex items-center justify-between pt-6 border-t border-slate-100 max-w-2xl">
                  {step === 1 ? (
                    <>
                      <Link href="/schedules">
                        <Button variant="outline" className="px-6 h-11 border-slate-200 text-slate-600 font-semibold rounded-xl">
                          Cancel
                        </Button>
                      </Link>
                      <Button disabled={!form.date || !form.time || !form.barangay} onClick={() => setStep(2)} className="px-6 h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm">
                        Next <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => setStep(1)} variant="outline" className="px-6 h-11 border-slate-200 text-slate-600 font-semibold rounded-xl">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <div className="flex gap-3">
                        <Link href="/schedules">
                          <Button variant="ghost" className="px-6 h-11 text-slate-600 font-semibold rounded-xl hover:bg-slate-100">
                            Cancel
                          </Button>
                        </Link>
                        <Button disabled={isSubmitting} onClick={handlePublish} className="px-6 h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm">
                          <Send className="w-4 h-4 mr-2" /> {isSubmitting ? "Publishing..." : "Publish Schedule"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Column - Preview Box or Summary */}
          <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6">
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
              <h3 className="font-bold text-slate-900 mb-6">{step === 3 ? "Schedule Summary" : "Schedule Preview"}</h3>
              
              {step === 1 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-slate-100 rounded-xl">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
                    <CalendarIcon className="w-8 h-8 text-[#2E7D32]" />
                  </div>
                  <span className="font-bold text-slate-800 mb-2">No schedule set</span>
                  <span className="text-xs text-slate-500">Complete the form to see a preview of the schedule.</span>
                </div>
              ) : (
                <div className="flex flex-col mb-4">
                  {step !== 3 && <p className="text-xs text-slate-500 mb-4">This is how the schedule will appear to residents.</p>}
                  
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-[#E8F5E9] py-3 text-center border-b border-slate-200">
                      <span className="text-xs font-bold text-[#1B5E20] uppercase tracking-wider">Waste Collection Schedule</span>
                    </div>
                    <div className="p-5 bg-white flex flex-col items-center">
                      <h4 className="text-lg font-bold text-[#2E7D32] mb-6">{form.barangay}</h4>
                      
                      <div className="w-full space-y-4">
                        <div className="flex items-center gap-3">
                          <CalendarIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-slate-500 w-24">Collection Day</span>
                          <span className="text-xs font-bold text-[#2E7D32] ml-auto text-right">{form.day}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-slate-500 w-24">Collection Time</span>
                          <span className="text-xs font-bold text-[#2E7D32] ml-auto text-right">{form.time}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CalendarIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-slate-500 w-24">Collection Date</span>
                          <span className="text-xs font-bold text-[#2E7D32] ml-auto text-right">{form.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {step === 3 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">What&apos;s Next?</h3>
                
                <div className="space-y-6 mt-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shrink-0">
                      <Send className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col mt-1">
                      <span className="text-sm font-bold text-slate-900">Residents Notified</span>
                      <span className="text-[11px] text-slate-500 mt-1 leading-snug">Residents will receive this schedule in their app notifications and calendar.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shrink-0">
                      <CalendarCheck2 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col mt-1">
                      <span className="text-sm font-bold text-slate-900">View on Calendar</span>
                      <span className="text-[11px] text-slate-500 mt-1 leading-snug">The schedule is now added to the collection calendar for residents to view.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shrink-0">
                      <PenSquare className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col mt-1">
                      <span className="text-sm font-bold text-slate-900">Manage Schedule</span>
                      <span className="text-[11px] text-slate-500 mt-1 leading-snug">You can update or delete this schedule anytime from the Collection Schedules list.</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">Summary</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500">Barangay</span>
                    <span className="text-xs font-bold text-slate-900 text-right">{step === 1 ? "-" : form.barangay}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500">Day of Collection</span>
                    <span className="text-xs font-bold text-slate-900 text-right">{step === 1 ? "-" : form.day}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500">Start Time</span>
                    <span className="text-xs font-bold text-slate-900 text-right">{step === 1 ? "-" : form.time}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500">Collection Date</span>
                    <span className="text-xs font-bold text-slate-900 text-right">{step === 1 ? "-" : form.date}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500 w-16 shrink-0">Notes</span>
                    <span className="text-[11px] font-medium text-slate-600 text-right">{step === 1 ? "-" : form.notes}</span>
                  </div>
                </div>

                {step === 1 && (
                  <div className="mt-6 bg-[#F1F8F5] p-3 rounded-xl flex items-start gap-2 border border-green-100">
                    <Info className="w-4 h-4 text-[#2E7D32] shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">Note</span>
                      <span className="text-[10px] text-slate-600 mt-0.5">Once published, this schedule will be visible to residents and included in the collection calendar.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
