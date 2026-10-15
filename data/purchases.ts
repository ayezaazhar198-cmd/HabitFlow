import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

export const LIFETIME_ENTITLEMENT_ID = 'lifetime_unlock';

const revenueCatApiKey =
  Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
    : Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : undefined;

export const lifetimePurchaseRuntimeSupported =
  (Platform.OS === 'android' || Platform.OS === 'ios') &&
  !isRunningInExpoGo();

export const lifetimeBillingConfigured =
  lifetimePurchaseRuntimeSupported && Boolean(revenueCatApiKey);

let purchasesPromise:
  | Promise<typeof import('react-native-purchases').default>
  | undefined;

function getConfigurationError() {
  if (isRunningInExpoGo()) {
    return new Error(
      'Purchases require a HabitFlow development build. Expo Go does not include Google Play Billing.',
    );
  }
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return new Error('In-app purchases are available in the Android or iOS app.');
  }
  return new Error(
    `RevenueCat is not configured. Set the ${Platform.OS === 'android' ? 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY' : 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'} public SDK key and configure the lifetime product.`,
  );
}

async function getPurchases() {
  if (!lifetimeBillingConfigured || !revenueCatApiKey) {
    throw getConfigurationError();
  }

  if (!purchasesPromise) {
    purchasesPromise = import('react-native-purchases')
      .then(async ({ default: Purchases }) => {
        if (!(await Purchases.isConfigured())) {
          Purchases.configure({ apiKey: revenueCatApiKey });
        }
        return Purchases;
      })
      .catch((error: unknown) => {
        purchasesPromise = undefined;
        throw error;
      });
  }
  return purchasesPromise;
}

export async function hasLifetimeAccess(): Promise<boolean> {
  if (!lifetimeBillingConfigured) return false;
  const Purchases = await getPurchases();
  const customerInfo = await Purchases.getCustomerInfo();
  return Boolean(customerInfo.entitlements.active[LIFETIME_ENTITLEMENT_ID]);
}

export async function getLifetimePackage(): Promise<PurchasesPackage> {
  const Purchases = await getPurchases();
  const offerings = await Purchases.getOfferings();
  const lifetimePackage = offerings.current?.availablePackages.find(
    (item) => item.packageType === Purchases.PACKAGE_TYPE.LIFETIME,
  );
  if (!lifetimePackage) {
    throw new Error(
      'The lifetime offer is not available yet. Check the RevenueCat offering and lifetime product configuration.',
    );
  }
  return lifetimePackage;
}

export async function purchaseLifetime(
  lifetimePackage: PurchasesPackage,
): Promise<boolean> {
  const Purchases = await getPurchases();
  const { customerInfo } = await Purchases.purchasePackage(lifetimePackage);
  return Boolean(customerInfo.entitlements.active[LIFETIME_ENTITLEMENT_ID]);
}

export async function restoreLifetimePurchase(): Promise<boolean> {
  const Purchases = await getPurchases();
  const customerInfo = await Purchases.restorePurchases();
  return Boolean(customerInfo.entitlements.active[LIFETIME_ENTITLEMENT_ID]);
}

export function isPurchaseCancelled(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return 'userCancelled' in error && error.userCancelled === true;
}

export function isPurchasePending(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return typeof error.code === 'string' && error.code.toUpperCase().includes('PENDING');
}
