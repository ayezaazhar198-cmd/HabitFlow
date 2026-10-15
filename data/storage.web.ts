import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createHabitStorage,
  type KeyValueStorage,
} from './persistence';

const adapter: KeyValueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const habitStorage = createHabitStorage(adapter);

export const loadHabitData = habitStorage.load;
export const saveHabitData = habitStorage.save;
export const clearHabitData = habitStorage.clear;
export { createHabitRecord } from './persistence';
export {
  HabitStorageError,
  UnsupportedHabitDataVersionError,
} from './persistence';
