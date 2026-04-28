import '../global.css';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { setupNotificationChannel } from '../lib/alarmScheduler';
import AlarmRingingModal from '../components/AlarmRingingModal';

// Show notifications even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type RingingAlarm = { channelId: string; channelName: string; channelImageUrl?: string };

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const [ringingAlarm, setRingingAlarm] = useState<RingingAlarm | null>(null);

  useEffect(() => {
    (async () => {
      await NavigationBar.setVisibilityAsync('hidden');
      await setupNotificationChannel();
      const { status } = await Notifications.requestPermissionsAsync({
        android: { allowAlert: true, allowSound: true, allowBadge: false },
      });
      if (status !== 'granted') console.warn('Notification permission not granted');
    })();

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        channelId?: string;
        channelName?: string;
        channelImageUrl?: string;
      };
      if (data?.channelId) {
        setRingingAlarm({
          channelId: data.channelId,
          channelName: data.channelName ?? 'Alarm',
          channelImageUrl: data.channelImageUrl,
        });
      } else {
        router.push('/(tabs)/schedule');
      }
    });

    return () => {
      responseListener.current?.remove();
    };
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
