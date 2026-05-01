import '../global.css';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import notifee, { EventType, AndroidNotificationSetting } from '@notifee/react-native';
import { NativeModules, DeviceEventEmitter, AppState } from 'react-native';

const { IntentData } = NativeModules;
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { setupNotificationChannel } from '../lib/alarmScheduler';
import AlarmRingingModal from '../components/AlarmRingingModal';

type RingingAlarm = { channelId: string; channelName: string; channelImageUrl?: string };

function extractAlarm(data: Record<string, any> | undefined): RingingAlarm | null {
  if (!data?.channelId) return null;
  return {
    channelId: data.channelId as string,
    channelName: (data.channelName as string) ?? 'Alarm',
    channelImageUrl: (data.channelImageUrl as string) || undefined,
  };
}

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ringingAlarm, setRingingAlarm] = useState<RingingAlarm | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try { await NavigationBar.setVisibilityAsync('hidden'); } catch {}
      await setupNotificationChannel();

      // Request notification + exact alarm permissions
      await notifee.requestPermission();
      const settings = await notifee.getNotificationSettings();
      if (settings.android?.alarm !== AndroidNotificationSetting.ENABLED) {
        await notifee.openAlarmPermissionSettings();
      }

      // Request battery optimization exclusion (critical for alarm reliability on Samsung)
      if (IntentData?.isIgnoringBatteryOptimizations) {
        const ignoring = await IntentData.isIgnoringBatteryOptimizations();
        console.log('[layout] isIgnoringBatteryOptimizations:', ignoring);
        if (!ignoring) await IntentData.requestIgnoreBatteryOptimizations().catch(() => {});
      }

      // Request USE_FULL_SCREEN_INTENT permission (Android 14+)
      if (IntentData?.canUseFullScreenIntent) {
        const canUse = await IntentData.canUseFullScreenIntent();
        console.log('[layout] canUseFullScreenIntent:', canUse);
        if (!canUse) await IntentData.openFullScreenIntentSettings().catch(() => {});
      }

      // Handle alarm that opened the app via native AlarmReceiver
      if (IntentData) {
        const alarmData = await IntentData.getAlarmData();
        console.log('[layout] getAlarmData on init:', JSON.stringify(alarmData));
        if (alarmData?.channelId) setRingingAlarm(alarmData as RingingAlarm);
      }
    })();

    // Handle alarm while app is in foreground
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.DELIVERED || type === EventType.PRESS) {
        const alarm = extractAlarm(detail.notification?.data);
        if (alarm) setRingingAlarm(alarm);
      }
    });

    // Handle alarm when app is already running (onNewIntent path)
    const alarmSub = DeviceEventEmitter.addListener('PeaceAlarmFired', async () => {
      console.log('[layout] PeaceAlarmFired event received');
      if (IntentData) {
        const alarmData = await IntentData.getAlarmData();
        console.log('[layout] getAlarmData on PeaceAlarmFired:', JSON.stringify(alarmData));
        if (alarmData?.channelId) {
          console.log('[layout] setting ringing alarm from PeaceAlarmFired');
          setRingingAlarm(alarmData as RingingAlarm);
        }
      }
    });

    // Primary alarm trigger: AlarmService calls startActivity → app comes to foreground → AppState fires
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      console.log('[layout] AppState changed to:', nextState);
      if (nextState === 'active' && IntentData) {
        const alarmData = await IntentData.getAlarmData();
        console.log('[layout] AppState active getAlarmData:', JSON.stringify(alarmData));
        if (alarmData?.channelId) {
          console.log('[layout] alarm detected via AppState active:', alarmData.channelId);
          setRingingAlarm(alarmData as RingingAlarm);
        }
      }
    });

    return () => { unsub(); alarmSub.remove(); appStateSub.remove(); };
  }, []);

  return (
    <>
      {children}
      <AlarmRingingModal
        visible={!!ringingAlarm}
        channelId={ringingAlarm?.channelId ?? ''}
        channelName={ringingAlarm?.channelName ?? ''}
        channelImageUrl={ringingAlarm?.channelImageUrl}
        onDismiss={() => setRingingAlarm(null)}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppBootstrap>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/login-email" />
            <Stack.Screen name="auth/signup" />
            <Stack.Screen name="auth/callback" />
          </Stack>
        </AppBootstrap>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
