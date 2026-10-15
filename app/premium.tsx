import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import { ScreenContainer } from '../components/design-system';
import { FREE_ACTIVE_HABIT_LIMIT, PRICE_PKR, PRICE_USD } from '../data/premium';
import {
  getLifetimePackage,
  isPurchaseCancelled,
  isPurchasePending,
  lifetimeBillingConfigured,
  lifetimePurchaseRuntimeSupported,
} from '../data/purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import { useHabitStore } from '../data/habit-store';
import { radii, spacing, useTheme } from '../theme';

export default function PremiumScreen() {
  const { theme } = useTheme();
  const {
    habits,
    lifetimeAccess,
    refreshLifetimeAccess,
    purchaseLifetime,
  } = useHabitStore();
  const [lifetimePackage, setLifetimePackage] = useState<PurchasesPackage | null>(null);
  const [offerLoading, setOfferLoading] = useState(lifetimePurchaseRuntimeSupported);
  const [offerFailed, setOfferFailed] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [operation, setOperation] = useState<'purchase' | null>(null);
  const [message, setMessage] = useState<{ kind: 'pending' | 'error' | 'info'; text: string } | null>(
    null,
  );
  const operationLock = useRef(false);
  const [shimmerOpacity] = useState(() => new Animated.Value(0.45));
  const activeHabitCount = habits.filter((habit) => habit.active).length;
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const isPakistanLocale = /(?:^|[-_])PK(?:$|[-_])|(?:^|[-_])RG-PKZZZZ(?:$|[-_])/i.test(locale);
  const fallbackPrice = isPakistanLocale
    ? `Rs. ${PRICE_PKR.toLocaleString('en-US')}`
    : `$${PRICE_USD.toFixed(2)}`;
  const secondaryPrice = isPakistanLocale
    ? `≈ $${PRICE_USD.toFixed(2)} USD`
    : `≈ Rs. ${PRICE_PKR.toLocaleString('en-US')}`;
  const colors = theme.mode === 'light'
    ? {
        background: '#F4F8F5',
        text: '#12261E',
        secondary: '#3F574C',
        accent: '#0B6E4F',
        button: '#0B6E4F',
        surface: '#FFFFFF',
        border: '#DCE8E0',
        muted: '#E3EEE7',
        buttonText: '#FFFFFF',
      }
    : {
        background: '#09161B',
        text: '#F4F8F5',
        secondary: '#AFC4BF',
        accent: '#29D39F',
        button: '#29D39F',
        surface: '#10282B',
        border: '#1D3A3D',
        muted: '#10282B',
        buttonText: '#FFFFFF',
      };

  useEffect(() => {
    let mounted = true;
    async function loadOffer() {
      if (!lifetimePurchaseRuntimeSupported) return;
      setOfferLoading(true);
      setOfferFailed(false);
      try {
        const offer = await getLifetimePackage();
        if (mounted) setLifetimePackage(offer);
      } catch {
        if (mounted) setOfferFailed(true);
      } finally {
        if (mounted) setOfferLoading(false);
      }
    }

    void refreshLifetimeAccess()
      .then((hasAccess) => {
        if (mounted && hasAccess) router.replace('/today');
      })
      .catch(() => {
        if (mounted) setCheckingAccess(false);
      })
      .finally(() => {
        if (mounted) setCheckingAccess(false);
      });
    void loadOffer();
    return () => {
      mounted = false;
    };
  }, [refreshLifetimeAccess]);

  useEffect(() => {
    if (!offerLoading) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.9,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [offerLoading, shimmerOpacity]);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  }

  function finishUnlock() {
    close();
    Alert.alert("You're unlocked.", 'Add as many habits as you like.');
  }

  async function retryPrice() {
    if (!lifetimePurchaseRuntimeSupported || offerLoading) return;
    setOfferLoading(true);
    setOfferFailed(false);
    try {
      setLifetimePackage(await getLifetimePackage());
    } catch {
      setOfferFailed(true);
    } finally {
      setOfferLoading(false);
    }
  }

  async function beginPurchase() {
    if (!lifetimePackage || operationLock.current || !lifetimeBillingConfigured) return;
    operationLock.current = true;
    setOperation('purchase');
    setMessage(null);
    try {
      const purchased = await purchaseLifetime(lifetimePackage);
      if (purchased) finishUnlock();
      else {
        setMessage({
          kind: 'pending',
          text: 'Purchase is pending store confirmation. Access unlocks when confirmed.',
        });
      }
    } catch (error) {
      if (isPurchaseCancelled(error)) return;
      setMessage({
        kind: isPurchasePending(error) ? 'pending' : 'error',
        text: isPurchasePending(error)
          ? 'Purchase is pending store confirmation. Access unlocks when confirmed.'
          : "Couldn't complete the purchase. Please try again.",
      });
    } finally {
      operationLock.current = false;
      setOperation(null);
    }
  }

  if (checkingAccess || lifetimeAccess) return null;

  return (
    <ScreenContainer
      fillContent
      backgroundColor={colors.background}
      contentContainerStyle={styles.scrollContent}
      contentStyle={styles.content}
    >
      <View style={styles.topContent}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.accent }]}>HabitFlow Premium</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Premium"
            onPress={close}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: colors.muted, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Lucide name="x" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            LIFETIME ACCESS · PAY ONCE
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {'Track every habit.\nPay once.'}
          </Text>
          <Text style={[styles.description, { color: colors.secondary }]}>
            Your first 3 habits are free forever. Unlock unlimited habits with one payment. No
            subscription, no renewals.
          </Text>
        </View>

        <View
          style={[
            styles.planCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.planHeader}>
            <Text style={[styles.planTitle, { color: colors.text }]}>Free plan</Text>
            <Text style={[styles.planCount, { color: colors.text }]}>
              {activeHabitCount} of {FREE_ACTIVE_HABIT_LIMIT} habits used
            </Text>
          </View>
          <View style={styles.slots}>
            {Array.from({ length: FREE_ACTIVE_HABIT_LIMIT }, (_, index) => {
              const used = index < activeHabitCount;
              return (
                <View
                  key={index}
                  accessibilityLabel={used ? `Habit slot ${index + 1} used` : `Habit slot ${index + 1} empty`}
                  style={[
                    styles.slot,
                    {
                      backgroundColor: used ? colors.accent : 'transparent',
                      borderColor: used ? colors.accent : colors.border,
                    },
                  ]}
                >
                  {used ? <Lucide name="check" size={17} color="#FFFFFF" /> : null}
                </View>
              );
            })}
            <View
              accessibilityLabel="More habits with Lifetime access"
              style={[styles.moreSlot, { borderColor: colors.accent }]}
            >
              <Lucide name="infinity" size={19} color={colors.accent} />
              <Text style={[styles.moreLabel, { color: colors.accent }]}>more</Text>
            </View>
          </View>
        </View>

        <View style={styles.benefits}>
          <BenefitRow icon="plus" label="Unlimited active habits" colors={colors} />
          <BenefitRow icon="lock-keyhole" label="One payment. Yours for life." colors={colors} />
          <BenefitRow icon="star" label="Everything else stays free" colors={colors} />
        </View>
      </View>

      <View style={styles.actionArea}>
        <View style={styles.priceArea}>
          {offerLoading ? (
            <Animated.View
              accessibilityLabel="Loading store price"
              style={[
                styles.priceSkeleton,
                { backgroundColor: colors.muted, opacity: shimmerOpacity },
              ]}
            />
          ) : (
            <>
              <Text
                accessibilityLabel={`Price ${lifetimePackage?.product.priceString ?? fallbackPrice}, one-time`}
                style={[styles.price, { color: colors.text }]}
              >
                {lifetimePackage?.product.priceString ?? fallbackPrice} · One-time
              </Text>
              <Text style={[styles.priceFootnote, { color: colors.secondary }]}>
                {secondaryPrice}
              </Text>
              {lifetimePurchaseRuntimeSupported && offerFailed ? (
                <Text accessibilityRole="alert" style={[styles.priceError, { color: colors.secondary }]}>
                  {"Couldn't load price. Check your connection."}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {message ? (
          <Text
            accessibilityRole={message.kind === 'error' ? 'alert' : undefined}
            style={[
              styles.statusMessage,
              { color: message.kind === 'error' ? colors.secondary : colors.accent },
            ]}
          >
            {message.text}
          </Text>
        ) : null}

        {offerFailed ? (
          <PaywallButton
            label="Try again"
            onPress={() => void retryPrice()}
            colors={colors}
            disabled={offerLoading}
          />
        ) : lifetimePackage ? (
          <PaywallButton
            label={`Unlock for ${lifetimePackage.product.priceString}`}
            onPress={() => void beginPurchase()}
            colors={colors}
            disabled={!lifetimeBillingConfigured || operation !== null}
            loading={operation === 'purchase'}
          />
        ) : offerLoading ? (
          <PaywallButton
            label="Loading price"
            onPress={() => undefined}
            colors={colors}
            disabled
            loading
          />
        ) : (
          <PaywallButton
            label="Unlock in the app"
            onPress={() => undefined}
            colors={colors}
            disabled
          />
        )}

        {!lifetimePurchaseRuntimeSupported ? (
          <Text style={[styles.previewNote, { color: colors.secondary }]}>
            Purchases are available in the Android or iOS app.
          </Text>
        ) : null}

        <View style={styles.secondaryActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={close}
            style={({ pressed }) => [styles.textAction, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.notNowLabel, { color: colors.secondary }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

type PaywallColors = {
  text: string;
  secondary: string;
  accent: string;
  button: string;
  buttonText: string;
  muted: string;
};

function BenefitRow({
  icon,
  label,
  colors,
}: {
  icon: 'plus' | 'lock-keyhole' | 'star';
  label: string;
  colors: PaywallColors;
}) {
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.benefitIcon, { backgroundColor: colors.muted }]}>
        <Lucide name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={[styles.benefitText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function PaywallButton({
  label,
  onPress,
  colors,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  colors: PaywallColors;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.purchaseButton,
        {
          backgroundColor: disabled ? colors.muted : colors.button,
          opacity: pressed && !disabled ? 0.86 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={disabled ? colors.secondary : colors.buttonText} /> : null}
      <Text
        style={[
          styles.purchaseLabel,
          { color: disabled ? colors.secondary : colors.buttonText },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingTop: spacing.xs, paddingBottom: spacing.md },
  content: { flex: 1, justifyContent: 'space-between', gap: spacing.xl },
  topContent: { gap: spacing.lg },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  closeButton: { width: 44, height: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  intro: { gap: spacing.sm },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  title: { fontSize: 36, lineHeight: 39, fontWeight: '800', letterSpacing: -1.2 },
  description: { fontSize: 14, lineHeight: 20 },
  planCard: { borderWidth: 1, borderRadius: 20, padding: spacing.md, gap: spacing.md },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  planTitle: { fontSize: 14, fontWeight: '600' },
  planCount: { fontSize: 13, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  slots: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slot: { height: 44, flex: 1, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moreSlot: { height: 44, flex: 1.4, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  moreLabel: { fontSize: 13, fontWeight: '700' },
  benefits: { gap: spacing.md, paddingHorizontal: spacing.xs },
  benefitRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  benefitIcon: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  benefitText: { fontSize: 15, lineHeight: 21, fontWeight: '600', flexShrink: 1 },
  actionArea: { alignItems: 'stretch', gap: spacing.sm, paddingBottom: spacing.xs },
  priceArea: { minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  price: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.7 },
  priceSkeleton: { width: 138, height: 38, borderRadius: radii.sm },
  pricePlaceholder: { height: 38 },
  priceError: { fontSize: 14, lineHeight: 19, textAlign: 'center', fontWeight: '600' },
  priceFootnote: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  statusMessage: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  purchaseButton: { minHeight: 56, borderRadius: radii.pill, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  purchaseLabel: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  previewNote: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  secondaryActions: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  textAction: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  notNowLabel: { fontSize: 14, fontWeight: '600' },
});
