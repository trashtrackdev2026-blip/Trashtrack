import { StaffAccessError } from "./staff-access.ts";
import { announcementExpired, notificationPublication } from "./notification-publication.ts";

export function notificationEdit(body: Record<string,unknown>, current: Record<string,unknown>, now = Date.now()) {
  if (announcementExpired(current.endDate, now)) throw new StaffAccessError("This announcement has expired and can only be viewed.", 409);
  if (current.pushStatus === "sending") throw new StaffAccessError("Phone delivery is in progress. Wait before editing this notification.",409);
  const reportNotice = current.type === "report" && body.type === "report";
  const value = notificationPublication({...current,...body,...(reportNotice?{type:"general"}:{})});
  // Category changes never change the audience. The manage route creates a
  // revision-linked update notice so an already-read notice is not overlooked.
  if (value.recipients !== current.recipients || value.push !== (current.push === true)) throw new StaffAccessError("The original audience and phone delivery setting cannot be changed after publication.",400);
  if (announcementExpired(value.endDate, now)) throw new StaffAccessError("Choose today or a future announcement end date (Philippine time).", 400);
  return {title:value.title,message:value.message,type:reportNotice?"report":value.type,endDate:value.endDate || ""};
}

export function notificationDeliveryLabel(push: boolean, status: string) {
  if (!push) return "In-app only";
  return status === "queued" ? "Sent to phone service" : status === "failed" ? "Phone delivery failed" : status === "sending" ? "Sending to phone service" : "Waiting for phone delivery";
}
