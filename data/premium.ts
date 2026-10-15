import type { HabitData } from './models.ts';

export const FREE_ACTIVE_HABIT_LIMIT = 3;
export const PRICE_PKR = 1000;
export const PRICE_USD = 4.99;

export const PLAN_COMPARISON = [
  { feature: 'Active habits', free: 'Up to 3', premium: 'Unlimited' },
  { feature: 'Daily check-ins and basic streaks', free: 'Included', premium: 'Included' },
  { feature: 'Today dashboard, basic history, and weekly stats', free: 'Included', premium: 'Included' },
  { feature: 'Scheduled reminders', free: '1 per habit', premium: '1 per habit' },
  { feature: 'Light and Dark themes', free: 'Included', premium: 'Included' },
  { feature: 'Payment', free: 'Free', premium: 'One time' },
] as const;

export const PREMIUM_FEATURE_ROADMAP = [
  'Advanced weekly and monthly statistics',
  'Multiple reminders per habit',
  'More custom colors and additional themes',
  'Detailed history and progress insights',
  'Achievement badges and extra milestones',
] as const;

export class FreeHabitLimitError extends Error {
  constructor() {
    super(`The Free plan includes up to ${FREE_ACTIVE_HABIT_LIMIT} active habits.`);
    this.name = 'FreeHabitLimitError';
  }
}

export function assertFreeHabitLimit(
  data: HabitData,
  additionalHabits: number,
  hasLifetimeAccess = false,
): void {
  if (hasLifetimeAccess) return;
  const activeHabits = data.habits.filter((habit) => habit.active).length;
  if (activeHabits + additionalHabits > FREE_ACTIVE_HABIT_LIMIT) {
    throw new FreeHabitLimitError();
  }
}
