import { StaffAccessError } from "./staff-access.ts";
export const EVENT_CATEGORIES = ["Clean-up Drive", "Seminar", "Tree Planting", "Other"] as const;
export function canonicalEventCategory(value: unknown): string {
  const raw = String(value || "").trim();
  const key = raw.toLowerCase().replace(/[\s_-]/g, "");
  return ({ cleanupdrive: "Clean-up Drive", seminar: "Seminar", treeplanting: "Tree Planting", other: "Other", others: "Other" } as Record<string,string>)[key] || raw;
}
export function eventCategoryField(value: unknown, legacy = ""): string {
  const category = canonicalEventCategory(value) || "Other";
  if (!(EVENT_CATEGORIES as readonly string[]).includes(category) && category !== legacy) throw new StaffAccessError("Choose Clean-up Drive, Seminar, Tree Planting or Other.", 400);
  return category;
}
