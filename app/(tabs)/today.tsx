import { router } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Lucide from '@react-native-vector-icons/lucide';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ErrorState,
  HabitCard,
  LoadingState,
  PrimaryButton,
  ProgressRing,
  ScreenContainer,
} from '../../components/design-system';
import { useHabitStore } from '../../data/habit-store';
import { calculateStreaks, localDateKey, isScheduledOn } from '../../data/domain';
import { FREE_ACTIVE_HABIT_LIMIT } from '../../data/premium';
import { getLifetimePackage } from '../../data/purchases';
import { spacing, radii, typography, useTheme } from '../../theme';

function formatReminderTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  const time = new Date();
  time.setHours(hour, minute, 0, 0);
  return time.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function TodayScreen() {
  const { theme, mode } = useTheme();
  const [localizedLifetimePrice, setLocalizedLifetimePrice] = useState<string | null>(null);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const {
    habits,
    completions,
    data,
    lifetimeAccess,
    status,
    error,
    retryLoad,
    toggleCompleted,
    clearError,
  } = useHabitStore();
  const today = localDateKey(new Date());
  const scheduledHabits = habits.filter(
    (habit) => habit.active && isScheduledOn(habit, today),
  );
  const doneCount = scheduledHabits.filter((habit) =>
    completions.some((record) => record.habitId === habit.id && record.date === today),
  ).length;
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const activeHabitCount = habits.filter((habit) => habit.active).length;
  const habitsLeft = Math.max(0, scheduledHabits.length - doneCount);
  const showPremiumCard = !lifetimeAccess && activeHabitCount >= FREE_ACTIVE_HABIT_LIMIT;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    if (!showPremiumCard) return;

    let mounted = true;
    void getLifetimePackage()
      .then((lifetimePackage) => {
        if (mounted) setLocalizedLifetimePrice(lifetimePackage.product.priceString);
      })
      .catch(() => {
        if (mounted) setLocalizedLifetimePrice(null);
      });
    return () => {
      mounted = false;
    };
  }, [showPremiumCard]);

  function startAddingHabit() {
    if (
      !lifetimeAccess &&
      habits.filter((habit) => habit.active).length >= FREE_ACTIVE_HABIT_LIMIT
    ) {
      router.push('/premium');
      return;
    }
    router.push('/habit/new');
  }

  const premiumCard = showPremiumCard ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Explore Premium, ${activeHabitCount} of ${FREE_ACTIVE_HABIT_LIMIT} free habits used`}
      onPress={() => router.push('/premium')}
      style={({ pressed }) => [
        styles.premiumCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <View style={[styles.premiumIcon, { backgroundColor: theme.colors.accentSoft }]}>
        <Lucide name="lock-keyhole" size={15} color={theme.colors.accentStrong} />
      </View>
      <View style={styles.premiumCopy}>
        <Text style={[styles.premiumTitle, { color: theme.colors.text }]}>
          {activeHabitCount} of {FREE_ACTIVE_HABIT_LIMIT} free habits used
        </Text>
        <Text style={[styles.premiumDetail, { color: theme.colors.textSecondary }]}>
          {localizedLifetimePrice
            ? `Go unlimited · ${localizedLifetimePrice} once`
            : 'Go unlimited · one-time purchase'}
        </Text>
      </View>
      <Lucide name="chevron-right" size={18} color={theme.colors.accentStrong} />
    </Pressable>
  ) : null;

  return (
    <ScreenContainer
      backgroundColor={theme.colors.background}
      contentContainerStyle={[
        { paddingTop: 0 },
        { paddingHorizontal: spacing.lg },
        { paddingBottom: tabBarHeight + insets.bottom },
      ]}
      contentStyle={styles.content}
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={[styles.brandMark, { backgroundColor: theme.colors.accent }]}>
            <Lucide name="leaf" size={16} color={theme.colors.accentOn} />
          </View>
          <View style={styles.brandCopy}>
            <Text style={[styles.brandName, { color: theme.colors.text }]}>HabitFlow</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            data.settings.remindersEnabled
              ? 'Reminder settings, reminders enabled'
              : 'Reminder settings'
          }
          onPress={() => router.navigate('/settings')}
          style={({ pressed }) => [
            styles.headerAction,
            { backgroundColor: theme.colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Lucide
            name="bell"
            size={19}
            color={data.settings.remindersEnabled ? theme.colors.accent : theme.colors.textSecondary}
          />
          {data.settings.remindersEnabled ? (
            <View
              style={[
                styles.notificationDot,
                {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.surface,
                },
              ]}
            />
          ) : null}
        </Pressable>
      </View>

      <View
        style={[
          styles.greetingCard,
          { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
        ]}
      >
        <ProgressRing
          value={doneCount}
          max={scheduledHabits.length}
          size={76}
          showCaption={false}
          accentColor={theme.colors.accent}
          trackColor={theme.colors.border}
          valueColor={theme.colors.text}
        />
        <View style={styles.greetingCopy}>
          <Text style={[styles.greetingTitle, { color: theme.colors.text }]}>{greeting}</Text>
          <Text style={[styles.greetingSubtitle, { color: theme.colors.textSecondary }]}>
            {doneCount === 0
              ? 'A fresh start. One small step today.'
              : habitsLeft === 0
                ? 'All done today. Nice work.'
                : `${habitsLeft} ${habitsLeft === 1 ? 'habit' : 'habits'} left today. You're nearly there.`}
          </Text>
        </View>
      </View>

      <View style={styles.habitsSection}>
        <View style={styles.todayHeading}>
          <Text style={[styles.todayTitle, { color: theme.colors.text }]}>Today&apos;s habits</Text>
          <View style={styles.dateLabel}>
            <Text style={[styles.date, { color: theme.colors.textSecondary }]}>{dateLabel}</Text>
          </View>
        </View>

      {error ? (
        <View
          accessibilityRole="alert"
          style={[styles.errorBanner, { backgroundColor: theme.colors.surfaceMuted }]}
        >
          <Lucide name="triangle-alert" size={17} color={theme.colors.danger} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
          {status === 'error' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void retryLoad()}
              style={styles.retryButton}
            >
              <Text style={[styles.retryLabel, { color: theme.colors.accent }]}>Retry</Text>
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

        {status === 'loading' ? (
          <LoadingState />
        ) : status === 'error' ? (
          <ErrorState
            title="Your habits aren’t available"
            description="Saved data could not be loaded. Retry to view your habits."
            onRetry={() => void retryLoad()}
          />
        ) : scheduledHabits.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: theme.colors.accentSoft }]}>
                <Lucide name="sprout" size={25} color={theme.colors.accentStrong} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  {habits.some((habit) => habit.active) ? 'Nothing scheduled today' : 'A fresh start'}
                </Text>
                <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
                  {habits.some((habit) => habit.active)
                    ? 'Enjoy a little breathing room, or add a habit for today.'
                    : 'Add a small habit to make today feel a little more intentional.'}
                </Text>
              </View>
            </View>
            {premiumCard}
            <PrimaryButton
              label="Add a habit"
              icon="plus"
              onPress={startAddingHabit}
              labelColor={theme.colors.accentOn}
              style={{ ...styles.firstHabitButton, backgroundColor: theme.colors.accent }}
            />
          </View>
        ) : (
          <>
            <View style={styles.habitList}>
              {scheduledHabits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  title={habit.name}
                  icon={habit.icon}
                  accentColor={habit.color}
                  compactToday
                  reminderTime={habit.reminderTime ? formatReminderTime(habit.reminderTime) : undefined}
                  completed={completions.some(
                    (record) => record.habitId === habit.id && record.date === today,
                  )}
                  streak={calculateStreaks(habit, completions, today).current}
                  onToggle={() => {
                    clearError();
                    if (!completions.some(
                      (record) => record.habitId === habit.id && record.date === today,
                    )) {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((hapticError: unknown) => {
                        console.error('Habit completion haptic feedback failed.', hapticError);
                      });
                    }
                    void toggleCompleted(habit.id, today).catch(() => undefined);
                  }}
                />
              ))}
            </View>
            {premiumCard}
            <PrimaryButton
              label="Add a habit"
              icon="plus"
              onPress={startAddingHabit}
              labelColor={theme.colors.accentOn}
              style={{ ...styles.firstHabitButton, ...styles.freeAddButton, backgroundColor: theme.colors.accent }}
            />
          </>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Suggested Habits"
        accessibilityHint="Browse habit ideas and add them to your list"
        onPress={() => router.push('/suggested-habits')}
        style={({ pressed }) => [
          styles.suggestedHabitsLink,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <View style={[styles.suggestedHabitsIcon, { backgroundColor: theme.colors.accentSoft }]}>
          <Lucide name="sparkles" size={18} color={theme.colors.accentStrong} />
        </View>
        <View style={styles.suggestedHabitsCopy}>
          <Text style={[styles.suggestedHabitsTitle, { color: theme.colors.text }]}>
            Suggested Habits
          </Text>
          <Text style={[styles.suggestedHabitsDescription, { color: theme.colors.textSecondary }]}>
            Find a small step to start today
          </Text>
        </View>
        <Lucide name="chevron-right" size={19} color={theme.colors.accentStrong} />
      </Pressable>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  header: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandCopy: { gap: 1 },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  brandTagline: { fontSize: 11, fontWeight: '500' },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    top: 7,
    right: 7,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  greetingCard: {
    minHeight: 124,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  greetingCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  greetingTitle: { fontSize: 20, lineHeight: 24, fontWeight: '800', letterSpacing: -0.3 },
  greetingSubtitle: { maxWidth: 240, flexShrink: 1, fontSize: 12, lineHeight: 17 },
  habitsSection: { gap: spacing.sm },
  suggestedHabitsLink: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  suggestedHabitsIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestedHabitsCopy: { flex: 1, minWidth: 0, gap: 3 },
  suggestedHabitsTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  suggestedHabitsDescription: { fontSize: 11, lineHeight: 15 },
  todayHeading: {
    minHeight: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  todayTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  dateLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  date: { fontSize: 10, fontWeight: '600' },
  emptyWrap: { gap: spacing.md },
  emptyCard: {
    minHeight: 108,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: { flex: 1, minWidth: 0, gap: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyDescription: { fontSize: 14, lineHeight: 20 },
  firstHabitButton: {
    alignSelf: 'stretch',
    minHeight: 46,
    borderRadius: radii.pill,
  },
  freeAddButton: { marginTop: 6 },
  premiumCard: {
    minHeight: 54,
    marginTop: 20,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  premiumIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCopy: { flex: 1, minWidth: 0, gap: 2 },
  premiumTitle: { fontSize: 11, fontWeight: '800' },
  premiumDetail: { fontSize: 10, lineHeight: 14 },
  errorBanner: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: { flex: 1, fontSize: typography.footnote, lineHeight: 20 },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  retryLabel: { fontSize: typography.footnote, fontWeight: '700' },
  dismissButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  habitList: { gap: spacing.sm },
});
