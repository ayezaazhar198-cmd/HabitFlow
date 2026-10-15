const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidBillingLaunchMode(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const mainActivity = configWithManifest.modResults.manifest.application?.[0]?.activity?.find(
      (activity) => activity.$['android:name']?.endsWith('MainActivity'),
    );
    if (!mainActivity) {
      throw new Error('Unable to find MainActivity for RevenueCat billing configuration.');
    }

    mainActivity.$['android:launchMode'] = 'standard';
    return configWithManifest;
  });
};
