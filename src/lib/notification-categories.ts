export const NOTIFICATION_CATEGORIES = ["schedule", "alert", "report", "event", "general"] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number] | "unknown";

export function notificationCategory(value: unknown): NotificationCategory {
  const key = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["schedule", "schedules", "collection", "collectionschedule", "collectionoutcome"].includes(key)) return "schedule";
  if (["alert", "alerts"].includes(key)) return "alert";
  if (["report", "reports", "reportupdate", "reportstatus", "statusupdate"].includes(key)) return "report";
  if (["event", "events", "communityevent"].includes(key)) return "event";
  if (["general", "message", "messages", "announcement", "announcements", ""].includes(key)) return "general";
  return "unknown";
}

export function notificationCategoryLabel(value: unknown) {
  const category = notificationCategory(value);
  return category === "unknown" ? "Other" : category.charAt(0).toUpperCase() + category.slice(1);
}

export const DELIVERY_FILTER_LABELS: Record<string, string> = {
  status: "All delivery states", "in-app": "In-app only", pending: "Waiting for phone service", sending: "Sending to phone service", sent: "Sent to phone service", failed: "Phone delivery failed",
};

export function matchesDeliveryFilter(notice: {push:boolean;pushStatus:string}, filter: string) {
  if (filter === "status") return true;
  if (filter === "in-app") return !notice.push;
  return notice.push && notice.pushStatus === ({pending:"pending",sending:"sending",sent:"queued",failed:"failed"} as Record<string,string>)[filter];
}
