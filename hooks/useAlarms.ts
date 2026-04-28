import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { scheduleAlarmNotifications, cancelAlarmNotifications } from '../lib/alarmScheduler';
import type { AlarmData } from '../components/AlarmSheet';

export type SetAlarm = AlarmData & { id: string };

export function useAlarms() {
  const { session, isLoggedIn } = useAuth();
  const [alarms, setAlarms] = useState<SetAlarm[]>([]);

  useEffect(() => {
    if (isLoggedIn && session) fetchAlarms();
  }, [isLoggedIn, session]);

  const fetchAlarms = async () => {
    const { data } = await supabase
      .from('users')
      .select('set_alarms')
      .eq('user_id', session!.user.id)
      .single();
    const raw = (data?.set_alarms as Record<string, SetAlarm> | null) ?? {};
    setAlarms(Object.values(raw));
  };

  const persistAlarms = async (updated: SetAlarm[]) => {
    if (!session) return;
    const asObject = Object.fromEntries(updated.map((a) => [a.id, a]));
    await supabase
      .from('users')
      .update({ set_alarms: asObject } as any)
      .eq('user_id', session.user.id);
  };

  const addAlarm = async (data: AlarmData) => {
    const newAlarm: SetAlarm = { ...data, id: Date.now().toString() };
    try {
      const notificationIds = await scheduleAlarmNotifications(newAlarm);
      newAlarm.notificationIds = notificationIds;
    } catch (e) {
      console.warn('Could not schedule notification:', e);
    }
    const updated = [...alarms, newAlarm];
    setAlarms(updated);
    persistAlarms(updated);
  };

  const removeAlarm = (id: string) => {
    Alert.alert('Remove Alarm', 'Are you sure you want to remove this alarm?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const alarm = alarms.find((a) => a.id === id);
          if (alarm?.notificationIds?.length) {
            await cancelAlarmNotifications(alarm.notificationIds);
          }
          const updated = alarms.filter((a) => a.id !== id);
          setAlarms(updated);
          persistAlarms(updated);
        },
      },
    ]);
  };

  return { alarms, addAlarm, removeAlarm };
}
