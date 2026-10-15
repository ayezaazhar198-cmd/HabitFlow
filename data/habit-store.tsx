import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  archiveHabit as archiveHabitData,
  localDateKey,
  permanentlyDeleteHabit,
  restoreHabit as restoreHabitData,
  toggleCompletion,
  updateHabit as updateHabitData,
} from './domain';
import {
  createHabitRecord,
  clearHabitData,
  loadHabitData,
  saveHabitData,
} from './storage';
import {
  cancelManagedHabitReminders,
  configureReminderChannel,
  habitReminderAdapter,
  localRemindersSupported,
  requestReminderPermission,
} from './notifications';
import { reconcileHabitReminders } from './reminders';
import {
  assertFreeHabitLimit,
  FREE_ACTIVE_HABIT_LIMIT,
  FreeHabitLimitError,
} from './premium';
import {
  hasLifetimeAccess,
  lifetimeBillingConfigured,
  purchaseLifetime as makeLifetimePurchase,
  restoreLifetimePurchase as restoreLifetime,
} from './purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  SUGGESTED_HABITS,
  type Habit,
  type HabitData,
  type HabitInput,
  type LocalDate,
} from './models';

type LoadStatus = 'loading' | 'ready' | 'error';
type HabitStoreState = {
  data: HabitData;
  status: LoadStatus;
  error: string | null;
  lifetimeAccess: boolean;
};

type HabitStoreValue = {
  data: HabitData;
  habits: Habit[];
  completions: HabitData['completions'];
  status: LoadStatus;
  error: string | null;
  lifetimeAccess: boolean;
  refreshLifetimeAccess: () => Promise<boolean>;
  purchaseLifetime: (lifetimePackage: PurchasesPackage) => Promise<boolean>;
  restoreLifetimePurchase: () => Promise<boolean>;
  retryLoad: () => Promise<void>;
  clearError: () => void;
  createHabit: (input: HabitInput) => Promise<void>;
  addSuggestedHabits: () => Promise<void>;
  updateHabit: (habitId: string, input: HabitInput) => Promise<void>;
  archiveHabit: (habitId: string) => Promise<void>;
  restoreHabit: (habitId: string) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  toggleCompleted: (habitId: string, date?: LocalDate) => Promise<void>;
  setRemindersEnabled: (enabled: boolean) => Promise<void>;
  setThemePreference: (theme: HabitData['settings']['theme']) => Promise<void>;
  resetAllData: () => Promise<void>;
};

const HabitStoreContext = createContext<HabitStoreValue | null>(null);
const initialState: HabitStoreState = {
  data: {
    schemaVersion: 2 as const,
    habits: [],
    completions: [],
    settings: { remindersEnabled: false, theme: 'light' as const },
  },
  status: 'loading' as LoadStatus,
  error: null as string | null,
  lifetimeAccess: false,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function HabitStoreProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  const operationQueue = useRef<Promise<void>>(Promise.resolve());

  const loadData = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await loadHabitData();
      let lifetimeAccess = false;
      if (lifetimeBillingConfigured) {
        try {
          lifetimeAccess = await hasLifetimeAccess();
        } catch (purchaseError) {
          console.error('Unable to verify HabitFlow lifetime access.', purchaseError);
        }
      }
      let reconciled = data;
      let reminderError: string | null = null;
      try {
        if (localRemindersSupported) {
          await configureReminderChannel();
          reconciled = await reconcileHabitReminders(data, habitReminderAdapter);
        }
        if (JSON.stringify(reconciled) !== JSON.stringify(data)) {
          await saveHabitData(reconciled);
        }
      } catch (error) {
        reminderError = getErrorMessage(error);
        console.error('Unable to restore HabitFlow reminders.', error);
      }
      const next = {
        data: reconciled,
        status: 'ready' as const,
        error: reminderError,
        lifetimeAccess,
      };
      stateRef.current = next;
      setState(next);
    } catch (error) {
      console.error('Unable to load saved HabitFlow data.', error);
      const next = {
        ...stateRef.current,
        status: 'error' as const,
        error: getErrorMessage(error),
      };
      stateRef.current = next;
      setState(next);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updateLifetimeAccess = useCallback((lifetimeAccess: boolean) => {
    const next = { ...stateRef.current, lifetimeAccess };
    stateRef.current = next;
    setState(next);
    return lifetimeAccess;
  }, []);

  const refreshLifetimeAccess = useCallback(async () => {
    if (!lifetimeBillingConfigured) return updateLifetimeAccess(false);
    const lifetimeAccess = await hasLifetimeAccess();
    return updateLifetimeAccess(lifetimeAccess);
  }, [updateLifetimeAccess]);

  const purchaseLifetime = useCallback(
    async (lifetimePackage: PurchasesPackage) => {
      const lifetimeAccess = await makeLifetimePurchase(lifetimePackage);
      updateLifetimeAccess(lifetimeAccess);
      return lifetimeAccess;
    },
    [updateLifetimeAccess],
  );

  const restoreLifetimePurchase = useCallback(async () => {
    const lifetimeAccess = await restoreLifetime();
    updateLifetimeAccess(lifetimeAccess);
    return lifetimeAccess;
  }, [updateLifetimeAccess]);

  const accessForMutation = useCallback(async () => {
    try {
      return await refreshLifetimeAccess();
    } catch (error) {
      console.error('Unable to refresh lifetime access before changing habits.', error);
      return stateRef.current.lifetimeAccess;
    }
  }, [refreshLifetimeAccess]);

  const performMutation = useCallback(
    (mutate: (data: HabitData) => HabitData) => {
      const task = operationQueue.current.then(async () => {
        if (stateRef.current.status !== 'ready') {
          throw new Error('Saved habit data is unavailable. Retry loading before making changes.');
        }
        const nextData = mutate(stateRef.current.data);
        await saveHabitData(nextData);
        const savedState = {
          ...stateRef.current,
          data: nextData,
          status: 'ready' as const,
          error: null,
        };
        stateRef.current = savedState;
        setState(savedState);
        try {
          const reconciled = localRemindersSupported
            ? await reconcileHabitReminders(nextData, habitReminderAdapter)
            : nextData;
          if (JSON.stringify(reconciled) !== JSON.stringify(nextData)) {
            await saveHabitData(reconciled);
          }
          const nextState = {
            ...stateRef.current,
            data: reconciled,
            status: 'ready' as const,
            error: null,
          };
          stateRef.current = nextState;
          setState(nextState);
        } catch (error) {
          const message = getErrorMessage(error);
          console.error('HabitFlow reminders could not be synchronized.', error);
          const failedReminderState = {
            ...stateRef.current,
            data: nextData,
            status: 'ready' as const,
            error: message,
          };
          stateRef.current = failedReminderState;
          setState(failedReminderState);
        }
      });
      operationQueue.current = task.catch(() => undefined);
      return task.catch((error: unknown) => {
        const message = getErrorMessage(error);
        console.error('HabitFlow change was not saved.', error);
        const current = stateRef.current;
        const nextState = { ...current, error: message };
        stateRef.current = nextState;
        setState(nextState);
        throw error;
      });
    },
    [],
  );

  const createHabit = useCallback(
    async (input: HabitInput) => {
      const lifetimeAccess = await accessForMutation();
      return performMutation((data) => {
        assertFreeHabitLimit(data, 1, lifetimeAccess);
        const record = createHabitRecord(
          input,
          data.habits.map((habit) => habit.id),
        );
        return { ...data, habits: [...data.habits, record] };
      });
    },
    [accessForMutation, performMutation],
  );

  const addSuggestedHabits = useCallback(async () => {
      const lifetimeAccess = await accessForMutation();
      return performMutation((data) => {
        const knownNames = new Set(data.habits.map((habit) => habit.name.toLocaleLowerCase()));
        const additions = SUGGESTED_HABITS.filter(
          (habit) => !knownNames.has(habit.name.toLocaleLowerCase()),
        );
        if (additions.length === 0) {
          throw new Error('You already have all of the suggested habits.');
        }
        const activeHabits = data.habits.filter((habit) => habit.active).length;
        const remainingSlots = lifetimeAccess
          ? additions.length
          : FREE_ACTIVE_HABIT_LIMIT - activeHabits;
        if (remainingSlots <= 0) throw new FreeHabitLimitError();
        const allowedAdditions = additions.slice(0, remainingSlots);
        const ids = data.habits.map((habit) => habit.id);
        const habits = allowedAdditions.map((habit) => {
          const created = createHabitRecord(habit, ids);
          ids.push(created.id);
          return created;
        });
        return { ...data, habits: [...data.habits, ...habits] };
      });
    }, [accessForMutation, performMutation]);

  const updateHabit = useCallback(
    (habitId: string, input: HabitInput) =>
      performMutation((data) => updateHabitData(data, habitId, input)),
    [performMutation],
  );

  const archiveHabit = useCallback(
    (habitId: string) =>
      performMutation((data) =>
        archiveHabitData(data, habitId, localDateKey(new Date())),
      ),
    [performMutation],
  );

  const restoreHabit = useCallback(
    async (habitId: string) => {
      const lifetimeAccess = await accessForMutation();
      return performMutation((data) => {
        const habit = data.habits.find((item) => item.id === habitId);
        if (habit && !habit.active) assertFreeHabitLimit(data, 1, lifetimeAccess);
        return restoreHabitData(data, habitId);
      });
    },
    [accessForMutation, performMutation],
  );

  const deleteHabit = useCallback(
    (habitId: string) =>
      performMutation((data) => permanentlyDeleteHabit(data, habitId)),
    [performMutation],
  );

  const toggleCompleted = useCallback(
    (habitId: string, date = localDateKey(new Date())) =>
      performMutation((data) => toggleCompletion(data, habitId, date, localDateKey(new Date()))),
    [performMutation],
  );

  const setRemindersEnabled = useCallback(
    async (enabled: boolean) => {
      try {
        if (enabled) {
          if (!localRemindersSupported) {
            throw new Error('Local reminders are not supported on this platform.');
          }
          await configureReminderChannel();
          if (!(await requestReminderPermission())) {
            throw new Error(
              'Notifications are off. You can allow them in your device settings whenever you’re ready.',
            );
          }
        }
        await performMutation((data) => ({
          ...data,
          settings: { ...data.settings, remindersEnabled: enabled },
        }));
        if (stateRef.current.error) {
          throw new Error(stateRef.current.error);
        }
      } catch (error) {
        if (stateRef.current.error !== getErrorMessage(error)) {
          const failedState = { ...stateRef.current, error: getErrorMessage(error) };
          stateRef.current = failedState;
          setState(failedState);
        }
        throw error;
      }
    },
    [performMutation],
  );

  const setThemePreference = useCallback(
    (theme: HabitData['settings']['theme']) =>
      performMutation((data) => ({
        ...data,
        settings: { ...data.settings, theme },
      })),
    [performMutation],
  );

  const resetAllData = useCallback(async () => {
    const task = operationQueue.current.then(async () => {
      if (stateRef.current.status !== 'ready') {
        throw new Error('Saved habit data is unavailable. Retry loading before resetting.');
      }
      if (localRemindersSupported) await cancelManagedHabitReminders();
      try {
        await clearHabitData();
      } catch (error) {
        const originalData = stateRef.current.data;
        const restored = localRemindersSupported
          ? await reconcileHabitReminders(originalData, habitReminderAdapter)
          : originalData;
        if (JSON.stringify(restored) !== JSON.stringify(originalData)) {
          try {
            await saveHabitData(restored);
          } catch (restoreError) {
            console.error(
              'Could not persist restored reminder identifiers after reset failure.',
              restoreError,
            );
          }
        }
        throw error;
      }
      const next = {
        ...stateRef.current,
        data: initialState.data,
        status: 'ready' as const,
        error: null,
      };
      stateRef.current = next;
      setState(next);
    });
    operationQueue.current = task.catch(() => undefined);
    return task.catch((error: unknown) => {
      const message = getErrorMessage(error);
      console.error('Unable to reset HabitFlow data.', error);
      const next = { ...stateRef.current, error: message };
      stateRef.current = next;
      setState(next);
      throw error;
    });
  }, []);

  const value = useMemo<HabitStoreValue>(
    () => ({
      data: state.data,
      habits: state.data.habits,
      completions: state.data.completions,
      status: state.status,
      error: state.error,
      lifetimeAccess: state.lifetimeAccess,
      refreshLifetimeAccess,
      purchaseLifetime,
      restoreLifetimePurchase,
      retryLoad: loadData,
      clearError: () => {
        const current = stateRef.current;
        const nextState = { ...current, error: null };
        stateRef.current = nextState;
        setState(nextState);
      },
      createHabit,
      addSuggestedHabits,
      updateHabit,
      archiveHabit,
      restoreHabit,
      deleteHabit,
      toggleCompleted,
      setRemindersEnabled,
      setThemePreference,
      resetAllData,
    }),
    [
      state,
      loadData,
      refreshLifetimeAccess,
      purchaseLifetime,
      restoreLifetimePurchase,
      createHabit,
      addSuggestedHabits,
      updateHabit,
      archiveHabit,
      restoreHabit,
      deleteHabit,
      toggleCompleted,
      setRemindersEnabled,
      setThemePreference,
      resetAllData,
    ],
  );

  return <HabitStoreContext.Provider value={value}>{children}</HabitStoreContext.Provider>;
}

export function useHabitStore() {
  const context = useContext(HabitStoreContext);
  if (!context) {
    throw new Error('useHabitStore must be used inside HabitStoreProvider.');
  }
  return context;
}
