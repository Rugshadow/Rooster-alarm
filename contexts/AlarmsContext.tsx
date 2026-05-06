import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { scheduleAlarmNotifications, cancelAlarmNotifications } from '../lib/alarmScheduler';
import type { AlarmData } from '../components/AlarmSheet';

export type SetAlarm = AlarmData & { id: string };

type AlarmsContextValue = {
  alarms: SetAlarm[];
  addAlarm: (data: AlarmData) => Promise<void>;
  removeAlarm: (id: string) => void;
  removeAlarmDirect: (id: string) => Promise<void>;
  clearAllAlarms: () => Promise<void>;
  editAlarm: (id: string, data: AlarmData) => Promise<void>;
  toggleAlarm: (id: string) => Promise<void>;
  deactivateByChannelId: (channelId: string) => Promise<void>;
  refetch: () => Promise<void>;
};

const AlarmsContext = createContext<AlarmsContextValue | null>(null);

export function AlarmsProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoggedIn } = useAuth();
  const [alarms, setAlarms] = useState<SetAlarm[]>([]);

  useEffect(() => {
    if (isLoggedIn && session) fetchAlarms();
  }, [isLoggedIn, session]);

  const fetchAlarms = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    const { data } = await supabase
      .from('users')
      .select('set_alarms')
      .eq('user_id', currentSession.user.id)
      .single();
    const raw = (data?.set_alarms as Record<string, SetAlarm> | null) ?? {};
    setAlarms(Object.values(raw));
  };

  const persistAlarms = async (updated: SetAlarm[]) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    const asObject = Object.fromEntries(updated.map((a) => [a.id, a]));
    await supabase
      .from('users')
      .update({ set_alarms: asObject } as any)
      .eq('user_id', currentSession.user.id);
  };

  const addAlarm = async (data: AlarmData) => {
    const newAlarm: SetAlarm = { ...data, id: Date.now().toString(), active: true };
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

  const removeAlarmDirect = async (id: string) => {
    const alarm = alarms.find((a) => a.id === id);
    if (alarm?.notificationIds?.length) {
      await cancelAlarmNotifications(alarm.notificationIds);
    }
    const updated = alarms.filter((a) => a.id !== id);
    setAlarms(updated);
    persistAlarms(updated);
  };

  const clearAllAlarms = async () => {
    await Promise.all(
      alarms.flatMap((a) => a.notificationIds?.length ? [cancelAlarmNotifications(a.notificationIds)] : [])
    );
    setAlarms([]);
    persistAlarms([]);
  };

  const editAlarm = async (id: string, data: AlarmData) => {
    const alarm = alarms.find((a) => a.id === id);
    if (!alarm) return;
    if (alarm.notificationIds?.length) {
      await cancelAlarmNotifications(alarm.notificationIds);
    }
    let notificationIds: string[] = [];
    try {
      notificationIds = await scheduleAlarmNotifications({ ...data, id, active: true });
    } catch (e) {
      console.warn('Could not reschedule alarm:', e);
    }
    const updated = alarms.map((a) =>
      a.id === id ? { ...data, id, active: true, notificationIds } : a
    );
    setAlarms(updated);
    persistAlarms(updated);
  };

  const toggleAlarm = async (id: string) => {
    const alarm = alarms.find((a) => a.id === id);
    if (!alarm) return;
    const nowActive = !alarm.active;
    let notificationIds = alarm.notificationIds ?? [];
    if (!nowActive) {
      await cancelAlarmNotifications(notificationIds);
      notificationIds = [];
    } else {
      try {
        notificationIds = await scheduleAlarmNotifications(alarm);
      } catch (e) {
        console.warn('Could not reschedule alarm:', e);
      }
    }
    const updated = alarms.map((a) =>
      a.id === id ? { ...a, active: nowActive, notificationIds } : a
    );
    setAlarms(updated);
    persistAlarms(updated);
  };

  const deactivateByChannelId = async (channelId: string) => {
    const hasMatch = alarms.some(
      (a) => a.channelId === channelId && (!a.repeatDays || a.repeatDays.length === 0)
    );
    if (!hasMatch) return;
    const updated = alarms.map((a) =>
      a.channelId === channelId && (!a.repeatDays || a.repeatDays.length === 0)
        ? { ...a, active: false }
        : a
    );
    setAlarms(updated);
    persistAlarms(updated);
  };

  return (
    <AlarmsContext.Provider value={{ alarms, addAlarm, removeAlarm, removeAlarmDirect, clearAllAlarms, editAlarm, toggleAlarm, deactivateByChannelId, refetch: fetchAlarms }}>
      {children}
    </AlarmsContext.Provider>
  );
}

export function useAlarmsContext() {
  const ctx = useContext(AlarmsContext);
  if (!ctx) throw new Error('useAlarmsContext must be used within AlarmsProvider');
  return ctx;
}
