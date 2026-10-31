export function accountGroup(role: unknown, hasStaffRequest = false): "resident" | "semi-admin" | "admin" | "unknown" {
  const value = String(role || "").trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "semi-admin" || hasStaffRequest) return "semi-admin";
  return value === "resident" ? "resident" : "unknown";
}
