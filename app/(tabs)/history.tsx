import { router } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import React, { useMemo, useState } from 'react';
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
  completionFor,
  historyForDate,
  isScheduledOn,
  localDateKey,
  parseLocalDate,
} from '../../data/domain';
import type { LocalDate } from '../../data/models';
import { radii, spacing, typography, useTheme } from '../../theme';

function monthStart(date: LocalDate): LocalDate {
  const parsed = parseLocalDate(date);
  parsed.setDate(1);
  return localDateKey(parsed);
}

function addMonths(date: LocalDate, amount: number): LocalDate {
  const parsed = parseLocalDate(date);
  parsed.setDate(1);
  parsed.setMonth(parsed.getMonth() + amount);
  return localDateKey(parsed);
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const {
    habits,
    completions,
    status,
    error,
    retryLoad,
    toggleCompleted,
    clearError,
  } = useHabitStore();
  const today = localDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState<LocalDate>(today);
  const [visibleMonth, setVisibleMonth] = useState<LocalDate>(monthStart(today));
  const [editingHistory, setEditingHistory] = useState(false);
  const monthDate = parseLocalDate(visibleMonth);
  const calendarDates = useMemo(() => {
    const firstDay = parseLocalDate(visibleMonth);
    const firstWeekdayOffset = firstDay.getDay();
    const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((firstWeekdayOffset + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const dayOffset = index - firstWeekdayOffset;
      return dayOffset < 0 || dayOffset >= daysInMonth
        ? null
        : addLocalDays(visibleMonth, dayOffset);
    });
  }, [visibleMonth]);
  const selected = historyForDate(habits, completions, selectedDate, today);
  const selectedParsed = parseLocalDate(selectedDate);
  const headingDate = selectedParsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: selectedParsed.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
  const firstHabitCreated = habits.length
    ? habits.reduce(
        (first, habit) => (habit.createdAt < first ? habit.createdAt : first),
        habits[0].createdAt,
      )
    : null;
  const beforeAllHabits = firstHabitCreated !== null && selectedDate < firstHabitCreated;

  function selectMonth(offset: number) {
    const nextMonth = addMonths(visibleMonth, offset);
    const nextMonthStart = monthStart(nextMonth);
    setVisibleMonth(nextMonthStart);
    setEditingHistory(false);
    if (nextMonthStart > today) {
      setVisibleMonth(monthStart(today));
      setSelectedDate(today);
    } else if (selectedDate.slice(0, 7) !== nextMonthStart.slice(0, 7)) {
      const firstDay = nextMonthStart <= today ? nextMonthStart : today;
      setSelectedDate(firstDay);
    }
  }

  return (
    <ScreenContainer
      fillContent={status === 'ready' && habits.length === 0}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + insets.bottom },
      ]}
    >
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>LOOKING BACK</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>History</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Every day is another chance to begin.
        </Text>
      </View>

      {status === 'loading' ? (
        <LoadingState label="Loading your history" />
      ) : status === 'error' ? (
        <ErrorState
          title="Your history isn’t available"
          description={error ?? 'Saved data could not be loaded.'}
          onRetry={() => void retryLoad()}
        />
      ) : habits.length === 0 ? (
        <View style={styles.emptyStateWrap}>
          <EmptyState
            icon="calendar-days"
            title="Your history starts with a habit"
            description="Once you add habits and mark them complete, your days will appear here."
            actionLabel="Add your first habit"
            onAction={() => {
              router.navigate('/today');
              router.push('/habit/new');
            }}
          />
        </View>
      ) : (
        <>
          {error ? (
            <View
              accessibilityRole="alert"
              style={[styles.editNote, { backgroundColor: theme.colors.surfaceMuted }]}
            >
              <Lucide name="triangle-alert" size={17} color={theme.colors.danger} />
              <Text style={[styles.editNoteText, { color: theme.colors.text }]}>
                {error}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss message"
                onPress={clearError}
                style={styles.dismissButton}
              >
                <Lucide name="x" size={17} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}
          <View
            style={[
              styles.calendarCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.monthNavigation}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => selectMonth(-1)}
                style={({ pressed }) => [
                  styles.monthArrow,
                  { backgroundColor: theme.colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Lucide name="chevron-left" size={19} color={theme.colors.text} />
              </Pressable>
              <Text style={[styles.monthTitle, { color: theme.colors.text }]}>
                {monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                accessibilityState={{ disabled: visibleMonth >= monthStart(today) }}
                disabled={visibleMonth >= monthStart(today)}
                onPress={() => selectMonth(1)}
                style={({ pressed }) => [
                  styles.monthArrow,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    opacity: visibleMonth >= monthStart(today) ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Lucide name="chevron-right" size={19} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text
                  key={`${day}-${index}`}
                  accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index]}
                  style={[styles.weekdayHeading, { color: theme.colors.textTertiary }]}
                >
                  {day}
                </Text>
              ))}
              {calendarDates.map((date, index) => {
                if (date === null) {
                  return <View key={`blank-${index}`} style={styles.dayCell} />;
                }
                const parsedDate = parseLocalDate(date);
                const inMonth = parsedDate.getMonth() === monthDate.getMonth();
                const future = date > today;
                const isSelected = date === selectedDate;
                const dayHistory =
                  date <= today
                    ? historyForDate(habits, completions, date, today)
                    : null;
                const scheduledCount = dayHistory?.scheduled.length ?? 0;
                const completedCount = dayHistory?.completedIds.size ?? 0;
                const dayColor =
                  completedCount === 0
                    ? 'transparent'
                    : completedCount === scheduledCount
                      ? theme.colors.accent
                      : '#287B68';
                return (
                  <Pressable
                    key={date}
                    accessibilityRole="button"
                    accessibilityLabel={parsedDate.toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                    accessibilityHint={future ? 'Future dates are unavailable' : 'View habit completion for this date'}
                    accessibilityState={{ selected: isSelected, disabled: future }}
                    disabled={future}
                    onPress={() => {
                      setSelectedDate(date);
                      setVisibleMonth(monthStart(date));
                      setEditingHistory(false);
                    }}
                    style={({ pressed }) => [
                      styles.dayCell,
                      {
                        backgroundColor: scheduledCount > 0 ? dayColor : 'transparent',
                        borderColor: isSelected
                          ? theme.colors.text
                          : scheduledCount > 0 && completedCount === 0
                            ? theme.colors.border
                            : dayColor,
                        borderWidth: isSelected || scheduledCount > 0 ? 1 : 0,
                        opacity: future ? 0.28 : pressed ? 0.7 : inMonth ? 1 : 0.52,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        {
                          color: dayColor !== 'transparent' ? theme.colors.accentOn : theme.colors.text,
                          fontWeight: isSelected || date === today ? '700' : '500',
                        },
                      ]}
                    >
                      {parsedDate.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.calendarLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: 'transparent', borderColor: theme.colors.border, borderWidth: 1 }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Missed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#287B68' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Some</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.accent }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>All done</Text>
              </View>
            </View>
          </View>

          <View style={styles.dateSection}>
            <View style={styles.dateHeading}>
              <View style={styles.dateCopy}>
                <SectionHeader title={headingDate} />
                <Text style={[styles.dateSummary, { color: theme.colors.textSecondary }]}>
                  {selected.future
                    ? 'Future dates are not available.'
                    : beforeAllHabits
                      ? 'No habits had been created yet.'
                      : selected.scheduled.length === 0
                        ? 'No habits were scheduled for this date.'
                        : `${selected.completedIds.size} of ${selected.scheduled.length} scheduled habits complete`}
                </Text>
              </View>
              {!selected.future && selected.scheduled.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: editingHistory }}
                  accessibilityLabel={editingHistory ? 'Finish editing history' : 'Change historical completions'}
                  onPress={() => setEditingHistory((value) => !value)}
                  style={({ pressed }) => [
                    styles.editHistoryButton,
                    {
                      backgroundColor: editingHistory ? theme.colors.accentSoft : theme.colors.surface,
                      borderColor: theme.colors.border,
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <Lucide
                    name={editingHistory ? 'check' : 'pencil'}
                    size={16}
                    color={theme.colors.accentStrong}
                  />
                  <Text style={[styles.editHistoryLabel, { color: theme.colors.accentStrong }]}>
                    {editingHistory ? 'Done' : 'Edit'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {editingHistory ? (
              <View style={[styles.editNote, { backgroundColor: theme.colors.surfaceMuted }]}>
                <Lucide name="info" size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.editNoteText, { color: theme.colors.textSecondary }]}>
                  You’re changing history for {headingDate}. Today’s completions are not affected.
                </Text>
              </View>
            ) : null}
            {selected.scheduled.length === 0 ? (
              <EmptyState
                title={selected.future ? 'A day still ahead' : 'Nothing scheduled this day'}
                description={
                  selected.future
                    ? 'Future dates are unavailable until they arrive.'
                    : beforeAllHabits
                      ? 'This date comes before your first habit was created.'
                      : 'Unscheduled days are left open, not counted as missed.'
                }
                icon={selected.future ? 'sun' : 'calendar-days'}
              />
            ) : (
              <View style={styles.historyHabits}>
                {selected.scheduled.map((habit) => (
                  <View
                    key={habit.id}
                    style={[
                      styles.historyRow,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    ]}
                  >
                    <View style={[styles.habitIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
                      <Lucide name={habit.icon} size={19} color={habit.color} />
                    </View>
                    <View style={styles.habitCopy}>
                      <Text style={[styles.habitName, { color: theme.colors.text }]} numberOfLines={1}>
                        {habit.name}
                      </Text>
                      <Text style={[styles.habitState, { color: theme.colors.textSecondary }]}>
                        {completionFor(completions, habit.id, selectedDate)
                          ? !isScheduledOn(habit, selectedDate)
                            ? 'Completed · schedule later changed'
                            : 'Completed'
                          : !isScheduledOn(habit, selectedDate)
                            ? 'Completed, but no longer scheduled'
                            : 'Not completed'}
                      </Text>
                    </View>
                    {editingHistory ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          completionFor(completions, habit.id, selectedDate)
                            ? `Remove ${habit.name} completion for ${headingDate}`
                            : `Mark ${habit.name} complete for ${headingDate}`
                        }
                        onPress={() => {
                          clearError();
                          void toggleCompleted(habit.id, selectedDate).catch(() => undefined);
                        }}
                        style={({ pressed }) => [
                          styles.historyToggle,
                          {
                            backgroundColor: completionFor(completions, habit.id, selectedDate)
                              ? theme.colors.accent
                              : theme.colors.surfaceMuted,
                            opacity: pressed ? 0.72 : 1,
                          },
                        ]}
                      >
                        <Lucide
                          name={
                            completionFor(completions, habit.id, selectedDate)
                              ? 'check'
                              : 'plus'
                          }
                          size={18}
                          color={
                            completionFor(completions, habit.id, selectedDate)
                              ? theme.colors.accentOn
                              : theme.colors.textSecondary
                          }
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing['2xl'], gap: spacing['2xl'] },
  emptyStateWrap: { flex: 1, justifyContent: 'center' },
  heading: { gap: spacing.sm, marginBottom: spacing.xs },
  eyebrow: { fontSize: typography.caption, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: typography.footnote, lineHeight: 20 },
  calendarCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.xl,
    gap: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  monthNavigation: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthArrow: { width: 44, height: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: typography.body, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekdayHeading: { width: `${100 / 7}%`, height: 36, textAlign: 'center', textAlignVertical: 'center', fontSize: typography.caption, fontWeight: '600' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayNumber: { fontSize: typography.footnote },
  dayMarker: { width: 4, height: 4, borderRadius: radii.pill },
  calendarLegend: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: radii.pill },
  legendText: { fontSize: 10 },
  dateSection: { gap: spacing.lg },
  dateHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  dateSummary: { fontSize: typography.footnote, lineHeight: 21 },
  editHistoryButton: { minHeight: 44, paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editHistoryLabel: { fontSize: typography.footnote, fontWeight: '600' },
  editNote: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editNoteText: { flex: 1, fontSize: typography.caption, lineHeight: 18 },
  dismissButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  historyHabits: { gap: spacing.sm },
  historyRow: { minHeight: 72, padding: spacing.md, borderWidth: 1, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  habitIcon: { width: 42, height: 42, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  habitCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  habitName: { fontSize: typography.footnote, fontWeight: '600' },
  habitState: { fontSize: typography.caption, lineHeight: 17 },
  historyToggle: { width: 44, height: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
