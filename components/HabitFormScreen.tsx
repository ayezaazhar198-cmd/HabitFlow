import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Lucide, { type LucideIconName } from '@react-native-vector-icons/lucide';
import {
  ConfirmationDialog,
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenContainer,
} from './design-system';
import { useHabitStore } from '../data/habit-store';
import type { Habit, HabitInput } from '../data/models';
import { validateHabitForm } from '../data/validation';
import {
  localRemindersSupported,
  localRemindersUnavailableMessage,
} from '../data/notifications';
import { FREE_ACTIVE_HABIT_LIMIT, FreeHabitLimitError } from '../data/premium';
import { radii, spacing, typography, useTheme } from '../theme';

const WEEKDAYS = [
  { label: 'S', full: 'Sunday', value: 0 },
  { label: 'M', full: 'Monday', value: 1 },
  { label: 'T', full: 'Tuesday', value: 2 },
  { label: 'W', full: 'Wednesday', value: 3 },
  { label: 'T', full: 'Thursday', value: 4 },
  { label: 'F', full: 'Friday', value: 5 },
  { label: 'S', full: 'Saturday', value: 6 },
] as const;

const ICONS: LucideIconName[] = [
  'leaf',
  'droplets',
  'book-open',
  'footprints',
  'brain',
  'heart',
  'sun',
  'moon',
];

const ACCENTS = [
  { label: 'Emerald', value: '#22C55E' },
  { label: 'Lavender', value: '#A78BFA' },
  { label: 'Peach', value: '#FDBA9A' },
  { label: 'Sunshine', value: '#FDE68A' },
  { label: 'Mint', value: '#86EFAC' },
] as const;

const WEB_HOURS = Array.from({ length: 17 }, (_, index) => index + 6);
const WEB_MINUTES = [0, 15, 30, 45] as const;

type FormErrors = {
  name?: string;
  weekdays?: string;
};

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseTime(value?: string) {
  const date = new Date();
  if (value) {
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isInteger(hours) && Number.isInteger(minutes)) {
      date.setHours(hours, minutes, 0, 0);
    }
  } else {
    date.setHours(9, 0, 0, 0);
  }
  return date;
}

function displayTime(value: string) {
  return parseTime(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

type HabitFormScreenProps = {
  habitId?: string;
};

export default function HabitFormScreen({ habitId }: HabitFormScreenProps) {
  const { habits, status, error, retryLoad } = useHabitStore();
  const existingHabit = habitId ? habits.find((habit) => habit.id === habitId) : undefined;

  if (status === 'loading') {
    return (
      <ScreenContainer contentContainerStyle={styles.missingContent}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (status === 'error') {
    return (
      <ScreenContainer contentContainerStyle={styles.missingContent}>
        <ErrorState
          title="Your habits couldn’t be loaded"
          description={error ?? 'Saved data is unavailable.'}
          onRetry={() => void retryLoad()}
        />
      </ScreenContainer>
    );
  }

  if (habitId && !existingHabit) {
    return (
      <ScreenContainer contentContainerStyle={styles.missingContent}>
        <ErrorState
          title="This habit isn’t available"
          description="It may have been deleted or is no longer available."
        />
        <PrimaryButton
          label="Back to Today"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      </ScreenContainer>
    );
  }

  return (
    <HabitFormEditor
      key={habitId ?? 'new'}
      habitId={habitId}
      existingHabit={existingHabit}
    />
  );
}

function HabitFormEditor({
  habitId,
  existingHabit,
}: HabitFormScreenProps & { existingHabit?: Habit }) {
  const { theme, mode } = useTheme();
  const {
    data,
    lifetimeAccess,
    error: storageError,
    createHabit,
    updateHabit,
    archiveHabit,
    deleteHabit,
    clearError,
    setRemindersEnabled,
    addSuggestedHabits,
  } = useHabitStore();
  const [confirmation, setConfirmation] = useState<'archive' | 'delete' | null>(null);
  const [showFreeLimitDialog, setShowFreeLimitDialog] = useState(
    () =>
      !habitId &&
      !lifetimeAccess &&
      data.habits.filter((habit) => habit.active).length >= FREE_ACTIVE_HABIT_LIMIT,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [name, setName] = useState(existingHabit?.name ?? '');
  const [icon, setIcon] = useState<LucideIconName>(existingHabit?.icon ?? 'leaf');
  const [accentColor, setAccentColor] = useState(existingHabit?.color ?? ACCENTS[0].value);
  const [weekdays, setWeekdays] = useState<number[]>(existingHabit?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]);
  const [targetDescription, setTargetDescription] = useState(
    existingHabit?.targetDescription ?? '',
  );
  const [noteOpen, setNoteOpen] = useState(Boolean(existingHabit?.targetDescription));
  const [reminderTime, setReminderTime] = useState(existingHabit?.reminderTime);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [webHour, setWebHour] = useState(() => parseTime(existingHabit?.reminderTime).getHours());
  const [webMinute, setWebMinute] = useState(
    () => parseTime(existingHabit?.reminderTime).getMinutes(),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const allDaysSelected =
    weekdays.length === WEEKDAYS.length &&
    WEEKDAYS.every((day) => weekdays.includes(day.value));
  const activeHabitCount = data.habits.filter((habit) => habit.active).length;
  const nextFreeHabitNumber = Math.min(activeHabitCount + 1, FREE_ACTIVE_HABIT_LIMIT);
  const ordinalSuffix =
    nextFreeHabitNumber === 1 ? 'st' : nextFreeHabitNumber === 2 ? 'nd' : 'rd';
  const visibleIcons = ICONS.filter((option, index) => index < 6 || option === icon);

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((first, second) => first - second),
    );
    setErrors((current) => ({ ...current, weekdays: undefined }));
  }

  function chooseReminder(hour: number, minute: number) {
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    setReminderTime(formatTime(time));
    setWebHour(hour);
    setWebMinute(minute);
  }

  function cancel() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/today');
    }
  }

  function save() {
    const trimmedName = name.trim();
    const nextErrors = validateHabitForm(name, weekdays);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const habit: HabitInput = {
      name: trimmedName,
      icon,
      color: accentColor,
      weekdays,
      ...(targetDescription.trim()
        ? { targetDescription: targetDescription.trim() }
        : {}),
      ...(reminderTime ? { reminderTime } : {}),
    };

    void saveHabit(habit);
  }

  async function addSuggestions() {
    setOperationError(null);
    clearError();
    try {
      await addSuggestedHabits();
      router.replace('/today');
    } catch (suggestionError) {
      if (suggestionError instanceof FreeHabitLimitError) {
        setShowFreeLimitDialog(true);
      } else {
        setOperationError(
          suggestionError instanceof Error
            ? suggestionError.message
            : 'Suggested habits could not be added.',
        );
      }
    }
  }

  async function saveHabit(habit: HabitInput) {
    setIsSaving(true);
    setOperationError(null);
    clearError();
    try {
      if (
        !habitId &&
        !lifetimeAccess &&
        data.habits.filter((item) => item.active).length >= FREE_ACTIVE_HABIT_LIMIT
      ) {
        throw new FreeHabitLimitError();
      }
      if (
        habit.reminderTime &&
        localRemindersSupported &&
        !data.settings.remindersEnabled
      ) {
        await setRemindersEnabled(true);
      }
      if (habitId) {
        await updateHabit(habitId, habit);
      } else {
        await createHabit(habit);
      }
      cancel();
    } catch (error) {
      if (error instanceof FreeHabitLimitError) {
        setShowFreeLimitDialog(true);
      } else {
        setOperationError(error instanceof Error ? error.message : 'The habit could not be saved.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmArchive() {
    if (!habitId) return;
    setIsSaving(true);
    setOperationError(null);
    setConfirmation(null);
    try {
      await archiveHabit(habitId);
      cancel();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'The habit could not be archived.');
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!habitId) return;
    setIsSaving(true);
    setOperationError(null);
    setConfirmation(null);
    try {
      await deleteHabit(habitId);
      cancel();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'The habit could not be deleted.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <ScreenContainer
        contentContainerStyle={styles.content}
        contentStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel and go back"
            onPress={cancel}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Lucide name="chevron-left" size={21} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {habitId ? 'Edit habit' : 'New habit'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
          A small promise to yourself, at your own pace.
        </Text>

        <View
          style={[
            styles.previewCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={[styles.previewIcon, { backgroundColor: accentColor }]}>
            <Lucide name={icon} size={22} color={theme.colors.accentOn} />
          </View>
          <View style={styles.previewCopy}>
            <Text style={[styles.previewName, { color: theme.colors.text }]} numberOfLines={1}>
              {name.trim() || 'Your habit name'}
            </Text>
            <Text style={[styles.previewDetail, { color: theme.colors.textSecondary }]}>
              {allDaysSelected ? 'Every day' : `${weekdays.length} days a week`}
            </Text>
          </View>
          <Text style={[styles.previewLabel, { color: theme.colors.textSecondary }]}>PREVIEW</Text>
        </View>

        {storageError || operationError ? (
          <View
            accessibilityRole="alert"
            style={[styles.operationError, { backgroundColor: theme.colors.surfaceMuted }]}
          >
            <Lucide name="triangle-alert" size={17} color={theme.colors.danger} />
            <Text style={[styles.errorText, { color: theme.colors.text }]}>
              {operationError ?? storageError}
            </Text>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Habit name</Text>
          <TextInput
            accessibilityLabel="Habit name"
            accessibilityHint="Required"
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="e.g. Take a morning walk"
            placeholderTextColor={theme.colors.textTertiary}
            returnKeyType="next"
            maxLength={60}
            style={[
              styles.textInput,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor: errors.name ? theme.colors.danger : theme.colors.border,
              },
            ]}
          />
          {errors.name ? (
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>{errors.name}</Text>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Icon</Text>
          <View style={styles.iconGrid}>
            {visibleIcons.map((option) => {
              const selected = icon === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option} icon`}
                  accessibilityState={{ checked: selected }}
                  onPress={() => setIcon(option)}
                  style={({ pressed }) => [
                    styles.iconOption,
                    {
                      backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
                      borderColor: selected ? theme.colors.accent : theme.colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Lucide
                    name={option}
                    size={21}
                    color={selected ? theme.colors.accentStrong : theme.colors.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Color</Text>
          <View style={styles.colorRow}>
            {ACCENTS.map((option) => {
              const selected = accentColor === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label} accent`}
                  accessibilityState={{ checked: selected }}
                  onPress={() => setAccentColor(option.value)}
                  style={({ pressed }) => [
                    styles.colorOption,
                    {
                      backgroundColor: option.value,
                      borderColor: selected ? theme.colors.text : theme.colors.surface,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  {selected ? (
                    <Lucide name="check" size={18} color={theme.colors.accentOn} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.weekdayHeading}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Repeat</Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Every day"
              accessibilityState={{ checked: allDaysSelected }}
              onPress={() => {
                setWeekdays(allDaysSelected ? [] : WEEKDAYS.map((day) => day.value));
                setErrors((current) => ({ ...current, weekdays: undefined }));
              }}
              hitSlop={8}
            >
              <Text style={[styles.everyDayLabel, { color: theme.colors.accent }]}>
                Every day
              </Text>
            </Pressable>
          </View>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day, index) => {
              const selected = weekdays.includes(day.value);
              return (
                <Pressable
                  key={day.value}
                  accessibilityRole="checkbox"
                  accessibilityLabel={day.full}
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleWeekday(day.value)}
                  style={({ pressed }) => [
                    styles.weekdayOption,
                    {
                      backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
                      borderColor: selected ? theme.colors.accent : theme.colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.weekdayText,
                      { color: selected ? theme.colors.accentOn : theme.colors.textSecondary },
                    ]}
                  >
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.weekdays ? (
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>
              {errors.weekdays}
            </Text>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: reminderOpen }}
            accessibilityLabel={reminderTime ? `Reminder at ${displayTime(reminderTime)}` : 'Choose a reminder time'}
            accessibilityHint={
              localRemindersSupported
                ? 'Saving this time enables local reminders and may ask permission'
                : localRemindersUnavailableMessage
            }
            onPress={() => {
              setWebHour(parseTime(reminderTime).getHours());
              setWebMinute(parseTime(reminderTime).getMinutes());
              setReminderOpen((open) => !open);
            }}
            style={({ pressed }) => [
              styles.reminderButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>Reminder</Text>
            <Text style={[styles.reminderText, { color: theme.colors.textSecondary }]}>
              {reminderTime ? displayTime(reminderTime) : 'Optional'}
            </Text>
            <Lucide name="chevron-down" size={18} color={theme.colors.textTertiary} />
          </Pressable>
          {reminderOpen ? (
            Platform.OS === 'web' ? (
              <View
                style={[
                  styles.webTimePicker,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.webTimeColumn}>
                  <Text style={[styles.webTimeLabel, { color: theme.colors.textSecondary }]}>
                    Hour
                  </Text>
                  <View style={styles.webTimeOptions}>
                    {WEB_HOURS.map((hour) => (
                      <Pressable
                        key={hour}
                        accessibilityRole="radio"
                        accessibilityLabel={`${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`}
                        accessibilityState={{ checked: webHour === hour }}
                        onPress={() => setWebHour(hour)}
                        style={[
                          styles.webTimeOption,
                          { backgroundColor: webHour === hour ? theme.colors.accentSoft : 'transparent' },
                        ]}
                      >
                        <Text style={{ color: theme.colors.text }}>
                          {hour % 12 || 12} {hour < 12 ? 'AM' : 'PM'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.webTimeColumn}>
                  <Text style={[styles.webTimeLabel, { color: theme.colors.textSecondary }]}>
                    Minute
                  </Text>
                  <View style={styles.webMinuteOptions}>
                    {WEB_MINUTES.map((minute) => (
                      <Pressable
                        key={minute}
                        accessibilityRole="radio"
                        accessibilityLabel={`${minute} minutes`}
                        accessibilityState={{ checked: webMinute === minute }}
                        onPress={() => setWebMinute(minute)}
                        style={[
                          styles.webMinuteOption,
                          {
                            backgroundColor:
                              webMinute === minute ? theme.colors.accentSoft : 'transparent',
                          },
                        ]}
                      >
                        <Text style={{ color: theme.colors.text }}>
                          {String(minute).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.webTimeActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setReminderTime(undefined);
                      setReminderOpen(false);
                    }}
                    style={styles.reminderClear}
                  >
                    <Text style={[styles.everyDayLabel, { color: theme.colors.textSecondary }]}>
                      Clear
                    </Text>
                  </Pressable>
                  <PrimaryButton
                    label="Done"
                    onPress={() => {
                      chooseReminder(webHour, webMinute);
                      setReminderOpen(false);
                    }}
                    style={styles.pickerDone}
                  />
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.nativePicker,
                  Platform.OS === 'ios'
                    ? { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
                    : undefined,
                ]}
              >
                <DateTimePicker
                  value={parseTime(reminderTime)}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  is24Hour={false}
                  minuteInterval={5}
                  themeVariant={mode}
                  accentColor={theme.colors.accent}
                  onValueChange={(_, date) => {
                    setReminderTime(formatTime(date));
                    if (Platform.OS === 'android') setReminderOpen(false);
                  }}
                  onDismiss={() => setReminderOpen(false)}
                />
                {Platform.OS === 'ios' ? (
                  <View style={styles.iosPickerActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setReminderTime(undefined);
                        setReminderOpen(false);
                      }}
                      style={styles.reminderClear}
                    >
                      <Text style={[styles.everyDayLabel, { color: theme.colors.textSecondary }]}>
                        Clear
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setReminderOpen(false)}
                      style={styles.pickerDoneText}
                    >
                      <Text style={[styles.everyDayLabel, { color: theme.colors.accent }]}>
                        Done
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )
          ) : null}
          {reminderTime ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove reminder"
              onPress={() => setReminderTime(undefined)}
              style={styles.reminderClearLink}
            >
              <Text style={[styles.everyDayLabel, { color: theme.colors.textSecondary }]}>
                Remove reminder
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: noteOpen }}
            accessibilityLabel="Add a note"
            onPress={() => setNoteOpen((open) => !open)}
            style={({ pressed }) => [
              styles.reminderButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>Add a note</Text>
            <Text style={[styles.reminderText, { color: theme.colors.textSecondary }]}>
              {targetDescription.trim() ? 'Added' : 'Optional'}
            </Text>
            <Lucide name={noteOpen ? 'chevron-up' : 'chevron-right'} size={18} color={theme.colors.textTertiary} />
          </Pressable>
          {noteOpen ? (
            <TextInput
              accessibilityLabel="Target description, optional"
              value={targetDescription}
              onChangeText={setTargetDescription}
              placeholder="e.g. Ten minutes after breakfast"
              placeholderTextColor={theme.colors.textTertiary}
              maxLength={120}
              multiline
              textAlignVertical="top"
              style={[
                styles.textInput,
                styles.multilineInput,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            />
          ) : null}
        </View>

        <View style={styles.formSpacer} />
        {!habitId && data.habits.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void addSuggestions()}
            style={({ pressed }) => [
              styles.suggestedButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <Lucide name="sparkles" size={17} color={theme.colors.accentStrong} />
            <Text style={[styles.suggestedButtonLabel, { color: theme.colors.accentStrong }]}>
              Add suggested habits
            </Text>
            <Lucide name="chevron-right" size={17} color={theme.colors.textSecondary} />
          </Pressable>
        ) : null}
        {!habitId && !lifetimeAccess ? (
          <Text style={[styles.freePlanHint, { color: theme.colors.textSecondary }]}>
            This will be your {nextFreeHabitNumber}{ordinalSuffix} of {FREE_ACTIVE_HABIT_LIMIT} free habits
          </Text>
        ) : null}

        {habitId ? (
          <View style={styles.managementActions}>
            {existingHabit?.active ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => setConfirmation('archive')}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  { borderColor: theme.colors.border, opacity: pressed || isSaving ? 0.65 : 1 },
                ]}
              >
                <Lucide name="archive" size={17} color={theme.colors.textSecondary} />
                <Text style={[styles.secondaryActionLabel, { color: theme.colors.textSecondary }]}>
                  Archive
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => setConfirmation('delete')}
              style={({ pressed }) => [
                styles.secondaryAction,
                { borderColor: theme.colors.danger, opacity: pressed || isSaving ? 0.65 : 1 },
              ]}
            >
              <Lucide name="trash-2" size={17} color={theme.colors.danger} />
              <Text style={[styles.secondaryActionLabel, { color: theme.colors.danger }]}>Delete</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.formActions}>
          {habitId ? (
            <Pressable
              accessibilityRole="button"
              onPress={cancel}
              style={({ pressed }) => [
                styles.cancelButton,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <Text style={[styles.cancelLabel, { color: theme.colors.text }]}>Cancel</Text>
            </Pressable>
          ) : null}
          <PrimaryButton
            label={habitId ? 'Save changes' : 'Save habit'}
            onPress={save}
            disabled={isSaving}
            loading={isSaving}
            style={styles.saveButton}
          />
        </View>
      </ScreenContainer>
      {habitId ? (
        <>
          <ConfirmationDialog
            visible={confirmation === 'archive'}
            title="Archive this habit?"
            description="It will leave your daily list. Past completions stay in your history, and reminders will no longer be active."
            confirmLabel="Archive habit"
            onConfirm={() => void confirmArchive()}
            onCancel={() => setConfirmation(null)}
          />
          <ConfirmationDialog
            visible={confirmation === 'delete'}
            title="Delete this habit permanently?"
            description="This permanently removes the habit and all of its completion history from this device. This cannot be undone."
            confirmLabel="Delete permanently"
            destructive
            onConfirm={() => void confirmDelete()}
            onCancel={() => setConfirmation(null)}
          />
        </>
      ) : null}
      <ConfirmationDialog
        visible={showFreeLimitDialog}
        title="You’ve reached your free habit limit"
        description={`The Free plan includes up to ${FREE_ACTIVE_HABIT_LIMIT} active habits. Explore Lifetime Premium to add more, or keep using your current habits.`}
        confirmLabel="Explore Premium"
        cancelLabel="Not now"
        onConfirm={() => {
          setShowFreeLimitDialog(false);
          router.push('/premium');
        }}
        onCancel={() => {
          setShowFreeLimitDialog(false);
          cancel();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: { flex: 1 },
  content: { paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md },
  formContent: { flexGrow: 1 },
  suggestedButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  suggestedButtonLabel: { flex: 1, fontSize: typography.footnote, fontWeight: '700' },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSpacer: { width: 48 },
  intro: { fontSize: typography.footnote, lineHeight: 20, marginTop: -spacing.md, marginLeft: 48 },
  previewCard: { minHeight: 72, padding: spacing.md, borderWidth: 1, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  previewIcon: { width: 44, height: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1, minWidth: 0, gap: 2 },
  previewName: { fontSize: typography.footnote, fontWeight: '700' },
  previewDetail: { fontSize: typography.caption },
  previewLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  fieldGroup: { gap: spacing.sm },
  label: { fontSize: typography.footnote, fontWeight: '700' },
  textInput: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.sm,
    fontSize: typography.footnote,
  },
  multilineInput: { minHeight: 92, paddingTop: spacing.md, paddingBottom: spacing.md },
  errorText: { fontSize: typography.footnote, lineHeight: 20 },
  iconGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  iconOption: { flex: 1, minWidth: 0, maxWidth: 44, height: 44, borderWidth: 1.5, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  colorOption: { width: 44, height: 44, borderWidth: 3, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  weekdayHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  everyDayLabel: { fontSize: typography.footnote, fontWeight: '600' },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  weekdayOption: { flex: 1, maxWidth: 44, minWidth: 0, height: 44, borderWidth: 1, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  weekdayText: { fontSize: typography.footnote, fontWeight: '600' },
  reminderButton: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radii.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reminderTitle: { flex: 1, fontSize: typography.footnote, fontWeight: '700' },
  reminderText: { fontSize: typography.caption },
  nativePicker: { overflow: 'hidden', alignItems: 'center', borderWidth: 1, borderRadius: radii.md },
  iosPickerActions: { width: '100%', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' },
  pickerDoneText: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  reminderClear: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  webTimePicker: { maxHeight: 320, padding: spacing.md, borderWidth: 1, borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  webTimeColumn: { flex: 1, minWidth: 100, gap: spacing.sm },
  webTimeLabel: { fontSize: typography.footnote, fontWeight: '600' },
  webTimeOptions: { maxHeight: 170, gap: spacing.xs, overflow: 'scroll' },
  webTimeOption: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.sm, justifyContent: 'center' },
  webMinuteOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  webMinuteOption: { width: 44, height: 40, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  webTimeActions: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerDone: { minWidth: 92, minHeight: 44 },
  formSpacer: { flexGrow: 1, minHeight: spacing.md },
  freePlanHint: { textAlign: 'center', fontSize: typography.caption, lineHeight: 18 },
  formActions: { marginTop: spacing.xs, flexDirection: 'row', gap: spacing.md },
  managementActions: { flexDirection: 'row', gap: spacing.md },
  secondaryAction: { minHeight: 48, paddingHorizontal: spacing.lg, borderWidth: 1, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  secondaryActionLabel: { fontSize: typography.footnote, fontWeight: '600' },
  operationError: { padding: spacing.md, borderRadius: radii.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cancelButton: { minHeight: 52, minWidth: 100, paddingHorizontal: spacing.lg, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { fontSize: typography.body, fontWeight: '600' },
  saveButton: { flex: 1, minHeight: 52, borderRadius: radii.pill },
  missingContent: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg },
  reminderClearLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
});
