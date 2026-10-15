import {
  EMPTY_HABIT_DATA,
  type CompletionRecord,
  type Habit,
  type HabitData,
  type LocalDate,
  type ThemePreference,
} from './models.ts';
import { compareLocalDates, completionId, localDateKey } from './domain.ts';
import { isLucideIconName } from './icons.ts';

export const STORAGE_KEY = '@habitflow/data';
export const CURRENT_SCHEMA_VERSION = 2;

export class HabitStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HabitStorageError';
  }
}

export class UnsupportedHabitDataVersionError extends HabitStorageError {
  constructor(version: unknown) {
    super(`Saved HabitFlow data uses unsupported schema version "${String(version)}".`);
    this.name = 'UnsupportedHabitDataVersionError';
  }
}

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isHabit(value: unknown): value is Habit {
  if (typeof value !== 'object' || value === null) return false;
  const habit = value as Record<string, unknown>;
  const weekdays = habit.weekdays;
  return (
    typeof habit.id === 'string' &&
    habit.id.length > 0 &&
    typeof habit.name === 'string' &&
    habit.name.trim().length > 0 &&
    isLucideIconName(habit.icon) &&
    typeof habit.color === 'string' &&
    /^#[0-9A-Fa-f]{6}$/.test(habit.color) &&
    Array.isArray(weekdays) &&
    weekdays.length > 0 &&
    weekdays.every(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6,
    ) &&
    new Set(weekdays).size === weekdays.length &&
    isLocalDate(habit.createdAt) &&
    (habit.targetDescription === undefined ||
      typeof habit.targetDescription === 'string') &&
    (habit.reminderTime === undefined ||
      (typeof habit.reminderTime === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(habit.reminderTime))) &&
    (habit.reminderNotificationIds === undefined ||
      (Array.isArray(habit.reminderNotificationIds) &&
        habit.reminderNotificationIds.every(
          (id) => typeof id === 'string' && id.length > 0,
        ))) &&
    typeof habit.active === 'boolean' &&
    ((habit.active && habit.archivedAt === undefined) ||
      (!habit.active && isLocalDate(habit.archivedAt))) &&
    (habit.archivedAt === undefined ||
      (isLocalDate(habit.archivedAt) && habit.active === false))
  );
}

function isCompletion(value: unknown): value is CompletionRecord {
  if (typeof value !== 'object' || value === null) return false;
  const completion = value as Record<string, unknown>;
  return (
    typeof completion.habitId === 'string' &&
    completion.habitId.length > 0 &&
    isLocalDate(completion.date) &&
    completion.id === completionId(completion.habitId, completion.date)
  );
}

export function validateHabitData(value: unknown): HabitData {
  if (typeof value !== 'object' || value === null) {
    throw new HabitStorageError('Saved HabitFlow data is not a valid object.');
  }
  const data = value as Record<string, unknown>;
  if (data.schemaVersion !== 1 && data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedHabitDataVersionError(data.schemaVersion);
  }
  if (
    !Array.isArray(data.habits) ||
    !Array.isArray(data.completions) ||
    !data.habits.every(isHabit) ||
    !data.completions.every(isCompletion)
  ) {
    throw new HabitStorageError(
      'Saved HabitFlow data is incomplete or malformed. It has not been changed.',
    );
  }

  const habits = data.habits as Habit[];
  const completions = data.completions as CompletionRecord[];
  if (new Set(habits.map((habit) => habit.id)).size !== habits.length) {
    throw new HabitStorageError('Saved habits contain duplicate IDs.');
  }
  if (new Set(completions.map((record) => record.id)).size !== completions.length) {
    throw new HabitStorageError('Saved completion records contain duplicates.');
  }
  const habitIds = new Set(habits.map((habit) => habit.id));
  if (completions.some((record) => !habitIds.has(record.habitId))) {
    throw new HabitStorageError('Saved completion data refers to a missing habit.');
  }
  const habitById = new Map(habits.map((habit) => [habit.id, habit]));
  if (
    completions.some((record) => {
      const habit = habitById.get(record.habitId);
      return (
        !habit ||
        compareLocalDates(record.date, habit.createdAt) < 0 ||
        (habit.archivedAt && compareLocalDates(record.date, habit.archivedAt) > 0)
      );
    })
  ) {
    throw new HabitStorageError('Saved completion dates do not match their habit history.');
  }
  if (
    data.schemaVersion === CURRENT_SCHEMA_VERSION &&
    (typeof data.settings !== 'object' ||
      data.settings === null ||
      typeof (data.settings as Record<string, unknown>).remindersEnabled !== 'boolean' ||
      !['light', 'dark', 'system'].includes(
        String((data.settings as Record<string, unknown>).theme),
      ))
  ) {
    throw new HabitStorageError(
      'Saved HabitFlow settings are incomplete or malformed. They have not been changed.',
    );
  }
  const migrated = data.schemaVersion === 1;
  const storedTheme = (data.settings as Record<string, unknown> | undefined)?.theme;
  const theme: ThemePreference = storedTheme === 'dark' ? 'dark' : 'light';
  const settings = migrated
    ? { remindersEnabled: false, theme: 'light' as const }
    : {
        ...(data.settings as HabitData['settings']),
        theme,
      };
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    habits,
    completions,
    settings,
  };
}

export function createHabitStorage(storage: KeyValueStorage) {
  return {
    async load(): Promise<HabitData> {
      let serialized: string | null;
      try {
        serialized = await storage.getItem(STORAGE_KEY);
      } catch (error) {
        throw new HabitStorageError('Unable to read saved HabitFlow data.', {
          cause: error,
        });
      }
      if (serialized === null) return EMPTY_HABIT_DATA;
      let decoded: unknown;
      try {
        decoded = JSON.parse(serialized);
      } catch (error) {
        throw new HabitStorageError(
          'Saved HabitFlow data could not be read. It has not been overwritten.',
          { cause: error },
        );
      }
      const validData = validateHabitData(decoded);
      if (
        typeof decoded === 'object' &&
        decoded !== null &&
        ((decoded as Record<string, unknown>).schemaVersion !== CURRENT_SCHEMA_VERSION ||
          (decoded as { settings?: Record<string, unknown> }).settings?.theme === 'system')
      ) {
        try {
          await storage.setItem(STORAGE_KEY, JSON.stringify(validData));
        } catch (error) {
          throw new HabitStorageError(
            'Saved HabitFlow data was read but its schema upgrade could not be saved.',
            { cause: error },
          );
        }
      }
      return validData;
    },
    async save(data: HabitData): Promise<void> {
      const validData = validateHabitData(data);
      try {
        await storage.setItem(STORAGE_KEY, JSON.stringify(validData));
      } catch (error) {
        throw new HabitStorageError('Unable to save HabitFlow data.', {
          cause: error,
        });
      }
    },
    async clear(): Promise<void> {
      try {
        await storage.removeItem(STORAGE_KEY);
      } catch (error) {
        throw new HabitStorageError('Unable to reset saved HabitFlow data.', {
          cause: error,
        });
      }
    },
  };
}

export function createHabitId(existingIds: readonly string[] = []): string {
  const ids = new Set(existingIds);
  let id = '';
  do {
    const random = Math.random().toString(36).slice(2, 12);
    id = `habit-${Date.now().toString(36)}-${random}`;
  } while (ids.has(id));
  return id;
}

export function createHabitRecord(
  input: Omit<Habit, 'id' | 'createdAt' | 'active' | 'archivedAt'>,
  existingIds: readonly string[],
  now = new Date(),
): Habit {
  return {
    ...input,
    id: createHabitId(existingIds),
    createdAt: localDateKey(now),
    active: true,
  };
}
