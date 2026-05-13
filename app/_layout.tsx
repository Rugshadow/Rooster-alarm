import '../global.css';
import '../lib/i18n';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import notifee, { EventType, AndroidNotificationSetting } from '@notifee/react-native';
import { NativeModules, DeviceEventEmitter, AppState } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const { IntentData } = NativeModules;
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { AlarmsProvider, useAlarmsContext } from '../contexts/AlarmsContext';
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
  const { deactivateByChannelId } = useAlarmsContext();
  const [ringingAlarm, setRingingAlarm] = useState<RingingAlarm | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try { await NavigationBar.setVisibilityAsync('hidden'); } catch {}
      await setupNotificationChannel();

      // Handle alarm that opened the app via native AlarmReceiver
      if (IntentData) {
        const alarmData = await IntentData.getAlarmData();
        console.log('[layout] getAlarmData on init:', JSON.stringify(alarmData));
        if (alarmData?.channelId) setRingingAlarm(alarmData as RingingAlarm);
      }

      // Hide splash — app is ready
      SplashScreen.hideAsync().catch(() => {});

      // Permission checks fire-and-forget after splash is gone
      notifee.requestPermission();
      notifee.getNotificationSettings().then(settings => {
        if (settings.android?.alarm !== AndroidNotificationSetting.ENABLED) {
          notifee.openAlarmPermissionSettings();
        }
      });
      if (IntentData?.isIgnoringBatteryOptimizations) {
        IntentData.isIgnoringBatteryOptimizations().then((ignoring: boolean) => {
          console.log('[layout] isIgnoringBatteryOptimizations:', ignoring);
          if (!ignoring) IntentData.requestIgnoreBatteryOptimizations().catch(() => {});
        });
      }
      if (IntentData?.canUseFullScreenIntent) {
        IntentData.canUseFullScreenIntent().then((canUse: boolean) => {
          console.log('[layout] canUseFullScreenIntent:', canUse);
          if (!canUse) IntentData.openFullScreenIntentSettings().catch(() => {});
        });
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
          setRingingAlarm(prev => prev?.channelId === alarmData.channelId ? prev : alarmData as RingingAlarm);
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
          setRingingAlarm(prev => prev?.channelId === alarmData.channelId ? prev : alarmData as RingingAlarm);
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
        onDismiss={() => {
          if (ringingAlarm) deactivateByChannelId(ringingAlarm.channelId);
          setRingingAlarm(null);
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AlarmsProvider>
          <AppBootstrap>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth/login" />
              <Stack.Screen name="auth/login-email" />
              <Stack.Screen name="auth/signup" />
              <Stack.Screen name="auth/callback" />
              <Stack.Screen name="auth/create-username" />
            </Stack>
          </AppBootstrap>
        </AlarmsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
