import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLocalDays,
  archiveHabit,
  calculateStreaks,
  calculateWeekSummary,
  completionCountsByDate,
  completionId,
  historyForDate,
  isScheduledOn,
  localDateKey,
  mondayOfWeek,
  permanentlyDeleteHabit,
  restoreHabit,
  toggleCompletion,
  updateHabit,
} from './domain.ts';
import { EMPTY_HABIT_DATA } from './models.ts';

const habit = (overrides = {}) => ({
  id: 'habit-a',
  name: 'Daily walk',
  icon: 'footprints',
  color: '#27866A',
  weekdays: [1, 2, 3, 4, 5],
  createdAt: '2026-10-05',
  active: true,
  ...overrides,
});

const record = (habitId, date) => ({
  id: completionId(habitId, date),
  habitId,
  date,
});

test('local calendar date helpers cross month, year, leap-day and DST dates', () => {
  assert.equal(addLocalDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addLocalDays('2024-02-29', 1), '2024-03-01');
  assert.equal(addLocalDays('2024-12-31', 1), '2025-01-01');
  assert.equal(addLocalDays('2026-03-08', 1), '2026-03-09');
  assert.equal(localDateKey(new Date(2026, 9, 12, 23, 59)), '2026-10-12');
});

test('completion identity prevents duplicate completion records when toggled rapidly', () => {
  const item = habit();
  const first = toggleCompletion(
    { ...EMPTY_HABIT_DATA, habits: [item] },
    item.id,
    '2026-10-12',
    '2026-10-12',
  );
  assert.equal(first.completions.length, 1);
  assert.equal(first.completions[0].id, completionId(item.id, '2026-10-12'));

  const removed = toggleCompletion(first, item.id, '2026-10-12', '2026-10-12');
  assert.equal(removed.completions.length, 0);
});

test('completion rejects future and unscheduled days and safely handles missing habits', () => {
  const item = habit();
  const data = { ...EMPTY_HABIT_DATA, habits: [item] };
  assert.throws(
    () => toggleCompletion(data, item.id, '2026-10-13', '2026-10-12'),
    /Future dates/,
  );
  assert.throws(
    () => toggleCompletion(data, item.id, '2026-10-10', '2026-10-12'),
    /not scheduled/,
  );
  assert.throws(
    () => toggleCompletion(data, 'missing', '2026-10-12', '2026-10-12'),
    /no longer available/,
  );
});

test('existing historical completion can be removed after schedule is edited', () => {
  const item = habit({ weekdays: [1] });
  const saved = {
    ...EMPTY_HABIT_DATA,
    habits: [item],
    completions: [record(item.id, '2026-10-06')],
  };
  const changed = toggleCompletion(saved, item.id, '2026-10-06', '2026-10-12');
  assert.equal(changed.completions.length, 0);
});

test('editing preserves historical completion records', () => {
  const item = habit();
  const completion = record(item.id, '2026-10-09');
  const original = { ...EMPTY_HABIT_DATA, habits: [item], completions: [completion] };
  const updated = updateHabit(original, item.id, {
    name: 'Changed name',
    icon: 'heart',
    color: '#B76672',
    weekdays: [1, 2, 3, 4, 5],
  });
  assert.equal(updated.habits[0].name, 'Changed name');
  assert.deepEqual(updated.completions, [completion]);
  assert.throws(() => updateHabit(original, 'missing', {}), /could not be found/);
});

test('archiving stops future scheduled days but keeps history; restoring reactivates it', () => {
  const item = habit();
  const completion = record(item.id, '2026-10-07');
  const data = { ...EMPTY_HABIT_DATA, habits: [item], completions: [completion] };
  const archived = archiveHabit(data, item.id, '2026-10-08');
  assert.equal(archived.habits[0].active, false);
  assert.equal(isScheduledOn(archived.habits[0], '2026-10-08'), true);
  assert.equal(isScheduledOn(archived.habits[0], '2026-10-09'), false);
  assert.deepEqual(archived.completions, [completion]);
  assert.equal(restoreHabit(archived, item.id).habits[0].active, true);
  assert.throws(() => archiveHabit(data, 'missing', '2026-10-08'), /could not be found/);
});

test('permanent deletion explicitly removes its completion history only', () => {
  const first = habit();
  const second = habit({ id: 'habit-b' });
  const retained = record(second.id, '2026-10-07');
  const data = {
    ...EMPTY_HABIT_DATA,
    habits: [first, second],
    completions: [record(first.id, '2026-10-06'), retained],
  };
  const deleted = permanentlyDeleteHabit(data, first.id);
  assert.deepEqual(deleted.habits, [second]);
  assert.deepEqual(deleted.completions, [retained]);
  assert.throws(() => permanentlyDeleteHabit(deleted, first.id), /could not be found/);
});

test('completion is only scheduled on selected weekdays after creation', () => {
  const item = habit({ weekdays: [1, 3] });
  assert.equal(isScheduledOn(item, '2026-10-05'), true);
  assert.equal(isScheduledOn(item, '2026-10-07'), true);
  assert.equal(isScheduledOn(item, '2026-10-06'), false);
  assert.equal(isScheduledOn(item, '2026-10-04'), false);
});

test('current streak skips unscheduled weekdays across a week boundary', () => {
  const item = habit();
  const completions = [
    record(item.id, '2026-10-09'),
    record(item.id, '2026-10-12'),
  ];
  assert.deepEqual(calculateStreaks(item, completions, '2026-10-12'), {
    current: 2,
    best: 2,
  });
});

test('an incomplete scheduled today remains in progress without breaking yesterday streak', () => {
  const item = habit();
  assert.deepEqual(
    calculateStreaks(item, [record(item.id, '2026-10-09')], '2026-10-12'),
    { current: 1, best: 1 },
  );
});

test('a missed earlier scheduled day breaks current streak', () => {
  const item = habit();
  const completions = [
    record(item.id, '2026-10-05'),
    record(item.id, '2026-10-07'),
    record(item.id, '2026-10-08'),
  ];
  assert.deepEqual(calculateStreaks(item, completions, '2026-10-08'), {
    current: 2,
    best: 2,
  });
});

test('an unscheduled today leaves the most recent scheduled-day streak intact', () => {
  const item = habit();
  assert.deepEqual(
    calculateStreaks(item, [record(item.id, '2026-10-09')], '2026-10-10'),
    { current: 1, best: 1 },
  );
});

test('streaks ignore future and duplicate completion records', () => {
  const item = habit({ weekdays: [1], createdAt: '2026-10-05' });
  const completions = [
    record(item.id, '2026-10-05'),
    record(item.id, '2026-10-05'),
    record(item.id, '2026-10-12'),
    record(item.id, '2026-10-19'),
  ];
  assert.deepEqual(calculateStreaks(item, completions, '2026-10-12'), {
    current: 2,
    best: 2,
  });
});

test('streaks start on recently-created habits and skip dates before creation', () => {
  const item = habit({ createdAt: '2026-10-12', weekdays: [1] });
  assert.equal(isScheduledOn(item, '2026-10-05'), false);
  assert.deepEqual(
    calculateStreaks(item, [record(item.id, '2026-10-12')], '2026-10-12'),
    { current: 1, best: 1 },
  );
  assert.deepEqual(calculateStreaks(item, [], '2026-10-12'), { current: 0, best: 0 });
});

test('archived habits keep historical best streak and have no current streak', () => {
  const item = habit({ active: false, archivedAt: '2026-10-08' });
  const completions = [
    record(item.id, '2026-10-05'),
    record(item.id, '2026-10-06'),
    record(item.id, '2026-10-07'),
    record(item.id, '2026-10-08'),
  ];
  assert.deepEqual(calculateStreaks(item, completions, '2026-10-12'), {
    current: 0,
    best: 4,
  });
  assert.equal(isScheduledOn(item, '2026-10-09'), false);
});

test('weekly summary uses scheduled habit-days through today, including year boundaries', () => {
  const item = habit({
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    createdAt: '2024-12-30',
  });
  const completions = [
    record(item.id, '2024-12-30'),
    record(item.id, '2024-12-30'),
    record(item.id, '2025-01-01'),
    record(item.id, '2025-01-04'),
  ];
  const summary = calculateWeekSummary(
    [item],
    completions,
    mondayOfWeek('2025-01-02'),
    '2025-01-02',
  );
  assert.equal(summary.startDate, '2024-12-30');
  assert.equal(summary.endDate, '2025-01-05');
  assert.equal(summary.eligibleCompletions, 4);
  assert.equal(summary.totalCompletions, 2);
  assert.equal(summary.percentage, 50);
  assert.deepEqual(summary.days.map((day) => day.date), [
    '2024-12-30',
    '2024-12-31',
    '2025-01-01',
    '2025-01-02',
    '2025-01-03',
    '2025-01-04',
    '2025-01-05',
  ]);
});

test('weekly summary excludes unscheduled, pre-creation and future days', () => {
  const item = habit({ weekdays: [1, 3], createdAt: '2026-10-07' });
  const summary = calculateWeekSummary(
    [item],
    [record(item.id, '2026-10-07'), record(item.id, '2026-10-14')],
    '2026-10-05',
    '2026-10-08',
  );
  assert.equal(summary.eligibleCompletions, 1);
  assert.equal(summary.totalCompletions, 1);
  assert.equal(summary.percentage, 100);
  assert.equal(summary.days[0].eligible, 0);
  assert.equal(summary.days[2].completions, 1);
  assert.equal(summary.days[6].completions, 0);
});

test('history handles future dates, pre-creation dates and records after schedule edits', () => {
  const item = habit({ weekdays: [1], createdAt: '2026-10-12' });
  assert.deepEqual(historyForDate([item], [], '2026-10-05', '2026-10-12').scheduled, []);
  assert.equal(historyForDate([item], [], '2026-10-13', '2026-10-12').future, true);

  const changedSchedule = habit({ weekdays: [2] });
  const completed = historyForDate(
    [changedSchedule],
    [record(changedSchedule.id, '2026-10-12')],
    '2026-10-12',
    '2026-10-12',
  );
  assert.equal(completed.scheduled.length, 1);
  assert.equal(completed.completedIds.has(changedSchedule.id), true);
});

test('calendar completion counts deduplicate habit/date records', () => {
  const completions = [
    record('one', '2026-10-12'),
    record('one', '2026-10-12'),
    record('two', '2026-10-12'),
  ];
  assert.equal(completionCountsByDate(completions, ['2026-10-12']).get('2026-10-12'), 2);
});
