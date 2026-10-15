import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import { ScreenContainer } from '../components/design-system';
import { useHabitStore } from '../data/habit-store';
import { SUGGESTED_HABITS } from '../data/models';
import { FreeHabitLimitError } from '../data/premium';
import { radii, spacing, useTheme } from '../theme';

export default function SuggestedHabitsScreen() {
  const { theme, mode } = useTheme();
  const { habits, status, createHabit, clearError, retryLoad } = useHabitStore();
  const [addingHabit, setAddingHabit] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const addingHabitRef = useRef(false);
  const existingHabitNames = new Set(habits.map((habit) => habit.name.toLocaleLowerCase()));
  const suggestions = SUGGESTED_HABITS.filter(
    (habit) => !existingHabitNames.has(habit.name.toLocaleLowerCase()),
  );

  async function addHabit(habit: (typeof SUGGESTED_HABITS)[number]) {
    if (addingHabitRef.current) return;
    addingHabitRef.current = true;
    setAddingHabit(habit.name);
    setOperationError(null);
    clearError();

    try {
      await createHabit(habit);
    } catch (error) {
      if (error instanceof FreeHabitLimitError) {
        router.push('/premium');
      } else {
        setOperationError(
          error instanceof Error ? error.message : 'This habit could not be added. Please try again.',
        );
      }
    } finally {
      addingHabitRef.current = false;
      setAddingHabit(null);
    }
  }

  return (
    <ScreenContainer
      backgroundColor={theme.colors.background}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}
      contentStyle={styles.content}
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          hitSlop={8}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Lucide name="arrow-left" size={20} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Suggested Habits</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Small ideas to help make today count.
          </Text>
        </View>
      </View>

      {operationError ? (
        <View
          accessibilityRole="alert"
          style={[styles.errorBanner, { backgroundColor: theme.colors.surfaceMuted }]}
        >
          <Lucide name="triangle-alert" size={17} color={theme.colors.danger} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{operationError}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            onPress={() => setOperationError(null)}
            hitSlop={8}
          >
            <Lucide name="x" size={17} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      {status === 'loading' ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
            Loading your habits…
          </Text>
        </View>
      ) : status === 'error' ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.loadError,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Lucide name="triangle-alert" size={22} color={theme.colors.danger} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            Your habits aren’t available
          </Text>
          <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
            Retry loading your saved habits to add a suggestion.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void retryLoad()}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: theme.colors.accentSoft, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.retryLabel, { color: theme.colors.accentStrong }]}>Retry</Text>
          </Pressable>
        </View>
      ) : suggestions.length > 0 ? (
        <View style={styles.suggestionList}>
          {suggestions.map((habit) => (
            <View
              key={habit.name}
              style={[
                styles.suggestionCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.suggestionIcon,
                    { backgroundColor: `${habit.color}24` },
                  ]}
                >
                  <Lucide name={habit.icon} size={21} color={habit.color} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${habit.name} habit`}
                  accessibilityHint="Adds this suggestion to your habit list"
                  accessibilityState={{
                    disabled: addingHabit !== null || status !== 'ready',
                    busy: addingHabit === habit.name,
                  }}
                  disabled={addingHabit !== null || status !== 'ready'}
                  onPress={() => void addHabit(habit)}
                  style={({ pressed }) => [
                    styles.addButton,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      opacity: pressed || addingHabit === habit.name ? 0.7 : 1,
                    },
                  ]}
                >
                  <Lucide name="plus" size={15} color={theme.colors.accentStrong} />
                  <Text style={[styles.addButtonLabel, { color: theme.colors.accentStrong }]}>
                    Add Habit
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.suggestionTitle, { color: theme.colors.text }]}>
                {habit.name}
              </Text>
              {habit.targetDescription ? (
                <Text style={[styles.suggestionDescription, { color: theme.colors.textSecondary }]}>
                  {habit.targetDescription}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: theme.colors.accentSoft }]}>
            <Lucide name="check" size={22} color={theme.colors.accentStrong} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            You’ve got them all
          </Text>
          <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
            You’ve added every suggested habit. Keep building your routine!
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, lineHeight: 17 },
  suggestionList: { gap: spacing.md },
  suggestionCard: {
    minHeight: 132,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  suggestionIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addButtonLabel: { fontSize: 12, fontWeight: '700' },
  suggestionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  suggestionDescription: { fontSize: 12, lineHeight: 18 },
  errorBanner: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19 },
  emptyState: { alignItems: 'center', padding: spacing.xl },
  loadError: {
    minHeight: 200,
    padding: spacing.xl,
    borderWidth: 1,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: { fontSize: 13, fontWeight: '700' },
  emptyCard: {
    width: '100%',
    minHeight: 200,
    padding: spacing.xl,
    borderWidth: 1,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
