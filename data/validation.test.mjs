import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHabitForm } from './validation.ts';

test('habit form accepts a trimmed non-empty name and unique weekdays', () => {
  assert.deepEqual(validateHabitForm('  Read  ', [1, 3, 5]), {});
});

test('habit form rejects empty and whitespace-only names', () => {
  assert.equal(validateHabitForm('', [1]).name, 'Enter a name for this habit.');
  assert.equal(validateHabitForm(' \t ', [1]).name, 'Enter a name for this habit.');
});

test('habit form rejects no weekdays, duplicates, and out-of-range weekday values', () => {
  const expected = 'Choose at least one valid day of the week.';
  assert.equal(validateHabitForm('Walk', []).weekdays, expected);
  assert.equal(validateHabitForm('Walk', [1, 1]).weekdays, expected);
  assert.equal(validateHabitForm('Walk', [-1]).weekdays, expected);
  assert.equal(validateHabitForm('Walk', [7]).weekdays, expected);
});
