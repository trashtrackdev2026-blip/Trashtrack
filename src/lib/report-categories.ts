export const REPORT_CATEGORIES = ["Garbage Overflow", "Illegal Dumping", "Missed Collection", "Other"] as const;
export type ReportCategory = typeof REPORT_CATEGORIES[number];

/** Older saved labels remain counted without changing the original report. */
export function reportCategory(value: unknown): ReportCategory {
  const key = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (["garbage overflow", "uncollected waste", "overflowing garbage"].includes(key)) return "Garbage Overflow";
  if (key === "illegal dumping") return "Illegal Dumping";
  if (key === "missed collection") return "Missed Collection";
  return "Other";
}
