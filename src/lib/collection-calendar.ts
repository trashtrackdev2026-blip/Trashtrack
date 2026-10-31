export type CollectionSchedule = { id: string; barangay: string; day: string; date?: string; time: string; status: string; description?: string; notes?: string };
export type CollectionFilters = { search: string; barangay: string; day: string; status: string };

export function collectionTimeLabel(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return value;
  const hour = Number(match[1]);
  if (hour > 23 || Number(match[2]) > 59) return value;
  if (match[3]) return `${hour}:${match[2]} ${match[3].toUpperCase()}`;
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

export function filterCollectionSchedules(schedules: CollectionSchedule[], filters: CollectionFilters): CollectionSchedule[] {
  const search = filters.search.trim().toLowerCase();
  return schedules.filter(schedule => {
    const weekday = schedule.date && /^\d{4}-\d{2}-\d{2}$/.test(schedule.date)
      ? new Date(`${schedule.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase() : (schedule.day || "").toLowerCase();
    return (!search || [schedule.barangay, schedule.description, schedule.notes, schedule.time, schedule.day, schedule.date].some(value => value?.toLowerCase().includes(search)))
      && (filters.barangay === "all" || schedule.barangay === filters.barangay)
      && (filters.day === "all" || weekday.split(",").some(day => day.trim() === filters.day))
      && (filters.status === "all" || schedule.status.toLowerCase() === filters.status);
  });
}
