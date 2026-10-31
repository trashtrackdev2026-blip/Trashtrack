import { StaffAccessError } from "./staff-access.ts";
import { notificationPublication } from "./notification-publication.ts";

export function notificationEdit(body: Record<string,unknown>, current: Record<string,unknown>) {
  if (current.pushStatus === "sending") throw new StaffAccessError("Phone delivery is in progress. Wait before editing this notification.",409);
  const reportNotice = current.type === "report" && body.type === "report";
  const value = notificationPublication({...current,...body,...(reportNotice?{type:"general"}:{})});
  // Editing the in-app copy does not resend a phone notification or change its
  // original audience. This keeps already delivered messages and retry topics consistent.
  if (value.recipients !== current.recipients || value.push !== (current.push === true)) throw new StaffAccessError("The original audience and phone delivery setting cannot be changed after publication.",400);
  return {title:value.title,message:value.message,type:reportNotice?"report":value.type};
}

export function notificationDeliveryLabel(push: boolean, status: string) {
  if (!push) return "In-app only";
  return status === "queued" ? "Sent to phone service" : status === "failed" ? "Phone delivery failed" : status === "sending" ? "Sending to phone service" : "Waiting for phone delivery";
}
