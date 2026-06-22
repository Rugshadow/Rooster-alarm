import React from 'react';
import { View,Image, TouchableOpacity } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTopInset } from '../../hooks/useTopInset';
import { useRouter } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { setUsername } = useAuth();
  const { t } = useTranslation();
  const topPad = useTopInset();

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'peace-alarm://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, 'peace-alarm://auth/callback');
    if (result.type === 'success') {
      const url = new URL(result.url);
      const accessToken = url.searchParams.get('access_token') ?? new URLSearchParams(url.hash.slice(1)).get('access_token');
      const refreshToken = url.searchParams.get('refresh_token') ?? new URLSearchParams(url.hash.slice(1)).get('refresh_token');
      if (accessToken && refreshToken) {
        const { data: { user } } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (user) {
          const { data } = await supabase.from('users').select('user_id, username').eq('user_id', user.id).maybeSingle();
          if (data?.username) setUsername(data.username);
          router.replace(data ? '/(tabs)/browse' : '/auth/create-username');
        }
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ backgroundColor: 'white', paddingTop: topPad }} edges={['left', 'right']}>
      <View className="flex-1 px-6 items-center justify-center">
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: 96, height: 96, borderRadius: 24, marginBottom: 24 }}
          resizeMode="cover"
        />
        <Text className="text-[28px] font-bold text-text-primary mb-1">Rooster Alarm</Text>
        <Text className="text-text-secondary text-[15px] mb-10">{t('auth.app_tagline')}</Text>

        <TouchableOpacity onPress={handleGoogleLogin} className="w-full flex-row items-center justify-center gap-3 bg-surface rounded-2xl py-4 mb-3">
          <FontAwesome name="google" size={20} color="#4285F4" />
          <Text className="font-semibold text-[16px] text-text-primary">{t('auth.login_google')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/auth/login-email')}
          className="w-full flex-row items-center justify-center rounded-2xl py-4 mb-4"
          style={{ backgroundColor: Colors.primary }}
        >
          <Text className="font-semibold text-[16px] text-text-primary">{t('auth.login_email')}</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-4 w-full mb-4">
          <View className="flex-1 h-px bg-gray-200" />
          <Text className="text-text-secondary text-[14px]">{t('auth.or')}</Text>
          <View className="flex-1 h-px bg-gray-200" />
        </View>

        <TouchableOpacity
          onPress={() => router.push('/auth/signup')}
          className="w-full items-center rounded-2xl py-4 border"
          style={{ borderColor: Colors.textSecondary }}
        >
          <Text className="font-semibold text-[16px] text-text-primary">{t('auth.create_account')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ backgroundColor: Colors.primary }}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center justify-center gap-1 py-4"
          style={{ paddingBottom: 24 }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
