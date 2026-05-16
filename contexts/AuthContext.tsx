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
const CREATOR_MODE_KEY = 'creatorMode';
const LANGUAGE_OVERRIDE_KEY = 'languageOverride';

type TimeFormat = 'standard' | 'military';
type ColorScheme = 'light' | 'dark';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  isLoggedIn: boolean;
  username: string | null;
  language: string;
  setLanguage: (lang: string) => void;
  timeFormat: TimeFormat;
  setTimeFormat: (fmt: TimeFormat) => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  alarmVolume: number;
  setAlarmVolume: (vol: number) => void;
  creatorMode: boolean;
  setCreatorMode: (on: boolean) => void;
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
  setLanguage: () => {},
  timeFormat: 'standard',
  setTimeFormat: () => {},
  colorScheme: 'light',
  setColorScheme: () => {},
  alarmVolume: 1,
  setAlarmVolume: () => {},
  creatorMode: false,
  setCreatorMode: () => {},
  signOut: () => {},
  refreshUser: () => {},
  setUsername: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [language, setLanguageState] = useState<string>('en');
  const [timeFormatState, setTimeFormatState] = useState<TimeFormat>('standard');
  const [colorSchemeState, setColorSchemeState] = useState<ColorScheme>('light');
  const [alarmVolumeState, setAlarmVolumeState] = useState<number>(1);
  const [creatorModeState, setCreatorModeState] = useState<boolean>(false);

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
    } else {
      const stored = await AsyncStorage.getItem(TIME_FORMAT_KEY);
      if (stored === 'standard' || stored === 'military') setTimeFormatState(stored);
    }
    if (data?.color_scheme === 'dark' || data?.color_scheme === 'light') {
      setColorSchemeState(data.color_scheme);
    } else {
      const stored = await AsyncStorage.getItem(COLOR_SCHEME_KEY);
      if (stored === 'light' || stored === 'dark') setColorSchemeState(stored);
    }

    // Use language override if set, otherwise fall back to device locale
    const deviceLanguage = Localization.getLocales()?.[0]?.languageCode ?? 'en';
    const override = await AsyncStorage.getItem(LANGUAGE_OVERRIDE_KEY);
    setLanguageState(override ?? deviceLanguage);
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

  const setCreatorMode = (on: boolean) => {
    setCreatorModeState(on);
    AsyncStorage.setItem(CREATOR_MODE_KEY, on ? 'true' : 'false');
  };

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    AsyncStorage.setItem(LANGUAGE_OVERRIDE_KEY, lang);
  };

  useEffect(() => {
    AsyncStorage.multiGet([VOLUME_KEY, TIME_FORMAT_KEY, COLOR_SCHEME_KEY, CREATOR_MODE_KEY, LANGUAGE_OVERRIDE_KEY]).then((pairs) => {
      const volume = pairs[0][1];
      const timeFormat = pairs[1][1];
      const colorScheme = pairs[2][1];
      const creatorMode = pairs[3][1];
      const langOverride = pairs[4][1];
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
      if (creatorMode !== null) {
        setCreatorModeState(creatorMode === 'true');
      }
      if (langOverride !== null) {
        setLanguageState(langOverride);
      } else {
        const deviceLanguage = Localization.getLocales()?.[0]?.languageCode ?? 'en';
        setLanguageState(deviceLanguage);
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
      setLanguage,
      timeFormat: timeFormatState,
      setTimeFormat,
      colorScheme: colorSchemeState,
      setColorScheme,
      alarmVolume: alarmVolumeState,
      setAlarmVolume,
      creatorMode: creatorModeState,
      setCreatorMode,
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
