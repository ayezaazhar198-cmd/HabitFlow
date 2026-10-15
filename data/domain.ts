import type {
  CompletionRecord,
  Habit,
  HabitData,
  HabitInput,
  LocalDate,
} from './models.ts';

export function localDateKey(date: Date): LocalDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as LocalDate;
}

export function parseLocalDate(value: LocalDate): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addLocalDays(value: LocalDate, days: number): LocalDate {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function compareLocalDates(first: LocalDate, second: LocalDate): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

export function completionId(habitId: string, date: LocalDate): string {
  return `${encodeURIComponent(habitId)}@${date}`;
}

export function isScheduledOn(habit: Habit, date: LocalDate): boolean {
  if (!habit.active && !habit.archivedAt) return false;
  if (compareLocalDates(date, habit.createdAt) < 0) return false;
  if (habit.archivedAt && compareLocalDates(date, habit.archivedAt) > 0) return false;
  const weekday = parseLocalDate(date).getDay();
  return habit.weekdays.includes(weekday);
}

export function completionFor(
  completions: readonly CompletionRecord[],
  habitId: string,
  date: LocalDate,
): boolean {
  return completions.some((record) => record.habitId === habitId && record.date === date);
}

export function updateHabit(
  data: HabitData,
  habitId: string,
  input: HabitInput,
): HabitData {
  if (!data.habits.some((habit) => habit.id === habitId)) {
    throw new Error('This habit could not be found. Your saved data was not changed.');
  }
  return {
    ...data,
    habits: data.habits.map((habit) =>
      habit.id === habitId ? { ...habit, ...input } : habit,
    ),
  };
}

export function archiveHabit(
  data: HabitData,
  habitId: string,
  date: LocalDate,
): HabitData {
  const habit = data.habits.find((item) => item.id === habitId);
  if (!habit) {
    throw new Error('This habit could not be found. Your saved data was not changed.');
  }
  if (!habit.active) throw new Error('This habit is already archived.');
  return {
    ...data,
    habits: data.habits.map((item) =>
      item.id === habitId ? { ...item, active: false, archivedAt: date } : item,
    ),
  };
}

export function restoreHabit(data: HabitData, habitId: string): HabitData {
  if (!data.habits.some((item) => item.id === habitId)) {
    throw new Error('This habit could not be found. Your saved data was not changed.');
  }
  return {
    ...data,
    habits: data.habits.map((item) =>
      item.id === habitId ? { ...item, active: true, archivedAt: undefined } : item,
    ),
  };
}

export function permanentlyDeleteHabit(data: HabitData, habitId: string): HabitData {
  if (!data.habits.some((habit) => habit.id === habitId)) {
    throw new Error('This habit could not be found. Your saved data was not changed.');
  }
  return {
    ...data,
    habits: data.habits.filter((habit) => habit.id !== habitId),
    completions: data.completions.filter((record) => record.habitId !== habitId),
  };
}

export function toggleCompletion(
  data: HabitData,
  habitId: string,
  date: LocalDate,
  today: LocalDate,
): HabitData {
  const habit = data.habits.find((item) => item.id === habitId);
  if (!habit) throw new Error('This habit is no longer available.');
  if (compareLocalDates(date, today) > 0) {
    throw new Error('Future dates cannot be marked complete.');
  }

  const existing = data.completions.some(
    (record) => record.habitId === habitId && record.date === date,
  );
  if (!existing && !isScheduledOn(habit, date)) {
    throw new Error('This habit is not scheduled for the selected date.');
  }

  if (existing) {
    return {
      ...data,
      completions: data.completions.filter(
        (record) => !(record.habitId === habitId && record.date === date),
      ),
    };
  }

  const record: CompletionRecord = {
    id: completionId(habitId, date),
    habitId,
    date,
  };
  return { ...data, completions: [...data.completions, record] };
}

export function mondayOfWeek(date: LocalDate): LocalDate {
  const weekday = parseLocalDate(date).getDay();
  return addLocalDays(date, weekday === 0 ? -6 : 1 - weekday);
}

export type WeekSummary = {
  startDate: LocalDate;
  endDate: LocalDate;
  days: Array<{ date: LocalDate; completions: number; eligible: number }>;
  totalCompletions: number;
  eligibleCompletions: number;
  percentage: number;
};

export function calculateWeekSummary(
  habits: readonly Habit[],
  completions: readonly CompletionRecord[],
  weekStart: LocalDate,
  today: LocalDate,
): WeekSummary {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addLocalDays(weekStart, index);
    const eligibleHabits = habits.filter((habit) => isScheduledOn(habit, date));
    const eligibleDate = compareLocalDates(date, today) <= 0;
    const completedHabits = eligibleDate
      ? eligibleHabits.filter((habit) => completionFor(completions, habit.id, date))
      : [];
    return {
      date,
      completions: completedHabits.length,
      eligible: eligibleDate ? eligibleHabits.length : 0,
    };
  });

  const totalCompletions = days.reduce((total, day) => total + day.completions, 0);
  const eligibleCompletions = days.reduce((total, day) => total + day.eligible, 0);
  return {
    startDate: weekStart,
    endDate: days[6].date,
    days,
    totalCompletions,
    eligibleCompletions,
    percentage:
      eligibleCompletions === 0
        ? 0
        : Math.round((totalCompletions / eligibleCompletions) * 100),
  };
}

function scheduledDaysThrough(
  habit: Habit,
  from: LocalDate,
  to: LocalDate,
): LocalDate[] {
  const days: LocalDate[] = [];
  for (let date = from; compareLocalDates(date, to) <= 0; date = addLocalDays(date, 1)) {
    if (isScheduledOn(habit, date)) days.push(date);
  }
  return days;
}

function completedOn(completions: readonly CompletionRecord[], habitId: string, date: LocalDate) {
  return completionFor(completions, habitId, date);
}

/**
 * A streak is a run of completed scheduled dates, so unscheduled dates are skipped.
 * Best streak scans only through today and ignores duplicate records.
 * Current streak includes today when complete; an incomplete scheduled today is
 * still in progress, so its run is measured through the latest earlier scheduled day.
 */
export function calculateStreaks(
  habit: Habit,
  completions: readonly CompletionRecord[],
  today: LocalDate,
): { current: number; best: number } {
  const completedDates = new Set(
    completions
      .filter(
        (record) =>
          record.habitId === habit.id &&
          compareLocalDates(record.date, today) <= 0 &&
          isScheduledOn(habit, record.date),
      )
      .map((record) => record.date),
  );
  const eligibleDates = scheduledDaysThrough(habit, habit.createdAt, today);

  let best = 0;
  let run = 0;
  for (const date of eligibleDates) {
    if (completedDates.has(date)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  if (habit.archivedAt && compareLocalDates(today, habit.archivedAt) > 0) {
    return { current: 0, best };
  }

  let lastStreakDate = today;
  const todayIsScheduled = isScheduledOn(habit, today);
  if (todayIsScheduled && !completedDates.has(today)) {
    const previousScheduled = [...eligibleDates].reverse().find((date) => date < today);
    if (!previousScheduled) return { current: 0, best };
    lastStreakDate = previousScheduled;
  } else if (!todayIsScheduled) {
    const previousScheduled = [...eligibleDates].reverse().find((date) => date < today);
    if (!previousScheduled) return { current: 0, best };
    lastStreakDate = previousScheduled;
  }

  let current = 0;
  const currentDates = [...eligibleDates].reverse().filter((date) => date <= lastStreakDate);
  for (const date of currentDates) {
    if (!completedDates.has(date)) break;
    current += 1;
  }
  return { current, best };
}

export function completionCountsByDate(
  completions: readonly CompletionRecord[],
  dates: readonly LocalDate[],
): Map<LocalDate, number> {
  const requestedDates = new Set(dates);
  const countByDate = new Map<LocalDate, Set<string>>();
  for (const record of completions) {
    if (!requestedDates.has(record.date)) continue;
    const day = countByDate.get(record.date) ?? new Set<string>();
    day.add(record.habitId);
    countByDate.set(record.date, day);
  }
  return new Map(
    dates.map((date) => [date, countByDate.get(date)?.size ?? 0] as const),
  );
}

export function historyForDate(
  habits: readonly Habit[],
  completions: readonly CompletionRecord[],
  date: LocalDate,
  today: LocalDate,
): { scheduled: Habit[]; completedIds: Set<string>; future: boolean } {
  const future = compareLocalDates(date, today) > 0;
  const scheduled = future
    ? []
    : habits.filter(
        (habit) =>
          isScheduledOn(habit, date) ||
          completionFor(completions, habit.id, date),
      );
  const completedIds = new Set(
    scheduled
      .filter((habit) => completionFor(completions, habit.id, date))
      .map((habit) => habit.id),
  );
  return { scheduled, completedIds, future };
}
