import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Lucide, { type LucideIconName } from '@react-native-vector-icons/lucide';
import { radii, spacing, typography, useTheme } from '../theme';

const ringSegments = Array.from({ length: 36 }, (_, index) => index);

type ScreenContainerProps = ScrollViewProps & {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  fillContent?: boolean;
};

export function ScreenContainer({
  children,
  contentContainerStyle,
  contentStyle,
  backgroundColor,
  fillContent = false,
  ...scrollViewProps
}: ScreenContainerProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[
        styles.screen,
        { backgroundColor: backgroundColor ?? theme.colors.background },
      ]}
    >
      <ScrollView
        {...scrollViewProps}
        contentContainerStyle={[
          styles.screenContent,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.contentWidth,
            fillContent ? styles.contentFill : undefined,
            contentStyle,
          ]}
        >
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIconName;
  accessibilityHint?: string;
  labelColor?: string;
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  labelColor,
  style,
}: PrimaryButtonProps) {
  const { theme } = useTheme();
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: unavailable
            ? theme.colors.textTertiary
            : theme.colors.accent,
          opacity: pressed && !unavailable ? 0.86 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.accentOn} />
      ) : (
        <>
          {icon ? <Lucide name={icon} size={18} color={theme.colors.accentOn} /> : null}
          <Text style={[styles.primaryButtonLabel, { color: labelColor ?? theme.colors.accentOn }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

type HabitCardProps = {
  title: string;
  detail?: string;
  icon: LucideIconName;
  completed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  accentColor?: string;
  streak?: number;
  reminderTime?: string;
  onEdit?: () => void;
  compactToday?: boolean;
};

export function HabitCard({
  title,
  detail,
  icon,
  completed,
  onToggle,
  disabled = false,
  accentColor,
  streak,
  reminderTime,
  onEdit,
  compactToday = false,
}: HabitCardProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [checkScale] = useState(() => new Animated.Value(completed ? 1 : 0.72));

  useEffect(() => {
    if (completed) {
      checkScale.setValue(0.72);
      Animated.spring(checkScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 220,
      }).start();
    }
  }, [checkScale, completed]);
  const todayIconBackground = accentColor?.match(/^#[\da-f]{6}$/i)
    ? `${accentColor}24`
    : theme.colors.surfaceMuted;

  return (
    <View
      style={[
        styles.habitCard,
        compact ? styles.habitCardCompact : undefined,
        compactToday ? styles.todayHabitCard : undefined,
        {
          backgroundColor:
            compactToday || !completed ? theme.colors.surface : theme.colors.accentSoft,
          borderColor:
            compactToday || !completed ? theme.colors.border : theme.colors.accent,
        },
      ]}
    >
      <View
        style={[
          styles.habitIcon,
          compact ? styles.habitIconCompact : undefined,
          compactToday ? styles.todayHabitIcon : undefined,
          {
            backgroundColor: compactToday
              ? todayIconBackground
              : completed
                ? theme.colors.accentSoft
                : theme.colors.surfaceMuted,
          },
        ]}
      >
        <Lucide
          name={icon}
          size={20}
          color={
            compactToday
              ? accentColor ?? theme.colors.accentStrong
              : completed
                ? theme.colors.accentStrong
                : accentColor ?? theme.colors.textSecondary
          }
        />
      </View>
      <View style={styles.habitText}>
        <Text
          style={[
            styles.habitTitle,
            compactToday ? styles.todayHabitTitle : undefined,
            {
              color: theme.colors.text,
              textDecorationLine: 'none',
            },
          ]}
        >
          {title}
        </Text>
        {compactToday ? (
          (typeof streak === 'number' && streak > 0) || reminderTime ? (
            <View style={styles.todayHabitMeta}>
              {typeof streak === 'number' && streak > 0 ? (
                <View
                  accessibilityLabel={`${streak}-day streak`}
                  style={styles.todayStreakBadge}
                >
                  <Lucide name="flame" size={12} color={theme.colors.peach} />
                  <Text
                    style={[
                      styles.streakLabel,
                      { color: theme.colors.peach },
                    ]}
                  >
                    {streak}-day streak
                  </Text>
                </View>
              ) : null}
              {reminderTime ? (
                <View style={styles.todayReminder}>
                  <Lucide name="clock-3" size={12} color={theme.colors.textSecondary} />
                  <Text style={[styles.todayReminderLabel, { color: theme.colors.textSecondary }]}>
                    {reminderTime}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null
        ) : detail || typeof streak === 'number' ? (
          <View style={styles.habitMeta}>
            {typeof streak === 'number' && streak > 0 ? (
              <View
                accessibilityLabel={`${streak}-day streak`}
                style={[styles.streakBadge, { backgroundColor: theme.colors.surfaceMuted }]}
              >
                <Lucide name="flame" size={13} color={theme.colors.accentStrong} />
                <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
                  {streak}d
                </Text>
              </View>
            ) : null}
            {detail ? (
              <Text style={[styles.habitDetail, { color: theme.colors.textSecondary }]}>
                {detail}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={title}
        accessibilityHint={completed ? 'Mark this habit as not done' : 'Mark this habit as done'}
        accessibilityState={{ checked: completed, disabled }}
        disabled={disabled}
        onPress={onToggle}
        hitSlop={4}
        style={({ pressed }) => [
          styles.habitToggle,
          compact ? styles.habitToggleCompact : undefined,
          compactToday ? styles.todayHabitToggle : undefined,
          {
            backgroundColor: completed ? theme.colors.accent : 'transparent',
            borderColor: completed ? theme.colors.accent : theme.colors.border,
            opacity: pressed && !disabled ? 0.78 : 1,
          },
        ]}
      >
        {completed ? (
          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
            <Lucide name="check" size={17} color={theme.colors.accentOn} />
          </Animated.View>
        ) : null}
      </Pressable>
      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${title}`}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.habitEdit,
            compact ? styles.habitEditCompact : undefined,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Lucide name="pencil" size={17} color={theme.colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

type ProgressRingProps = {
  value: number;
  max: number;
  label?: string;
  size?: number;
  showCaption?: boolean;
  accentColor?: string;
  trackColor?: string;
  valueColor?: string;
};

export function ProgressRing({
  value,
  max,
  label,
  size = 96,
  showCaption = true,
  accentColor,
  trackColor,
  valueColor,
}: ProgressRingProps) {
  const { theme } = useTheme();
  const safeMax = Math.max(0, max);
  const safeValue = Math.min(Math.max(value, 0), safeMax);
  const filledSegments =
    safeMax === 0 ? 0 : Math.round((safeValue / safeMax) * ringSegments.length);
  const centerLabel = label ?? `${safeValue}/${safeMax}`;
  const radius = size / 2 - 4;
  const dotSize = Math.max(4, size * 0.105);
  const accessibilityValue = safeMax === 0 ? 0 : Math.round((safeValue / safeMax) * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Daily habit progress"
      accessibilityValue={{ min: 0, max: 100, now: accessibilityValue }}
      style={{ width: size, height: size }}
    >
      {ringSegments.map((segment) => {
        const angle = (segment / ringSegments.length) * Math.PI * 2 - Math.PI / 2;
        const left = size / 2 + Math.cos(angle) * radius - dotSize / 2;
        const top = size / 2 + Math.sin(angle) * radius - dotSize / 2;
        return (
          <View
            key={segment}
            style={{
              position: 'absolute',
              left,
              top,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor:
                segment < filledSegments
                  ? accentColor ?? theme.colors.accent
                  : trackColor ?? theme.colors.border,
            }}
          />
        );
      })}
      <View style={styles.ringCenter}>
        <Text style={[styles.ringValue, { color: valueColor ?? theme.colors.text }]}>{centerLabel}</Text>
        {showCaption ? (
          <Text style={[styles.ringCaption, { color: theme.colors.textSecondary }]}>done</Text>
        ) : null}
      </View>
    </View>
  );
}

type SectionHeaderProps = {
  title: string;
  detail?: string;
  style?: ViewStyle;
};

export function SectionHeader({ title, detail, style }: SectionHeaderProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {detail ? (
        <Text style={[styles.sectionDetail, { color: theme.colors.textSecondary }]}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIconName;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  icon = 'leaf',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.emptyState,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.accentSoft }]}>
        <Lucide name={icon} size={24} color={theme.colors.accentStrong} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} icon="plus" onPress={onAction} />
      ) : null}
    </View>
  );
}

type ErrorStateProps = {
  title: string;
  description: string;
  onRetry?: () => void;
};

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.emptyState,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Lucide name="triangle-alert" size={24} color={theme.colors.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
        {description}
      </Text>
      {onRetry ? (
        <PrimaryButton label="Try again" icon="refresh-cw" onPress={onRetry} />
      ) : null}
    </View>
  );
}

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'Loading your habits' }: LoadingStateProps) {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={styles.loadingState}
    >
      <ActivityIndicator color={theme.colors.accent} size="small" />
      <Text style={[styles.loadingLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
};

export function ConfirmationDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmationDialogProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const destructiveButtonStyle: ViewStyle | undefined = destructive
    ? { backgroundColor: theme.colors.text }
    : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={[styles.dialogBackdrop, { backgroundColor: theme.colors.overlay }]}>
        <View
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={[
            styles.dialog,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.dialogTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.dialogDescription, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
          <View
            style={[
              styles.dialogActions,
              compact ? styles.dialogActionsCompact : undefined,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.dialogCancel,
                compact ? styles.dialogButtonCompact : undefined,
                { backgroundColor: theme.colors.surfaceMuted, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.dialogActionLabel, { color: theme.colors.text }]}>
                {cancelLabel}
              </Text>
            </Pressable>
            <PrimaryButton
              label={confirmLabel}
              onPress={onConfirm}
              style={
                compact
                  ? { ...styles.dialogButtonCompact, ...destructiveButtonStyle }
                  : destructiveButtonStyle
              }
              labelColor={destructive ? theme.colors.background : undefined}
              accessibilityHint={destructive ? 'This action cannot be undone' : undefined}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['4xl'] + 16,
    alignItems: 'center',
  },
  contentWidth: {
    width: '100%',
    maxWidth: 560,
  },
  contentFill: { flex: 1 },
  primaryButton: {
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonLabel: {
    fontSize: typography.body,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  habitCard: {
    minHeight: 88,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 1,
  },
  habitCardCompact: { padding: spacing.md, gap: spacing.sm },
  todayHabitCard: { minHeight: 66, padding: 10, borderRadius: radii.lg, gap: spacing.sm, elevation: 0, shadowOpacity: 0 },
  habitIcon: {
    width: 50,
    height: 50,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitIconCompact: { width: 42, height: 42 },
  todayHabitIcon: { width: 40, height: 40, borderRadius: radii.pill },
  habitText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  habitTitle: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  todayHabitTitle: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  habitDetail: {
    fontSize: typography.footnote,
  },
  habitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  todayHabitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  todayStreakBadge: {
    minHeight: 20,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  todayReminder: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 3 },
  todayReminderLabel: { fontSize: 11, fontWeight: '600' },
  streakBadge: {
    minHeight: 22,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  habitToggle: {
    width: 48,
    height: 48,
    borderWidth: 1.5,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitToggleCompact: { width: 44, height: 44 },
  todayHabitToggle: { width: 44, height: 44, borderWidth: 1.5 },
  habitEdit: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitEditCompact: { width: 40, height: 44 },
  sectionHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.footnote,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  sectionDetail: {
    fontSize: typography.footnote,
  },
  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  ringValue: {
    fontSize: typography.title,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  ringCaption: {
    fontSize: typography.caption,
  },
  emptyState: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    borderRadius: radii.xl,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
  },
  loadingState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingLabel: {
    fontSize: typography.footnote,
  },
  dialogBackdrop: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    padding: spacing['2xl'],
    borderWidth: 1,
    borderRadius: radii.xl,
    gap: spacing.md,
  },
  dialogTitle: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  dialogDescription: {
    fontSize: typography.body,
    lineHeight: 24,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  dialogActionsCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  dialogButtonCompact: { width: '100%' },
  dialogCancel: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogActionLabel: {
    fontSize: typography.body,
    fontWeight: '600',
  },
});
