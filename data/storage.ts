import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { HabitStorageError, validateHabitData } from './persistence';
import {
  EMPTY_HABIT_DATA,
  type Habit,
  type HabitData,
} from './models';

const STORAGE_KEY = '@habitflow/data';
const PREFERENCES_KEY = '@habitflow/preferences';
const LEGACY_MIGRATION_KEY = 'legacy_async_storage_migrated';

type HabitRow = {
  id: string;
  name: string;
  icon: string;
  color: string;
  weekdays: string;
  created_at: string;
  target_description: string | null;
  reminder_time: string | null;
  reminder_notification_ids: string | null;
  active: number;
  archived_at: string | null;
  position: number;
};

type CompletionRow = {
  id: string;
  habit_id: string;
  date: string;
  position: number;
};

function storageError(message: string, error: unknown): HabitStorageError {
  return new HabitStorageError(message, { cause: error });
}

function parseJson<T>(value: string, description: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw storageError(`Saved ${description} could not be read.`, error);
  }
}

function parsePreferences(value: string | null): HabitData['settings'] {
  if (value === null) return EMPTY_HABIT_DATA.settings;
  const preferences = parseJson<unknown>(value, 'HabitFlow preferences');
  return validateHabitData({
    ...EMPTY_HABIT_DATA,
    settings: preferences,
  }).settings;
}

function habitFromRow(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as Habit['icon'],
    color: row.color,
    weekdays: parseJson<number[]>(row.weekdays, 'habit weekdays'),
    createdAt: row.created_at as Habit['createdAt'],
    ...(row.target_description === null ? {} : { targetDescription: row.target_description }),
    ...(row.reminder_time === null ? {} : { reminderTime: row.reminder_time }),
    ...(row.reminder_notification_ids === null
      ? {}
      : { reminderNotificationIds: parseJson<string[]>(row.reminder_notification_ids, 'reminder identifiers') }),
    active: row.active === 1,
    ...(row.archived_at === null ? {} : { archivedAt: row.archived_at as Habit['archivedAt'] }),
  };
}

async function replaceStructuredData(
  database: SQLite.SQLiteDatabase,
  data: HabitData,
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync('DELETE FROM completions; DELETE FROM habits;');
    for (const [position, habit] of data.habits.entries()) {
      await transaction.runAsync(
        `INSERT INTO habits (
          id, name, icon, color, weekdays, created_at, target_description,
          reminder_time, reminder_notification_ids, active, archived_at, position
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        habit.id,
        habit.name,
        habit.icon,
        habit.color,
        JSON.stringify(habit.weekdays),
        habit.createdAt,
        habit.targetDescription ?? null,
        habit.reminderTime ?? null,
        habit.reminderNotificationIds ? JSON.stringify(habit.reminderNotificationIds) : null,
        habit.active ? 1 : 0,
        habit.archivedAt ?? null,
        position,
      );
    }
    for (const [position, completion] of data.completions.entries()) {
      await transaction.runAsync(
        'INSERT INTO completions (id, habit_id, date, position) VALUES (?, ?, ?, ?)',
        completion.id,
        completion.habitId,
        completion.date,
        position,
      );
    }
  });
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync('habitflow.db');
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      weekdays TEXT NOT NULL,
      created_at TEXT NOT NULL,
      target_description TEXT,
      reminder_time TEXT,
      reminder_notification_ids TEXT,
      active INTEGER NOT NULL CHECK (active IN (0, 1)),
      archived_at TEXT,
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS completions (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      position INTEGER NOT NULL,
      UNIQUE (habit_id, date)
    );
    CREATE INDEX IF NOT EXISTS completions_by_date ON completions(date);
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  const migration = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_metadata WHERE key = ?',
    LEGACY_MIGRATION_KEY,
  );
  if (migration?.value !== '1') {
    const legacyValue = await AsyncStorage.getItem(STORAGE_KEY);
    const legacyData =
      legacyValue === null
        ? EMPTY_HABIT_DATA
        : validateHabitData(parseJson<unknown>(legacyValue, 'saved HabitFlow data'));
    const savedPreferences = await AsyncStorage.getItem(PREFERENCES_KEY);
    await replaceStructuredData(database, legacyData);
    if (savedPreferences === null) {
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(legacyData.settings));
    }
    await database.runAsync(
      'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
      LEGACY_MIGRATION_KEY,
      '1',
    );
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  return database;
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

async function loadNativeHabitData(): Promise<HabitData> {
  try {
    const database = await getDatabase();
    const [habitRows, completionRows, settingsValue] = await Promise.all([
      database.getAllAsync<HabitRow>('SELECT * FROM habits ORDER BY position'),
      database.getAllAsync<CompletionRow>('SELECT id, habit_id, date, position FROM completions ORDER BY position'),
      AsyncStorage.getItem(PREFERENCES_KEY),
    ]);
    return validateHabitData({
      schemaVersion: 2,
      habits: habitRows.map(habitFromRow),
      completions: completionRows.map((row) => ({
        id: row.id,
        habitId: row.habit_id,
        date: row.date,
      })),
      settings: parsePreferences(settingsValue),
    });
  } catch (error) {
    throw storageError('Unable to read saved HabitFlow data from SQLite.', error);
  }
}

async function saveNativeHabitData(data: HabitData): Promise<void> {
  const validated = validateHabitData(data);
  try {
    const database = await getDatabase();
    await replaceStructuredData(database, validated);
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(validated.settings));
  } catch (error) {
    throw storageError('Unable to save HabitFlow data to SQLite.', error);
  }
}

async function clearNativeHabitData(): Promise<void> {
  try {
    const database = await getDatabase();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync('DELETE FROM completions; DELETE FROM habits;');
    });
    await AsyncStorage.multiRemove([PREFERENCES_KEY, STORAGE_KEY]);
  } catch (error) {
    throw storageError('Unable to reset saved HabitFlow data.', error);
  }
}

export const loadHabitData = loadNativeHabitData;
export const saveHabitData = saveNativeHabitData;
export const clearHabitData = clearNativeHabitData;

export { createHabitRecord } from './persistence';
export {
  HabitStorageError,
  UnsupportedHabitDataVersionError,
} from './persistence';
