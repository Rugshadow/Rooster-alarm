import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

type TimeFormat = 'standard' | 'military';
type ColorScheme = 'light' | 'dark';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  isLoggedIn: boolean;
  username: string | null;
  timeFormat: TimeFormat;
  setTimeFormat: (fmt: TimeFormat) => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  isLoggedIn: false,
  username: null,
  timeFormat: 'standard',
  setTimeFormat: () => {},
  colorScheme: 'light',
  setColorScheme: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [timeFormatState, setTimeFormatState] = useState<TimeFormat>('standard');
  const [colorSchemeState, setColorSchemeState] = useState<ColorScheme>('light');

  const fetchUserPrefs = async (userId: string, sess?: any) => {
    const { data } = await supabase
      .from('users')
      .select('username, time_format, color_scheme')
      .eq('user_id', userId)
      .single();
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
  };

  const setTimeFormat = async (fmt: TimeFormat) => {
    setTimeFormatState(fmt);
    if (session) {
      await supabase.from('users').update({ time_format: fmt } as any).eq('user_id', session.user.id);
    }
  };

  const setColorScheme = async (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    if (session) {
      await supabase.from('users').update({ color_scheme: scheme } as any).eq('user_id', session.user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserPrefs(session.user.id, session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserPrefs(session.user.id, session);
      else {
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
      timeFormat: timeFormatState,
      setTimeFormat,
      colorScheme: colorSchemeState,
      setColorScheme,
      signOut: () => supabase.auth.signOut(),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
