import type { WeekdayNumber } from "./models.ts";

export const INDIVIDUAL_WEEKDAYS: { day: WeekdayNumber; label: string }[] = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 7, label: "Sunday" },
];

/** Map a device-local ISO calendar date to Monday=1 through Sunday=7. */
export function weekdayForLocalDate(isoDate: string): WeekdayNumber {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new RangeError("Expected a local ISO calendar date.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new RangeError("Expected a valid local calendar date.");
  }
  return (((date.getDay() + 6) % 7) + 1) as WeekdayNumber;
}
