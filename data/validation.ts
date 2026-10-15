export type HabitFormErrors = {
  name?: string;
  weekdays?: string;
};

export function validateHabitForm(
  name: string,
  weekdays: readonly number[],
): HabitFormErrors {
  const errors: HabitFormErrors = {};
  if (!name.trim()) errors.name = 'Enter a name for this habit.';
  const validWeekdays =
    weekdays.length > 0 &&
    weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    new Set(weekdays).size === weekdays.length;
  if (!validWeekdays) {
    errors.weekdays = 'Choose at least one valid day of the week.';
  }
  return errors;
}
