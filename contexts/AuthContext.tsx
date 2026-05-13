import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import * as Localization from 'expo-localization';
import { supabase } from '../lib/supabase';
import { stopAllAudio } from '../lib/audioRegistry';
import type { Session } from '@supabase/supabase-js';

const { IntentData } = NativeModules;
const VOLUME_KEY = 'alarmVolume';
const TIME_FORMAT_KEY = 'timeFormat';
const COLOR_SCHEME_KEY = 'colorScheme';

type TimeFormat = 'standard' | 'military';
type ColorScheme = 'light' | 'dark';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  isLoggedIn: boolean;
  username: string | null;
  language: string;
  timeFormat: TimeFormat;
  setTimeFormat: (fmt: TimeFormat) => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  alarmVolume: number;
  setAlarmVolume: (vol: number) => void;
  signOut: () => void;
  refreshUser: () => void;
  setUsername: (username: string) => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  isLoggedIn: false,
  username: null,
  language: 'en',
  timeFormat: 'standard',
  setTimeFormat: () => {},
  colorScheme: 'light',
  setColorScheme: () => {},
  alarmVolume: 1,
  setAlarmVolume: () => {},
  signOut: () => {},
  refreshUser: () => {},
  setUsername: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('en');
  const [timeFormatState, setTimeFormatState] = useState<TimeFormat>('standard');
  const [colorSchemeState, setColorSchemeState] = useState<ColorScheme>('light');
  const [alarmVolumeState, setAlarmVolumeState] = useState<number>(1);

  const fetchUserPrefs = async (userId: string, sess?: any) => {
    const { data: rows } = await supabase
      .from('users')
      .select('username, time_format, color_scheme')
      .eq('user_id', userId)
      .limit(1);
    const data = rows?.[0] ?? null;
    if (data?.username) {
      setUsername(data.username);
    } else {
      const meta = sess?.user?.user_metadata;
      setUsername(meta?.username ?? null);
    }
    if (data?.time_format === 'military' || data?.time_format === 'standard') {
      setTimeFormatState(data.time_format);
    }
    if (data?.color_scheme === 'dark' || data?.color_scheme === 'light') {
      setColorSchemeState(data.color_scheme);
    }

    // Sync device language to Supabase if it has changed
    const deviceLanguage = Localization.getLocales()?.[0]?.languageCode ?? 'en';
    setLanguage(deviceLanguage);
    if (deviceLanguage && data?.language !== deviceLanguage) {
      supabase.from('users').update({ language: deviceLanguage } as any).eq('user_id', userId).then(() => {});
    }
  };

  const setTimeFormat = async (fmt: TimeFormat) => {
    setTimeFormatState(fmt);
    AsyncStorage.setItem(TIME_FORMAT_KEY, fmt);
    if (session) {
      await supabase.from('users').update({ time_format: fmt } as any).eq('user_id', session.user.id);
    }
  };

  const setColorScheme = async (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    AsyncStorage.setItem(COLOR_SCHEME_KEY, scheme);
    if (session) {
      await supabase.from('users').update({ color_scheme: scheme } as any).eq('user_id', session.user.id);
    }
  };

  const setAlarmVolume = (vol: number) => {
    setAlarmVolumeState(vol);
    AsyncStorage.setItem(VOLUME_KEY, String(vol));
    try { IntentData?.setAlarmVolume?.(vol); } catch {}
  };

  useEffect(() => {
    AsyncStorage.multiGet([VOLUME_KEY, TIME_FORMAT_KEY, COLOR_SCHEME_KEY]).then((pairs) => {
      const volume = pairs[0][1];
      const timeFormat = pairs[1][1];
      const colorScheme = pairs[2][1];
      if (volume !== null) {
        const parsed = parseFloat(volume);
        if (!isNaN(parsed)) {
          setAlarmVolumeState(parsed);
          try { IntentData?.setAlarmVolume?.(parsed); } catch {}
        }
      }
      if (timeFormat === 'standard' || timeFormat === 'military') {
        setTimeFormatState(timeFormat);
      }
      if (colorScheme === 'light' || colorScheme === 'dark') {
        setColorSchemeState(colorScheme);
      }
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserPrefs(session.user.id, session);
        try { IntentData?.setUserId?.(session.user.id); } catch {}
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserPrefs(session.user.id, session);
        try { IntentData?.setUserId?.(session.user.id); } catch {}
      } else {
        setUsername(null);
        setTimeFormatState('standard');
        setColorSchemeState('light');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      loading,
      isLoggedIn: !!session,
      username,
      language,
      timeFormat: timeFormatState,
      setTimeFormat,
      colorScheme: colorSchemeState,
      setColorScheme,
      alarmVolume: alarmVolumeState,
      setAlarmVolume,
      signOut: () => { stopAllAudio(); supabase.auth.signOut(); },
      refreshUser: () => { if (session) fetchUserPrefs(session.user.id, session); },
      setUsername: (u: string) => setUsername(u),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
