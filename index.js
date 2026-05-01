import notifee from '@notifee/react-native';

// Required: handle notification events when app is killed/background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  // fullScreenAction handles auto-launch; nothing extra needed here
});

import 'expo-router/entry';
