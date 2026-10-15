import type { LucideIconName } from '@react-native-vector-icons/lucide';

const allowedHabitIcons = [
  'leaf',
  'droplets',
  'book-open',
  'footprints',
  'brain',
  'heart',
  'sun',
  'moon',
] as const satisfies readonly LucideIconName[];
const iconNames = new Set<string>(allowedHabitIcons);

export function isLucideIconName(value: unknown): value is LucideIconName {
  return typeof value === 'string' && iconNames.has(value);
}
