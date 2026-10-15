import { router } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenContainer,
  SectionHeader,
} from '../../components/design-system';
import { useHabitStore } from '../../data/habit-store';
import type { Habit, ThemePreference } from '../../data/models';
import {
  localRemindersSupported,
  localRemindersUnavailableMessage,
  runningInExpoGo,
} from '../../data/notifications';
import { FREE_ACTIVE_HABIT_LIMIT, FreeHabitLimitError } from '../../data/premium';
import { radii, spacing, typography, useTheme } from '../../theme';

type PendingAction = { type: 'archive' | 'delete'; habit: Habit } | { type: 'reset' } | null;

export default function SettingsScreen() {
  const { theme, mode } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const {
    habits,
    lifetimeAccess,
    data,
    status,
    error,
    retryLoad,
    archiveHabit,
    restoreHabit,
    deleteHabit,
    clearError,
    setThemePreference,
    setRemindersEnabled,
    resetAllData,
  } = useHabitStore();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [manageExpanded, setManageExpanded] = useState(true);
  const showReminderDeveloperNotice =
    !localRemindersSupported && (__DEV__ || runningInExpoGo);
  const activeHabits = habits.filter((habit) => habit.active);
  const archivedHabits = habits.filter((habit) => !habit.active);

  async function confirmAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    clearError();
    try {
      if (action.type === 'reset') await resetAllData();
      else if (action.type === 'archive') await archiveHabit(action.habit.id);
      else await deleteHabit(action.habit.id);
    } catch {
      // The storage provider exposes the failure on this screen.
    }
  }

  async function restore(habitId: string) {
    if (!lifetimeAccess && activeHabits.length >= FREE_ACTIVE_HABIT_LIMIT) {
      router.push('/premium');
      return;
    }
    clearError();
    try {
      await restoreHabit(habitId);
    } catch (restoreError) {
      if (restoreError instanceof FreeHabitLimitError) {
        router.push('/premium');
        return;
      }
      // The storage provider exposes the failure in the settings error banner.
    }
  }

  return (
    <ScreenContainer
      contentContainerStyle={{ paddingTop: 0, paddingBottom: tabBarHeight + spacing.lg }}
      contentStyle={styles.content}
    >
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>MAKE IT YOURS</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          A few thoughtful touches for your routine.
        </Text>
      </View>

      {error ? (
        <View
          accessibilityRole="alert"
          style={[styles.errorBanner, { backgroundColor: theme.colors.surfaceMuted }]}
        >
          <Lucide name="triangle-alert" size={17} color={theme.colors.danger} />
          <Text style={[styles.note, { color: theme.colors.text }]}>{error}</Text>
          {status === 'error' ? (
            <Pressable accessibilityRole="button" onPress={() => void retryLoad()}>
              <Text style={[styles.actionText, { color: theme.colors.accent }]}>Retry</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              onPress={clearError}
              style={styles.dismissButton}
            >
              <Lucide name="x" size={17} color={theme.colors.textSecondary} />
            </Pressable>
          )}
        </View>
      ) : null}

      {habits.length > 0 && !lifetimeAccess ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore Lifetime Premium"
          onPress={() => router.push('/premium')}
          style={({ pressed }) => [
            styles.planCard,
            { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <View style={styles.planSummary}>
            <View style={styles.planCopy}>
              <Text style={[styles.planEyebrow, { color: theme.colors.textSecondary }]}>YOUR PLAN</Text>
              <Text style={[styles.planTitle, { color: theme.colors.text }]}>Free</Text>
            </View>
            <Text style={[styles.planCount, { color: theme.colors.text }]}>
              {activeHabits.length} of {FREE_ACTIVE_HABIT_LIMIT} habits
            </Text>
          </View>
          <View style={[styles.planAction, { backgroundColor: theme.colors.accent }]}>
            <Text style={[styles.planActionText, { color: theme.colors.accentOn }]}>
              Unlock unlimited · one-time purchase
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View style={[styles.group, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.preference}>
          <View style={[styles.preferenceIcon, { backgroundColor: theme.colors.accentSoft }]}>
            <Lucide
              name={mode === 'dark' ? 'moon' : 'sun'}
              size={19}
              color={theme.colors.accentStrong}
            />
          </View>
          <View style={styles.preferenceCopy}>
            <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Appearance</Text>
            <Text style={[styles.preferenceDetail, { color: theme.colors.textSecondary }]}>
              {mode === 'dark' ? 'Dark mode' : 'Light mode'}
            </Text>
          </View>
        </View>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Appearance preference"
          style={[styles.themeChoices, { backgroundColor: theme.colors.surfaceMuted }]}
        >
          {(['light', 'dark'] as const).map((preference: ThemePreference) => {
            const selected = data.settings.theme === preference;
            const label = preference === 'light' ? 'Light' : 'Dark';
            return (
              <Pressable
                key={preference}
                accessibilityRole="radio"
                accessibilityLabel={`${label} appearance`}
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  clearError();
                  void setThemePreference(preference).catch(() => undefined);
                }}
                style={[
                  styles.themeChoice,
                  selected ? { backgroundColor: theme.colors.accent } : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.themeChoiceLabel,
                    { color: selected ? theme.colors.accentOn : theme.colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.group, styles.accountGroup, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.preference}>
          <View style={[styles.preferenceIcon, { backgroundColor: theme.colors.secondarySoft }]}>
            <Lucide name="bell" size={19} color={theme.colors.secondary} />
          </View>
          <View style={styles.preferenceCopy}>
            <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Habit reminders</Text>
            <Text
              style={[styles.preferenceDetail, { color: theme.colors.textSecondary }]}
            >
              {showReminderDeveloperNotice
                ? localRemindersUnavailableMessage
                : data.settings.remindersEnabled
                  ? 'Reminders are on for habits with a time set.'
                  : 'Get a gentle nudge at your chosen time.'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Habit reminders"
            accessibilityHint="Controls all scheduled habit reminders"
            value={data.settings.remindersEnabled}
            disabled={!localRemindersSupported}
            onValueChange={(enabled) => {
              clearError();
              void setRemindersEnabled(enabled).catch(() => undefined);
            }}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.accent,
            }}
            thumbColor={theme.colors.surface}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: manageExpanded }}
          onPress={() => setManageExpanded((expanded) => !expanded)}
          style={({ pressed }) => [styles.preference, { opacity: pressed ? 0.75 : 1 }]}
        >
          <View style={[styles.preferenceIcon, { backgroundColor: theme.colors.accentSoft }]}>
            <Lucide name="leaf" size={19} color={theme.colors.accentStrong} />
          </View>
          <View style={styles.preferenceCopy}>
            <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Manage habits</Text>
            <Text style={[styles.preferenceDetail, { color: theme.colors.textSecondary }]}>
              Edit, pause or delete
            </Text>
          </View>
          <Text style={[styles.preferenceCount, { color: theme.colors.textSecondary }]}>
            {habits.length}
          </Text>
          <Lucide
            name={manageExpanded ? 'chevron-down' : 'chevron-right'}
            size={18}
            color={theme.colors.textTertiary}
          />
        </Pressable>
      </View>

      {manageExpanded ? (
      <View style={styles.section}>
        {status === 'loading' ? (
          <LoadingState label="Loading your habits" />
        ) : status === 'error' ? (
          <ErrorState
            title="Your habits aren’t available"
            description={error ?? 'Saved data could not be loaded.'}
            onRetry={() => void retryLoad()}
          />
        ) : habits.length === 0 ? (
          <EmptyState
            title="No habits to manage yet"
            description="Add a habit from Today to manage it here."
            icon="leaf"
          />
        ) : (
          <View style={styles.habitGroups}>
            {activeHabits.length > 0 ? (
              <View style={styles.habitGroup}>
                <Text style={[styles.groupLabel, { color: theme.colors.textSecondary }]}>ACTIVE</Text>
                {activeHabits.map((habit) => (
                  <HabitManagementRow
                    key={habit.id}
                    habit={habit}
                    archived={false}
                    onEdit={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
                    onArchive={() => setPendingAction({ type: 'archive', habit })}
                    onRestore={() => void restore(habit.id)}
                    onDelete={() => setPendingAction({ type: 'delete', habit })}
                  />
                ))}
              </View>
            ) : null}
            {archivedHabits.length > 0 ? (
              <View style={styles.habitGroup}>
                <Text style={[styles.groupLabel, { color: theme.colors.textSecondary }]}>ARCHIVED</Text>
                {archivedHabits.map((habit) => (
                  <HabitManagementRow
                    key={habit.id}
                    habit={habit}
                    archived
                    onEdit={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
                    onArchive={() => setPendingAction({ type: 'archive', habit })}
                    onRestore={() => void restore(habit.id)}
                    onDelete={() => setPendingAction({ type: 'delete', habit })}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>
      ) : null}

      <View style={[styles.section, styles.dataCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <SectionHeader title="Your data" detail="Stored only on this device" />
        <Text style={[styles.note, { color: theme.colors.textSecondary }]}>
          Resetting removes all habits, completion history, preferences, and scheduled HabitFlow reminders.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset all HabitFlow data"
          onPress={() => setPendingAction({ type: 'reset' })}
          style={[styles.resetButton, { borderColor: theme.colors.danger }]}
        >
          <Lucide name="trash-2" size={17} color={theme.colors.danger} />
          <Text style={[styles.resetText, { color: theme.colors.danger }]}>Reset all data</Text>
        </Pressable>
      </View>

      <ConfirmationDialog
        visible={pendingAction?.type === 'archive'}
        title="Archive this habit?"
        description="It will leave your daily list. Past completions stay in your history, and reminders will no longer be active."
        confirmLabel="Archive habit"
        onConfirm={() => void confirmAction()}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmationDialog
        visible={pendingAction?.type === 'reset'}
        title="Reset all HabitFlow data?"
        description="This permanently removes every habit, completion record, theme preference, and HabitFlow reminder from this device. This cannot be undone."
        confirmLabel="Reset all data"
        destructive
        onConfirm={() => void confirmAction()}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmationDialog
        visible={pendingAction?.type === 'delete'}
        title="Delete this habit permanently?"
        description="This permanently removes the habit and all of its completion history from this device. This cannot be undone."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={() => void confirmAction()}
        onCancel={() => setPendingAction(null)}
      />
    </ScreenContainer>
  );
}

type HabitManagementRowProps = {
  habit: Habit;
  archived: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

function HabitManagementRow({
  habit,
  archived,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: HabitManagementRowProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.habitRow,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.habitIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Lucide name={habit.icon} size={19} color={habit.color} />
      </View>
      <View style={styles.habitCopy}>
        <Text style={[styles.habitName, { color: theme.colors.text }]} numberOfLines={2}>
          {habit.name}
        </Text>
        <Text style={[styles.habitStatus, { color: theme.colors.textSecondary }]}>
          {archived ? 'Archived · history kept' : 'Active'}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${habit.name}`}
          onPress={onEdit}
          style={styles.iconAction}
        >
          <Lucide name="pencil" size={17} color={theme.colors.textSecondary} />
        </Pressable>
        {archived ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Restore ${habit.name}`}
            onPress={onRestore}
            style={styles.iconAction}
          >
            <Lucide name="archive-restore" size={17} color={theme.colors.accent} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Archive ${habit.name}`}
            onPress={onArchive}
            style={styles.iconAction}
          >
            <Lucide name="archive" size={17} color={theme.colors.textSecondary} />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${habit.name}`}
          onPress={onDelete}
          style={styles.iconAction}
        >
          <Lucide name="trash-2" size={17} color={theme.colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.md },
  heading: { gap: spacing.xs },
  eyebrow: { fontSize: typography.caption, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: typography.display, fontWeight: '700', letterSpacing: -1 },
  subtitle: { fontSize: typography.body, lineHeight: 24 },
  group: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 1,
  },
  planCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  planSummary: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  planCopy: { gap: 2 },
  planEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  planTitle: { fontSize: 19, lineHeight: 23, fontWeight: '800' },
  planCount: { fontSize: typography.footnote, fontWeight: '700' },
  planAction: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  planActionText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  accountGroup: { paddingVertical: 0 },
  preference: {
    minHeight: 66,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  preferenceIcon: { width: 44, height: 44, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  preferenceCopy: { flex: 1, minWidth: 0, paddingRight: spacing.xs, gap: spacing.xs },
  preferenceTitle: { fontSize: typography.footnote, fontWeight: '700' },
  preferenceDetail: { fontSize: typography.caption, lineHeight: 16 },
  preferenceCount: { fontSize: typography.footnote, minWidth: 18, textAlign: 'right' },
  themeChoices: {
    minHeight: 44,
    marginBottom: spacing.md,
    padding: spacing.xs,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  themeChoice: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeChoiceLabel: { fontSize: typography.caption, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  note: { fontSize: typography.footnote, lineHeight: 21 },
  errorBanner: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radii.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dismissButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  actionText: { minHeight: 44, paddingHorizontal: spacing.sm, textAlignVertical: 'center', fontSize: typography.footnote, fontWeight: '700' },
  habitGroups: { gap: spacing.xl },
  section: { gap: spacing.md },
  dataCard: { padding: spacing.md, borderWidth: 1, borderRadius: radii.lg },
  resetButton: { minHeight: 48, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  resetText: { fontSize: typography.footnote, fontWeight: '700' },
  habitGroup: { gap: spacing.sm },
  groupLabel: { fontSize: typography.caption, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.xs },
  habitRow: { minHeight: 72, padding: spacing.sm, borderWidth: 1, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  habitIcon: { width: 42, height: 42, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  habitCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  habitName: { fontSize: typography.footnote, fontWeight: '600', flexShrink: 1 },
  habitStatus: { fontSize: typography.caption },
  rowActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  iconAction: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
});
