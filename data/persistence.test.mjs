import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHabitStorage,
  CURRENT_SCHEMA_VERSION,
  HabitStorageError,
  STORAGE_KEY,
  UnsupportedHabitDataVersionError,
} from './persistence.ts';
import { EMPTY_HABIT_DATA } from './models.ts';
import { completionId } from './domain.ts';

function makeHabit(overrides = {}) {
  return {
    id: 'habit-1',
    name: 'Read',
    icon: 'book-open',
    color: '#27866A',
    weekdays: [1, 3, 5],
    createdAt: '2026-10-12',
    active: true,
    ...overrides,
  };
}

function memoryStorage(initialValue = null) {
  const values = new Map(initialValue === null ? [] : [[STORAGE_KEY, initialValue]]);
  return {
    values,
    adapter: {
      async getItem(key) {
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        values.set(key, value);
      },
      async removeItem(key) {
        values.delete(key);
      },
    },
  };
}

test('missing storage starts clean and does not write sample data', async () => {
  const memory = memoryStorage();
  const storage = createHabitStorage(memory.adapter);
  assert.deepEqual(await storage.load(), EMPTY_HABIT_DATA);
  assert.equal(memory.values.size, 0);
});

test('saved habits and completions survive a storage service restart', async () => {
  const memory = memoryStorage();
  const firstService = createHabitStorage(memory.adapter);
  const habit = makeHabit();
  const completion = {
    id: completionId(habit.id, '2026-10-12'),
    habitId: habit.id,
    date: '2026-10-12',
  };
  const saved = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    habits: [habit],
    completions: [completion],
    settings: { remindersEnabled: false, theme: 'light' },
  };
  await firstService.save(saved);

  const restartedService = createHabitStorage(memory.adapter);
  assert.deepEqual(await restartedService.load(), saved);
});

test('malformed and outdated storage fails safely without replacing the saved bytes', async () => {
  for (const value of ['{broken json', JSON.stringify({ schemaVersion: 0 })]) {
    const memory = memoryStorage(value);
    const storage = createHabitStorage(memory.adapter);
    await assert.rejects(storage.load(), HabitStorageError);
    assert.equal(memory.values.get(STORAGE_KEY), value);
  }
});

test('schema version 1 migrates to default reminder and light theme settings', async () => {
  const oldData = {
    schemaVersion: 1,
    habits: [makeHabit()],
    completions: [],
  };
  const memory = memoryStorage(JSON.stringify(oldData));
  const upgraded = await createHabitStorage(memory.adapter).load();
  assert.equal(upgraded.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(upgraded.settings, { remindersEnabled: false, theme: 'light' });
  assert.equal(upgraded.habits[0].reminderNotificationIds, undefined);
  assert.equal(
    JSON.parse(memory.values.get(STORAGE_KEY)).schemaVersion,
    CURRENT_SCHEMA_VERSION,
  );
});

test('legacy system theme preference migrates to light and is persisted', async () => {
  const habit = makeHabit();
  const completion = {
    id: completionId(habit.id, '2026-10-12'),
    habitId: habit.id,
    date: '2026-10-12',
  };
  const memory = memoryStorage(
    JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      habits: [habit],
      completions: [completion],
      settings: { remindersEnabled: true, theme: 'system' },
    }),
  );
  const migrated = await createHabitStorage(memory.adapter).load();
  assert.deepEqual(migrated.habits, [habit]);
  assert.deepEqual(migrated.completions, [completion]);
  assert.deepEqual(migrated.settings, { remindersEnabled: true, theme: 'light' });
  assert.equal(JSON.parse(memory.values.get(STORAGE_KEY)).settings.theme, 'light');
});

test('reset removes saved data and reports removal failures', async () => {
  const memory = memoryStorage(JSON.stringify({ schemaVersion: 2 }));
  await createHabitStorage(memory.adapter).clear();
  assert.equal(memory.values.has(STORAGE_KEY), false);

  const broken = createHabitStorage({
    ...memory.adapter,
    async removeItem() {
      throw new Error('disk unavailable');
    },
  });
  await assert.rejects(broken.clear(), /Unable to reset/);
});

test('unsupported schema versions have a specific error and no write occurs', async () => {
  const oldValue = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
  const memory = memoryStorage(oldValue);
  const storage = createHabitStorage(memory.adapter);
  await assert.rejects(storage.load(), UnsupportedHabitDataVersionError);
  assert.equal(memory.values.get(STORAGE_KEY), oldValue);
});

test('invalid weekdays, icons, colors and archived records without archive dates are rejected', async () => {
  const invalidValues = [
    { ...makeHabit(), weekdays: [] },
    { ...makeHabit(), weekdays: [1, 1] },
    { ...makeHabit(), icon: 'not-a-lucide-icon' },
    { ...makeHabit(), color: 'green' },
    { ...makeHabit(), active: false },
  ];
  for (const habit of invalidValues) {
    const storage = createHabitStorage(
      memoryStorage(
        JSON.stringify({ schemaVersion: 1, habits: [habit], completions: [] }),
      ).adapter,
    );
    await assert.rejects(storage.load(), HabitStorageError);
  }

  const archivedHabit = makeHabit({
    active: false,
    archivedAt: '2026-10-12',
  });
  const archivedStore = createHabitStorage(
    memoryStorage(
      JSON.stringify({ schemaVersion: 1, habits: [archivedHabit], completions: [] }),
    ).adapter,
  );
  assert.deepEqual((await archivedStore.load()).habits, [archivedHabit]);

  const orphanStore = memoryStorage(
    JSON.stringify({
      schemaVersion: 1,
      habits: [],
      completions: [
        { id: completionId('gone', '2026-10-12'), habitId: 'gone', date: '2026-10-12' },
      ],
    }),
  );
  await assert.rejects(createHabitStorage(orphanStore.adapter).load(), /missing habit/);
});

test('read and write failures are surfaced to the caller', async () => {
  const readFailure = createHabitStorage({
    async getItem() {
      throw new Error('disk unavailable');
    },
    async setItem() {},
  });
  await assert.rejects(readFailure.load(), /Unable to read/);

  const writeFailure = createHabitStorage({
    async getItem() {
      return null;
    },
    async setItem() {
      throw new Error('disk full');
    },
    async removeItem() {},
  });
  await assert.rejects(writeFailure.save(EMPTY_HABIT_DATA), /Unable to save/);
});
