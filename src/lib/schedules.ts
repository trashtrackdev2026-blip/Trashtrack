import { format } from "date-fns";

export interface CollectionSchedule {
  date?: string;
  day: string;
  status: string;
}

export function scheduleOccursOn(schedule: CollectionSchedule, day: Date): boolean {
  if (schedule.status !== "Active") return false;
  // Dated collections happen once. Preserve weekly schedules created before dates were supported.
  if (schedule.date) return schedule.date === format(day, "yyyy-MM-dd");
  return schedule.day.split(",").some(value => value.trim() === format(day, "EEEE"));
}
