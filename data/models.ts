import type { LucideIconName } from '@react-native-vector-icons/lucide';

export type LocalDate = `${number}-${number}-${number}`;

export type Habit = {
  id: string;
  name: string;
  icon: LucideIconName;
  color: string;
  weekdays: number[];
  createdAt: LocalDate;
  targetDescription?: string;
  reminderTime?: string;
  reminderNotificationIds?: string[];
  active: boolean;
  archivedAt?: LocalDate;
};

export type HabitInput = Pick<
  Habit,
  'name' | 'icon' | 'color' | 'weekdays' | 'targetDescription' | 'reminderTime'
>;

export type CompletionRecord = {
  id: string;
  habitId: string;
  date: LocalDate;
};

export type ThemePreference = 'light' | 'dark';

export type HabitData = {
  schemaVersion: 2;
  habits: Habit[];
  completions: CompletionRecord[];
  settings: {
    remindersEnabled: boolean;
    theme: ThemePreference;
  };
};

export const EMPTY_HABIT_DATA: HabitData = {
  schemaVersion: 2,
  habits: [],
  completions: [],
  settings: { remindersEnabled: false, theme: 'light' },
};

export const SUGGESTED_HABITS: ReadonlyArray<HabitInput> = [
  {
    name: 'Drink a glass of water',
    icon: 'droplets',
    color: '#27866A',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    targetDescription: 'One glass to start your day',
  },
  {
    name: 'Read for 10 minutes',
    icon: 'book-open',
    color: '#5970A5',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    targetDescription: 'A little room to learn',
  },
  {
    name: 'Take a mindful walk',
    icon: 'footprints',
    color: '#BA8050',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    targetDescription: 'Step outside and reset',
  },
  {
    name: 'Stretch for five minutes',
    icon: 'heart',
    color: '#B76672',
    weekdays: [1, 2, 3, 4, 5],
    targetDescription: 'A little movement goes a long way',
  },
  {
    name: 'Write a few thoughts',
    icon: 'brain',
    color: '#9870A7',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    targetDescription: 'A quiet moment for yourself',
  },
];
