import '../global.css';
import '../lib/i18n';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import notifee, { EventType, AndroidNotificationSetting } from '@notifee/react-native';
import { NativeModules, DeviceEventEmitter, AppState} from 'react-native';
import { Text } from '../components/Text';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, NotoSerif_400Regular } from '@expo-google-fonts/noto-serif';


SplashScreen.preventAutoHideAsync();

const { IntentData } = NativeModules;
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AlarmsProvider, useAlarmsContext } from '../contexts/AlarmsContext';
import { setupNotificationChannel } from '../lib/alarmScheduler';
import { syncOfflineAudio, syncHeardAudioToSupabase } from '../lib/offlineAudio';
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
  const { session } = useAuth();
  const [ringingAlarm, setRingingAlarm] = useState<RingingAlarm | null>(null);
  const initialized = useRef(false);
  const ringingAlarmRef = useRef<RingingAlarm | null>(null);

  // Keep ref in sync so polling closure doesn't go stale
  useEffect(() => { ringingAlarmRef.current = ringingAlarm; }, [ringingAlarm]);

  // Listeners — always set up on mount (no initialized guard) so fast-refresh
  // in dev and any remount don't silently drop them.
  useEffect(() => {
    // Handle alarm when app is already running (onNewIntent / AlarmService path).
    // Data is embedded directly in the event — no async getAlarmData race.
    const alarmSub = DeviceEventEmitter.addListener('RoosterAlarmFired', (data: { channelId: string; channelName: string; channelImageUrl: string } | null) => {
      console.log('[layout] RoosterAlarmFired received', JSON.stringify(data));
      const channelId = data?.channelId;
      if (channelId) {
        const alarm: RingingAlarm = {
          channelId,
          channelName: data?.channelName ?? 'Alarm',
          channelImageUrl: data?.channelImageUrl || undefined,
        };
        setRingingAlarm(prev => prev?.channelId === channelId ? prev : alarm);
      }
    });

    // AppState: covers the case where app was in background and is brought to front.
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      console.log('[layout] AppState changed to:', nextState);
      if (nextState === 'active') {
        if (session?.user.id) {
          syncHeardAudioToSupabase(session.user.id).catch(() => {});
        }
        if (IntentData) {
          const alarmData = await IntentData.getAlarmData();
          console.log('[layout] AppState active getAlarmData:', JSON.stringify(alarmData));
          if (alarmData?.channelId) {
            console.log('[layout] alarm detected via AppState active:', alarmData.channelId);
            setRingingAlarm(prev => prev?.channelId === alarmData.channelId ? prev : alarmData as RingingAlarm);
          }
        }
      }
    });

    // Polling fallback: catches alarms when the app is in the foreground
    // (AppState never changes) and the RoosterAlarmFired event was missed.
    // Calls getAlarmData directly — safe because it only consumes data when present.
    const poll = setInterval(async () => {
      if (ringingAlarmRef.current || !IntentData?.getAlarmData) return;
      const alarmData = await IntentData.getAlarmData();
      if (alarmData?.channelId) {
        console.log('[layout] alarm detected via poll:', alarmData.channelId);
        setRingingAlarm(alarmData as RingingAlarm);
      }
    }, 500);

    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.DELIVERED || type === EventType.PRESS) {
        const alarm = extractAlarm(detail.notification?.data);
        if (alarm) setRingingAlarm(alarm);
      }
    });

    return () => { unsub(); alarmSub.remove(); appStateSub.remove(); clearInterval(poll); };
  }, []);

  // One-time startup init — guarded so it only runs on the first mount.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try { await NavigationBar.setVisibilityAsync('hidden'); } catch {}
      await setupNotificationChannel();
      syncOfflineAudio().catch(() => {}); // fire-and-forget

      // Handle alarm that cold-started the app via native AlarmReceiver
      if (IntentData) {
        const alarmData = await IntentData.getAlarmData();
        console.log('[layout] getAlarmData on init:', JSON.stringify(alarmData));
        if (alarmData?.channelId) setRingingAlarm(alarmData as RingingAlarm);
      }

      SplashScreen.hideAsync().catch(() => {});

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
      // "Draw over other apps" provides an unconditional background activity launch
      // exemption — without it, startActivity from AlarmReceiver may be silently denied
      // on Android 12+ when the screen is on.
      if (IntentData?.canDrawOverlays) {
        IntentData.canDrawOverlays().then((canDraw: boolean) => {
          console.log('[layout] canDrawOverlays:', canDraw);
          if (!canDraw) IntentData.openOverlaySettings().catch(() => {});
        });
      }
    })();
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
  const [fontsLoaded] = useFonts({ NotoSerif_400Regular });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
