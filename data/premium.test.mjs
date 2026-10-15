import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFreeHabitLimit, FREE_ACTIVE_HABIT_LIMIT, FreeHabitLimitError } from './premium.ts';

function data(activeCount, archivedCount = 0) {
  return {
    habits: [
      ...Array.from({ length: activeCount }, (_, index) => ({
        id: `active-${index}`,
        active: true,
      })),
      ...Array.from({ length: archivedCount }, (_, index) => ({
        id: `archived-${index}`,
        active: false,
      })),
    ],
  };
}

test('free active habit limit allows up to three and ignores archived habits', () => {
  assert.equal(FREE_ACTIVE_HABIT_LIMIT, 3);
  assert.doesNotThrow(() => assertFreeHabitLimit(data(2, 10), 1));
  assert.throws(() => assertFreeHabitLimit(data(3), 1), FreeHabitLimitError);
  assert.doesNotThrow(() => assertFreeHabitLimit(data(3, 10), 1, true));
});
