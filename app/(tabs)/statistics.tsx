import { router } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenContainer,
  SectionHeader,
} from '../../components/design-system';
import { useHabitStore } from '../../data/habit-store';
import {
  addLocalDays,
  calculateStreaks,
  calculateWeekSummary,
  isScheduledOn,
  localDateKey,
  mondayOfWeek,
  parseLocalDate,
} from '../../data/domain';
import type { LocalDate } from '../../data/models';
import { radii, spacing, typography, useTheme } from '../../theme';

function displayRange(start: LocalDate, end: LocalDate) {
  const first = parseLocalDate(start);
  const last = parseLocalDate(end);
  const firstLabel = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (first.getFullYear() !== last.getFullYear()) {
    return `${firstLabel} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${firstLabel} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  return `${firstLabel} – ${last.getDate()}`;
}

export default function StatisticsScreen() {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { habits, completions, status, error, retryLoad } = useHabitStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const today = localDateKey(new Date());
  const currentWeekStart = mondayOfWeek(today);
  const weekStart = addLocalDays(currentWeekStart, weekOffset * 7);
  const summary = calculateWeekSummary(habits, completions, weekStart, today);
  const weeklyHabits = habits;
  const bestStreak = weeklyHabits.reduce(
    (best, habit) => Math.max(best, calculateStreaks(habit, completions, today).best),
    0,
  );

  return (
    <ScreenContainer
      fillContent={status === 'ready' && habits.length === 0}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + insets.bottom },
      ]}
    >
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>YOUR JOURNEY</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>Statistics</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Notice the small wins adding up.
        </Text>
      </View>

      {status === 'loading' ? (
        <LoadingState />
      ) : status === 'error' ? (
        <ErrorState
          title="Your statistics aren’t available"
          description={error ?? 'Saved data could not be loaded.'}
          onRetry={() => void retryLoad()}
        />
      ) : habits.length === 0 ? (
        <View style={styles.emptyStateWrap}>
          <EmptyState
            icon="chart-no-axes-column-increasing"
            title="Your progress will grow here"
            description="Add a habit and start recording completions to see your weekly rhythm and streaks."
            actionLabel="Add your first habit"
            onAction={() => {
              router.navigate('/today');
              router.push('/habit/new');
            }}
          />
        </View>
      ) : (
        <>
          <View style={styles.metricTiles}>
            <View style={[styles.metricTile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.tileLabel, { color: theme.colors.textSecondary }]}>Completion</Text>
              <Text style={[styles.tileValue, { color: theme.colors.text }]}>
                {summary.eligibleCompletions > 0 ? `${summary.percentage}%` : '—'}
              </Text>
            </View>
            <View style={[styles.metricTile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.tileLabel, { color: theme.colors.textSecondary }]}>Best streak</Text>
              <Text style={[styles.tileValue, { color: theme.colors.text }]}>
                {bestStreak}<Text style={styles.metricUnit}> days</Text>
              </Text>
            </View>
            <View style={[styles.metricTile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.tileLabel, { color: theme.colors.textSecondary }]}>Done</Text>
              <Text style={[styles.tileValue, { color: theme.colors.text }]}>
                {summary.totalCompletions}<Text style={styles.metricUnit}>/{summary.eligibleCompletions}</Text>
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.weekCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.weekNavigation}>
              <View style={styles.weekHeading}>
                <Text style={[styles.weekDate, { color: theme.colors.text }]}>
                  {weekOffset === 0 ? 'This week' : displayRange(summary.startDate, summary.endDate)}
                </Text>
                <Text style={[styles.weekRange, { color: theme.colors.textSecondary }]}>
                  {displayRange(summary.startDate, summary.endDate)}
                </Text>
              </View>
              <View style={styles.weekControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous week"
                  onPress={() => setWeekOffset((value) => value - 1)}
                  style={({ pressed }) => [
                    styles.weekArrow,
                    { backgroundColor: theme.colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Lucide name="chevron-left" size={16} color={theme.colors.text} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next week"
                  accessibilityState={{ disabled: weekOffset >= 0 }}
                  disabled={weekOffset >= 0}
                  onPress={() => setWeekOffset((value) => Math.min(0, value + 1))}
                  style={({ pressed }) => [
                    styles.weekArrow,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      opacity: weekOffset >= 0 ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Lucide name="chevron-right" size={16} color={theme.colors.text} />
                </Pressable>
              </View>
            </View>
            <View style={styles.weekBars}>
              {summary.days.map((day) => {
                const date = parseLocalDate(day.date);
                const ratio = day.eligible > 0 ? day.completions / day.eligible : 0;
                return (
                  <View key={day.date} style={styles.weekBarColumn}>
                    <View style={[styles.weekBarTrack, { backgroundColor: theme.colors.surfaceMuted }]}>
                      <View
                        style={[
                          styles.weekBar,
                          {
                            height: `${Math.max(day.completions > 0 ? 12 : 0, ratio * 100)}%`,
                            backgroundColor: theme.colors.accent,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.weekBarLabel, { color: theme.colors.textTertiary }]}>
                      {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="By habit" />
            {weeklyHabits.length === 0 ? (
              <EmptyState icon="leaf" title="No active habits" description="Add a habit to see its weekly progress here." />
            ) : (
              <View style={styles.streakList}>
                {weeklyHabits.map((habit) => {
                  const streaks = calculateStreaks(habit, completions, today);
                  const eligibleDays = summary.days.filter(
                    (day) =>
                      day.date >= habit.createdAt &&
                      day.date <= today &&
                      isScheduledOn(habit, day.date),
                  );
                  const completedDays = eligibleDays.filter((day) =>
                    completions.some(
                      (completion) => completion.habitId === habit.id && completion.date === day.date,
                    ),
                  ).length;
                  return (
                    <View
                      key={habit.id}
                      style={[
                        styles.streakRow,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      ]}
                    >
                      <View style={[styles.streakIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
                        <Lucide name={habit.icon} size={19} color={habit.color} />
                      </View>
                      <View style={styles.streakName}>
                        <Text style={[styles.habitName, { color: theme.colors.text }]} numberOfLines={1}>
                          {habit.name}
                        </Text>
                        <View style={styles.habitDots}>
                          {summary.days.map((day) => {
                            const isEligible =
                              day.date >= habit.createdAt &&
                              day.date <= today &&
                              isScheduledOn(habit, day.date);
                            const isDone =
                              isEligible &&
                              completions.some(
                                (completion) =>
                                  completion.habitId === habit.id && completion.date === day.date,
                              );
                            return (
                              <View
                                key={day.date}
                                style={[
                                  styles.habitDot,
                                  {
                                    backgroundColor: isDone
                                      ? theme.colors.accent
                                      : isEligible
                                        ? theme.colors.border
                                        : 'transparent',
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>
                      </View>
                      <View style={styles.streakMetric}>
                        <Text style={[styles.streakValue, { color: theme.colors.text }]}>
                          {completedDays}/{eligibleDays.length}
                        </Text>
                        <Text style={[styles.streakCaption, { color: theme.colors.textSecondary }]}>
                          {streaks.current} day streak
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg },
  emptyStateWrap: { flex: 1, justifyContent: 'center' },
  heading: { gap: spacing.xs, marginBottom: spacing.xs },
  eyebrow: { fontSize: typography.caption, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: typography.caption, lineHeight: 17 },
  weekCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  weekNavigation: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekControls: { flexDirection: 'row', gap: spacing.xs },
  weekArrow: { width: 30, height: 30, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  weekHeading: { alignItems: 'flex-start', gap: 1 },
  weekDate: { fontSize: typography.footnote, fontWeight: '700' },
  weekRange: { fontSize: 9 },
  weekBars: { height: 62, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  weekBarColumn: { flex: 1, alignItems: 'center', gap: 4 },
  weekBarTrack: { width: 14, maxWidth: '100%', height: 46, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 7 },
  weekBar: { width: '100%', minHeight: 4, borderRadius: 7 },
  weekBarLabel: { fontSize: 9, fontWeight: '700' },
  weekMetric: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  weekPercentage: { fontSize: 40, fontWeight: '700', letterSpacing: -1.4 },
  weekMetricCopy: { flex: 1, gap: spacing.xs },
  metricLabel: { fontSize: typography.footnote, fontWeight: '600' },
  metricDetail: { fontSize: typography.caption, lineHeight: 18 },
  denominatorNote: { fontSize: typography.caption, lineHeight: 18 },
  section: { gap: spacing.lg },
  chartCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.xl,
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  dayRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayLabelWrap: { width: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayLabel: { width: 30, fontSize: typography.footnote, fontWeight: '600' },
  dayNumber: { fontSize: typography.caption },
  barTrack: { flex: 1, height: 12, borderRadius: radii.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radii.pill },
  dayCount: { width: 38, textAlign: 'right', fontSize: typography.caption, fontWeight: '600' },
  chartNote: { marginTop: spacing.xs, fontSize: typography.caption, lineHeight: 18 },
  metricTiles: { flexDirection: 'row', gap: spacing.sm },
  metricTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    gap: 3,
  },
  metricIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 17, fontWeight: '800', lineHeight: 21 },
  tileLabel: { fontSize: 9, lineHeight: 12, fontWeight: '600' },
  metricUnit: { fontSize: 9, fontWeight: '600' },
  streakList: { gap: spacing.sm },
  streakRow: { minHeight: 48, paddingHorizontal: spacing.sm, paddingVertical: 5, borderWidth: 1, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakIcon: { width: 32, height: 32, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  streakName: { flex: 1, minWidth: 0, gap: 4 },
  habitName: { fontSize: 10, fontWeight: '700' },
  habitDots: { flexDirection: 'row', gap: 4 },
  habitDot: { width: 6, height: 6, borderRadius: radii.pill },
  archivedLabel: { fontSize: typography.caption },
  streakMetric: { minWidth: 40, alignItems: 'flex-end', gap: 2 },
  streakValue: { fontSize: 10, fontWeight: '700' },
  streakCaption: { fontSize: 8, textAlign: 'right' },
});
