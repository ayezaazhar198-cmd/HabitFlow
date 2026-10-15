import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cancelHabitFlowReminders,
  HABITFLOW_NOTIFICATION_MARKER,
  reconcileHabitReminders,
} from './reminders.ts';
import { EMPTY_HABIT_DATA } from './models.ts';

function habit(overrides = {}) {
  return {
    id: 'habit-1',
    name: 'Read',
    icon: 'book-open',
    color: '#27866A',
    weekdays: [1, 3, 5],
    createdAt: '2026-10-12',
    reminderTime: '09:30',
    active: true,
    reminderNotificationIds: [],
    ...overrides,
  };
}

function makeAdapter({ granted = true } = {}) {
  const scheduled = [];
  const cancelled = [];
  let nextId = 0;
  return {
    scheduled,
    cancelled,
    adapter: {
      async getPermission() {
        return granted;
      },
      async getScheduled() {
        return scheduled;
      },
      async cancel(identifier) {
        cancelled.push(identifier);
        const index = scheduled.findIndex((item) => item.identifier === identifier);
        if (index >= 0) scheduled.splice(index, 1);
      },
      async schedule(item, weekday, fingerprint) {
        const identifier = `scheduled-${++nextId}`;
        scheduled.push({
          identifier,
          content: {
            data: {
              [HABITFLOW_NOTIFICATION_MARKER]: true,
              habitId: item.id,
              weekday,
              fingerprint,
            },
          },
        });
        return identifier;
      },
    },
  };
}

test('weekly reminders are created once per selected weekday and reconciled idempotently', async () => {
  const data = {
    ...EMPTY_HABIT_DATA,
    habits: [habit()],
    settings: { ...EMPTY_HABIT_DATA.settings, remindersEnabled: true },
  };
  const setup = makeAdapter();
  const first = await reconcileHabitReminders(data, setup.adapter);
  assert.equal(setup.scheduled.length, 3);
  assert.deepEqual(first.habits[0].reminderNotificationIds, [
    'scheduled-1',
    'scheduled-2',
    'scheduled-3',
  ]);

  const second = await reconcileHabitReminders(first, setup.adapter);
  assert.equal(setup.scheduled.length, 3);
  assert.deepEqual(second.habits[0].reminderNotificationIds, first.habits[0].reminderNotificationIds);
});

test('schedule changes replace old reminders and archived habits have none', async () => {
  const enabled = {
    ...EMPTY_HABIT_DATA,
    habits: [habit()],
    settings: { ...EMPTY_HABIT_DATA.settings, remindersEnabled: true },
  };
  const setup = makeAdapter();
  await reconcileHabitReminders(enabled, setup.adapter);
  const changed = {
    ...enabled,
    habits: [habit({ weekdays: [2], reminderTime: '07:15' })],
  };
  const updated = await reconcileHabitReminders(changed, setup.adapter);
  assert.equal(setup.scheduled.length, 1);
  assert.equal(setup.cancelled.length, 3);
  assert.equal(updated.habits[0].reminderNotificationIds.length, 1);

  const archived = {
    ...changed,
    habits: [habit({ active: false, archivedAt: '2026-10-13' })],
  };
  const cleared = await reconcileHabitReminders(archived, setup.adapter);
  assert.equal(setup.scheduled.length, 0);
  assert.deepEqual(cleared.habits[0].reminderNotificationIds, []);
});

test('global disable and denied permissions cancel only HabitFlow-managed notifications', async () => {
  const other = {
    identifier: 'other',
    content: { data: { owner: 'another-feature' } },
  };
  const setup = makeAdapter({ granted: false });
  setup.scheduled.push(other);
  setup.scheduled.push({
    identifier: 'ours',
    content: { data: { [HABITFLOW_NOTIFICATION_MARKER]: true } },
  });
  await assert.rejects(
    reconcileHabitReminders(
      {
        ...EMPTY_HABIT_DATA,
        habits: [habit()],
        settings: { ...EMPTY_HABIT_DATA.settings, remindersEnabled: true },
      },
      setup.adapter,
    ),
    /blocked/,
  );
  assert.deepEqual(setup.cancelled, ['ours']);
  assert.deepEqual(setup.scheduled, [other]);

  await cancelHabitFlowReminders(setup.adapter);
  assert.deepEqual(setup.scheduled, [other]);
});

test('partial scheduling failures cancel newly-created notifications and surface an error', async () => {
  const setup = makeAdapter();
  const originalSchedule = setup.adapter.schedule;
  let count = 0;
  setup.adapter.schedule = async (...args) => {
    if (++count === 2) throw new Error('OS scheduling error');
    return originalSchedule(...args);
  };
  await assert.rejects(
    reconcileHabitReminders(
      {
        ...EMPTY_HABIT_DATA,
        habits: [habit()],
        settings: { ...EMPTY_HABIT_DATA.settings, remindersEnabled: true },
      },
      setup.adapter,
    ),
    /could not be scheduled/,
  );
  assert.equal(setup.scheduled.length, 0);
  assert.deepEqual(setup.cancelled, ['scheduled-1']);
});
