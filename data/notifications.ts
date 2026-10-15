import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type { Habit } from './models.ts';
import {
  cancelHabitFlowReminders,
  HABITFLOW_NOTIFICATION_MARKER,
  type ReminderNotificationAdapter,
} from './reminders.ts';

export const localRemindersSupported =
  (Platform.OS === 'android' || Platform.OS === 'ios') &&
  !(Platform.OS === 'android' && isRunningInExpoGo());
export const runningInExpoGo = isRunningInExpoGo();

export const localRemindersUnavailableMessage =
  Platform.OS === 'web'
    ? 'Reminders require the Android or iOS app; they are not available in the web preview.'
    : Platform.OS === 'android' && isRunningInExpoGo()
      ? 'Android reminders need a HabitFlow development build. Expo Go cannot load the Android notifications module.'
      : 'Local reminders are unavailable on this platform.';

let notificationsModule:
  | Promise<typeof import('expo-notifications')>
  | undefined;

async function getNotifications() {
  if (!localRemindersSupported) {
    throw new Error(localRemindersUnavailableMessage);
  }
  notificationsModule ??= import('expo-notifications').then((notifications) => {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return notifications;
  });
  return notificationsModule;
}

function reminderAdapter(): ReminderNotificationAdapter {
  return {
    async getPermission() {
      const Notifications = await getNotifications();
      const permissions = await Notifications.getPermissionsAsync();
      return permissions.granted;
    },
    async getScheduled() {
      const Notifications = await getNotifications();
      const requests = await Notifications.getAllScheduledNotificationsAsync();
      return requests.map((request) => ({
        identifier: request.identifier,
        content: { data: request.content.data },
      }));
    },
    async cancel(identifier) {
      const Notifications = await getNotifications();
      await Notifications.cancelScheduledNotificationAsync(identifier);
    },
    async schedule(habit: Habit, weekday: number, fingerprint: string) {
      const Notifications = await getNotifications();
      if (!habit.reminderTime) {
        throw new Error(`Habit "${habit.name}" is missing a reminder time.`);
      }
      const [hour, minute] = habit.reminderTime.split(':').map(Number);
      return Notifications.scheduleNotificationAsync({
        content: {
          title: 'A gentle reminder',
          body: habit.name,
          data: {
            [HABITFLOW_NOTIFICATION_MARKER]: true,
            habitId: habit.id,
            weekday,
            fingerprint,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: weekday + 1,
          hour,
          minute,
          ...(Platform.OS === 'android' ? { channelId: 'habit-reminders' } : {}),
        },
      });
    },
  };
}

export async function requestReminderPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  return requested.granted;
}

export async function configureReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = await getNotifications();
  await Notifications.setNotificationChannelAsync('habit-reminders', {
    name: 'Habit reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}

export const habitReminderAdapter = reminderAdapter();
export const cancelManagedHabitReminders = () =>
  cancelHabitFlowReminders(habitReminderAdapter);
