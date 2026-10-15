# HabitFlow Android testing and release

## Before building

- Replace `com.yourdomain.habitflow` in `app.json` with a reverse-domain identifier you control **before the first build or Play upload** (for example, `com.acme.habitflow`). Android and Google Play use it as the app's permanent identity; changing it later creates a different app and prevents upgrades over the existing installation.
- `HabitFlow` and version `1.0.0` / Android version code `1` are configured. Keep the version name for this release if desired; increment `android.versionCode` for each Play upload. Do not reuse a version code already uploaded to Play.
- The icon/adaptive icon use the existing files under `assets/`; the `expo-splash-screen` plugin configures the native splash with `assets/splash-icon.png`. Expo Go and debug builds may not show the final native splash exactly, so inspect a release APK on an Android device.
- Local notifications request only Android `POST_NOTIFICATIONS` at runtime. The Expo Notifications Android manifest also includes `RECEIVE_BOOT_COMPLETED` to restore scheduled local notifications after reboot. No exact-alarm, vibration, location, or background-remote-notification permission is requested.

## Manual Android checklist

Record device model, Android version, app version, and pass/fail for each item. These are manual checks; a successful typecheck or bundle export does not count as device verification.

### Startup and navigation

- [ ] Fresh install opens Today with the current local date, no fabricated habits, and a useful Add Habit action.
- [ ] Today, Statistics, History, and Settings tabs open and retain their selected state.
- [ ] With no habits, Today hides progress and its progress label; Statistics and History center their empty cards and each Add your first habit button opens the add flow on Today.
- [ ] Today has no Quick actions row; its Add a habit button is more prominent than Add suggested habits.
- [ ] Add Habit opens as a modal; Cancel returns without adding data; system Back works.
- [ ] No route errors appear when opening an archived habit from Settings or a deleted/missing habit URL.

### Habit lifecycle

- [ ] Add a habit with a non-empty name, icon, accent, selected weekdays, optional description, and no reminder.
- [ ] Whitespace-only name shows an inline validation error and does not save; invalid/empty weekday selection cannot be saved.
- [ ] Add a reminder time; permission is requested only for this explicit reminder action. Denial leaves the form open with an explanation and does not silently claim a reminder was set.
- [ ] Edit name, icon, color, schedule, target, and reminder; cancel an edit and confirm values were not changed.
- [ ] Archive a habit after confirmation; it disappears from Today, keeps past records, and no longer notifies. Restore it and verify it can be completed again.
- [ ] Delete a habit only after the explicit confirmation; verify the confirmation explains that its completion history is erased.
- [ ] Tap completion repeatedly; verify the final saved status, daily progress, and streak agree, and completing a habit gives light haptic/check feedback.
- [ ] Complete and uncomplete a historical scheduled day only after entering History's explicit edit mode. Unscheduled, pre-creation, and future dates are not marked as failures or editable completions.

### Persistence, dates, and insights

- [ ] Force-stop and reopen after adding habits and completions; verify local data remains.
- [ ] Check selected weekdays on a week boundary and inspect streak behavior for an incomplete current day.
- [ ] Check Statistics for the current week and a week crossing a month/year; the denominator counts eligible scheduled habit-days through today only.
- [ ] Navigate History months, inspect a selected date, and check future dates are unavailable.
- [ ] Choose Light and Dark appearance; restart and verify the selected preference is retained. A saved legacy System setting should migrate to Light.
- [ ] Premium is hidden with no habits, visible after the first habit, and most prominent at the three-active-habit Free limit.

### Reminders and reset

- [ ] Enable reminders when prompted; confirm one weekly reminder per selected weekday at the local time, with no duplicates after repeated saves/restarts.
- [ ] Verify Settings presents Habit reminders as a one-line description with a toggle; permission denial keeps reminders off and shows a friendly explanation.
- [ ] Change reminder time/weekdays and verify old reminders are replaced; disable global reminders, archive, and delete and verify HabitFlow reminders are cancelled.
- [ ] Deny permission, then enable permission from Android Settings and retry. The app must show an error rather than claim reminders are active while blocked.
- [ ] Reboot the device and verify scheduled reminders are restored by Android.
- [ ] Reset all data only after confirmation; verify habits, completions, theme/reminder preferences, and HabitFlow-managed notifications are cleared.

### Small-screen/accessibility pass

- [ ] Test a narrow/short Android device with the keyboard open; scroll to Save/Cancel and ensure fields are not obscured.
- [ ] Confirm the bottom tabs do not cover the final screen action and system safe areas are respected.
- [ ] Check TalkBack labels/states for completion checkboxes, weekday/icon/color choices, settings switches, and confirmation buttons.
- [ ] Check light and dark contrast, text scaling, and touch targets for the main controls.

## Build and install

Requires an Expo account and EAS Build access. The first EAS project setup may add a `projectId` to app configuration; review that generated change. EAS-managed Android signing credentials are private to the account and should remain in EAS; never commit keystores or credentials.

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile preview
```

The `development` profile creates a development-client APK for iterative notification testing; install it from the EAS build link, then start the bundler with `npx expo start --dev-client`. The `preview` profile creates a standalone installable APK. After downloading an APK to a USB-debug-enabled device or emulator, install with:

```powershell
adb install -r .\habitflow-preview.apk
```

Local notifications are available in Expo Go according to the SDK 57 documentation, but Expo Go does not prove behavior for this app's generated Android manifest, channel, splash, or release binary. Verify them on the development/preview APK. For a local native build instead, install Android Studio/SDK and run `npx expo run:android`; this environment has not confirmed a local Android SDK or device.

## Google Play App Bundle

```powershell
npx eas-cli@latest build --platform android --profile production
```

The `production` profile requests an AAB. The build is not performed by this setup step. When EAS reports completion, download the `.aab`, create/configure the app in Google Play Console, and upload it to an internal or closed testing track before promoting it as appropriate. Do not upload until the package identifier is final.

## Lifetime Premium billing setup and testing

HabitFlow uses `react-native-purchases` (RevenueCat) for Google Play Billing. The SDK is included in the project, and the paywall checks the verified RevenueCat `lifetime_unlock` entitlement before allowing more than three active habits. Purchases are **not ready for real checkout** until the store and RevenueCat dashboard have been configured and tested:

1. Set the final `android.package` in `app.json` before publishing; it must match the Android app registered in Play Console and RevenueCat.
2. In Google Play Console, create a **non-consumable one-time product** for lifetime access. Set the country-specific store prices there (for example, approximately PKR 1,000 and USD 3.99–4.99 where supported). Do not create a subscription.
3. Link the Play app to RevenueCat and import the product. Create the `lifetime_unlock` entitlement, attach the product, then add it to a package of type **Lifetime** in the current offering.
4. Configure the RevenueCat Android **public SDK key** as `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. For EAS, set it in the build environment used for development builds. For local development, use an ignored local environment file. These public SDK keys are safe to bundle; never put RevenueCat secret/server API keys or Play service-account credentials in the client or repository.
5. Build and install a new development client; Expo Go does not include the native billing module:

   ```powershell
   npx eas-cli@latest build --platform android --profile development
   npx expo start --dev-client
   ```

6. Publish the app to an internal Play testing track, add a Play license tester, and install the app through the Play test link. Test a successful purchase, cancellation, pending approval, offline/store failure, and restore on a second install using the same store account. Verify access unlocks only after RevenueCat returns the active entitlement.

The paywall displays the localized price string returned by the configured RevenueCat package. Missing keys/offers produce an explicit setup message; no hardcoded price or local “paid” flag grants access. Habit data continues to be stored locally.

RevenueCat documents that Google Play may switch to a banking/verification app during checkout. The config plugin `plugins/with-android-billing-launch-mode.js` sets the generated MainActivity launch mode to `standard` to avoid cancelling those purchases. Native Android files remain generated by Expo; regenerate the development build after changing this configuration.

### Manual free-limit and purchase checks

- [ ] Create three active habits as a free user; a fourth attempt opens Premium and does not save a habit.
- [ ] Archive one habit and verify a free user can add another; restore it when already at the limit and verify Premium opens without altering history.
- [ ] Verify a RevenueCat-confirmed lifetime entitlement permits more than three active habits, including after restarting the app.
- [ ] Complete a test purchase and restore it; verify a button tap alone, a pending transaction, or a failed restore never grants access.

Before submission, complete the Play listing (title, short/full descriptions, icon, phone screenshots and any required tablet/feature graphics), app access instructions if applicable, content rating, target audience, ads declaration, Data safety and privacy policy disclosures, and required app-content forms. Declare local on-device storage and notification behavior accurately; no account or remote HabitFlow backend is implemented. New personal developer accounts may have a required closed test before production access; follow the current requirement shown in Play Console for the account and verify current Google policy rather than treating an older tester count as universal.

EAS Submit is not configured because it requires the app's Google Play service-account credentials and Play Console setup. Never commit those credentials. AAB upload through Play Console is the configured manual path.
