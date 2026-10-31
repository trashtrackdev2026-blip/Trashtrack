import { STAFF_BARANGAYS } from "./staff-access.ts";

// Older reports stored a full address/plus code in location. Filters show only
// municipal barangay names; the original address and coordinates stay intact.
export function reportBarangayLabel(location: string): string | null {
  return STAFF_BARANGAYS.find(name => new RegExp(`(^|[^a-z])${name}($|[^a-z])`,"i").test(location)) || null;
}
