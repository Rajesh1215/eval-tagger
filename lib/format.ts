import { addDays, parseISO } from "./derive";

/** ₹ with Indian digit grouping. */
export const inr = (n: number): string => "₹" + Math.round(n).toLocaleString("en-IN");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Wed 3 Sep" */
export function fmtDay(iso: string): string {
  const d = parseISO(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Friday" */
export function weekdayFull(iso: string): string {
  return DAYS_FULL[parseISO(iso).getDay()];
}

/** Group label for the Upcoming tab: Tomorrow, Mon 8 Sep … */
export function upcomingLabel(iso: string, today: string): string {
  if (iso === addDays(today, 1)) return "Tomorrow";
  return fmtDay(iso);
}
