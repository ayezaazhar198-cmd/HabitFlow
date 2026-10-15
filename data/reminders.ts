import type { Habit, HabitData } from './models.ts';

export const HABITFLOW_NOTIFICATION_MARKER = 'habitflowReminder';

export type ManagedScheduledNotification = {
  identifier: string;
  content: { data?: Record<string, unknown> };
};

export type ReminderNotificationAdapter = {
  getPermission: () => Promise<boolean>;
  getScheduled: () => Promise<ManagedScheduledNotification[]>;
  cancel: (identifier: string) => Promise<void>;
  schedule: (habit: Habit, weekday: number, fingerprint: string) => Promise<string>;
};

export async function reconcileHabitReminders(
  data: HabitData,
  adapter: ReminderNotificationAdapter,
): Promise<HabitData> {
  const scheduled = await adapter.getScheduled();
  const managed = scheduled.filter(
    (notification) =>
      notification.content.data?.[HABITFLOW_NOTIFICATION_MARKER] === true,
  );
  const requestedHabits = data.settings.remindersEnabled
    ? data.habits.filter(
        (habit) => habit.active && habit.reminderTime && habit.weekdays.length > 0,
      )
    : [];

  if (requestedHabits.length > 0 && !(await adapter.getPermission())) {
    for (const notification of managed) await adapter.cancel(notification.identifier);
    throw new Error(
      'Habit notifications are blocked. Allow notifications in device Settings and retry.',
    );
  }

  const expected = requestedHabits.flatMap((habit) =>
    habit.weekdays.map((weekday) => ({
      habit,
      weekday,
      fingerprint: reminderFingerprint(habit),
    })),
  );
  const alreadyScheduled =
    managed.length === expected.length &&
    expected.every((item) =>
      managed.some(
        (notification) =>
          notification.content.data?.habitId === item.habit.id &&
          notification.content.data?.weekday === item.weekday &&
          notification.content.data?.fingerprint === item.fingerprint,
      ),
    );

  if (alreadyScheduled) {
    const idsByHabit = new Map<string, string[]>();
    for (const notification of managed) {
      const habitId = notification.content.data?.habitId;
      if (typeof habitId !== 'string') continue;
      idsByHabit.set(habitId, [...(idsByHabit.get(habitId) ?? []), notification.identifier]);
    }
    return {
      ...data,
      habits: data.habits.map((habit) => ({
        ...habit,
        reminderNotificationIds: idsByHabit.get(habit.id) ?? [],
      })),
    };
  }

  for (const notification of managed) await adapter.cancel(notification.identifier);
  const idsByHabit = new Map<string, string[]>();
  try {
    for (const { habit, weekday, fingerprint } of expected) {
      const identifier = await adapter.schedule(habit, weekday, fingerprint);
      idsByHabit.set(habit.id, [...(idsByHabit.get(habit.id) ?? []), identifier]);
    }
  } catch (error) {
    for (const identifiers of idsByHabit.values()) {
      for (const identifier of identifiers) await adapter.cancel(identifier);
    }
    throw new Error('Habit reminders could not be scheduled. Check notification permissions and try again.', {
      cause: error,
    });
  }

  return {
    ...data,
    habits: data.habits.map((habit) => ({
      ...habit,
      reminderNotificationIds: idsByHabit.get(habit.id) ?? [],
    })),
  };
}

export function reminderFingerprint(habit: Habit): string {
  return `${habit.id}|${habit.name}|${habit.reminderTime ?? ''}|${[...habit.weekdays]
    .sort((first, second) => first - second)
    .join(',')}`;
}

export async function cancelHabitFlowReminders(
  adapter: Pick<ReminderNotificationAdapter, 'getScheduled' | 'cancel'>,
): Promise<void> {
  const scheduled = await adapter.getScheduled();
  for (const notification of scheduled) {
    if (notification.content.data?.[HABITFLOW_NOTIFICATION_MARKER] === true) {
      await adapter.cancel(notification.identifier);
    }
  }
}
