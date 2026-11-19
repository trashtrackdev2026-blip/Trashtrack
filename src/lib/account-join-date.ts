const joinDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatAccountJoinDate(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    value = value.toDate();
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (/^\d{10,13}$/.test(text)) value = Number(text);
    else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)) value = text.replace(" ", "T") + "+08:00";
    else if (/\b\d{4}\b/.test(text) && text.length > 4) value = text;
    else return null;
  }

  const time = value instanceof Date ? value.getTime()
    : typeof value === "number" ? (value >= 1e9 && value < 1e10 ? value * 1000 : value)
    : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time > 0 && time <= 8.64e15 ? joinDateFormatter.format(time) : null;
}
