import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { scheduleAlarmNotifications, cancelAlarmNotifications } from '../lib/alarmScheduler';
import type { AlarmData } from '../components/AlarmSheet';

export type SetAlarm = AlarmData & { id: string };

const OFFLINE_KEY = 'offlineAlarms';

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
  mergePromptVisible: boolean;
  offlinePendingCount: number;
  uploadOfflineAlarms: () => Promise<void>;
  discardOfflineAlarms: () => Promise<void>;
};

const AlarmsContext = createContext<AlarmsContextValue | null>(null);

export function AlarmsProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoggedIn } = useAuth();
  const [alarms, setAlarms] = useState<SetAlarm[]>([]);
  const [offlinePending, setOfflinePending] = useState<SetAlarm[]>([]);
  const [mergePromptVisible, setMergePromptVisible] = useState(false);
  const isLoggedInRef = useRef(isLoggedIn);
  useEffect(() => { isLoggedInRef.current = isLoggedIn; }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && session) {
      fetchAlarms();
    } else {
      loadOfflineAlarms();
    }
  }, [isLoggedIn, session]);

  const loadOfflineAlarms = async () => {
    const raw = await AsyncStorage.getItem(OFFLINE_KEY);
    setAlarms(raw ? JSON.parse(raw) : []);
  };

  const saveOfflineAlarms = async (updated: SetAlarm[]) => {
    await AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify(updated));
  };

  const fetchAlarms = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    const { data } = await supabase
      .from('users')
      .select('set_alarms')
      .eq('user_id', currentSession.user.id)
      .single();
    const raw = (data?.set_alarms as Record<string, SetAlarm> | null) ?? {};
    const accountAlarms = Object.values(raw);
    setAlarms(accountAlarms);

    // Check for offline alarms saved while logged out
    const stored = await AsyncStorage.getItem(OFFLINE_KEY);
    const offline: SetAlarm[] = stored ? JSON.parse(stored) : [];
    if (offline.length > 0) {
      setOfflinePending(offline);
      setMergePromptVisible(true);
    }
  };

  const persistToSupabase = async (updated: SetAlarm[]) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    const asObject = Object.fromEntries(updated.map((a) => [a.id, a]));
    await supabase
      .from('users')
      .update({ set_alarms: asObject } as any)
      .eq('user_id', currentSession.user.id);
  };

  const persist = (updated: SetAlarm[]) => {
    if (isLoggedInRef.current) {
      persistToSupabase(updated);
    } else {
      saveOfflineAlarms(updated);
    }
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
    persist(updated);
  };

  const removeAlarm = (id: string) => {
    removeAlarmDirect(id);
  };

  const removeAlarmDirect = async (id: string) => {
    const alarm = alarms.find((a) => a.id === id);
    if (alarm?.notificationIds?.length) {
      await cancelAlarmNotifications(alarm.notificationIds);
    }
    const updated = alarms.filter((a) => a.id !== id);
    setAlarms(updated);
    persist(updated);
  };

  const clearAllAlarms = async () => {
    await Promise.all(
      alarms.flatMap((a) => a.notificationIds?.length ? [cancelAlarmNotifications(a.notificationIds)] : [])
    );
    setAlarms([]);
    persist([]);
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
    persist(updated);
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
    persist(updated);
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
    persist(updated);
  };

  const uploadOfflineAlarms = async () => {
    const merged = [...alarms, ...offlinePending];
    setAlarms(merged);
    await persistToSupabase(merged);
    await AsyncStorage.removeItem(OFFLINE_KEY);
    setOfflinePending([]);
    setMergePromptVisible(false);
  };

  const discardOfflineAlarms = async () => {
    await Promise.all(
      offlinePending.flatMap((a) => a.notificationIds?.length ? [cancelAlarmNotifications(a.notificationIds)] : [])
    );
    await AsyncStorage.removeItem(OFFLINE_KEY);
    setOfflinePending([]);
    setMergePromptVisible(false);
  };

  return (
    <AlarmsContext.Provider value={{
      alarms,
      addAlarm,
      removeAlarm,
      removeAlarmDirect,
      clearAllAlarms,
      editAlarm,
      toggleAlarm,
      deactivateByChannelId,
      refetch: fetchAlarms,
      mergePromptVisible,
      offlinePendingCount: offlinePending.length,
      uploadOfflineAlarms,
      discardOfflineAlarms,
    }}>
      {children}
    </AlarmsContext.Provider>
  );
}

export function useAlarmsContext() {
  const ctx = useContext(AlarmsContext);
  if (!ctx) throw new Error('useAlarmsContext must be used within AlarmsProvider');
  return ctx;
}
