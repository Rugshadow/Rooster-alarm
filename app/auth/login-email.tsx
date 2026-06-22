import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTopInset } from '../../hooks/useTopInset';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

export default function LoginEmailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const topPad = useTopInset();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.replace('/(tabs)/browse');
    setLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ paddingTop: topPad }} edges={['left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 px-6 justify-center">
          <Text className="text-text-secondary text-[15px] mb-8">{t('auth.login_email_title')}</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email')}
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            className="bg-surface rounded-2xl px-4 py-4 text-[15px] text-text-primary mb-3"
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.password')}
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
            className="bg-surface rounded-2xl px-4 py-4 text-[15px] text-text-primary mb-2"
          />

          {error ? (
            <Text className="text-destructive text-[14px] mb-3">{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="rounded-full py-4 items-center mt-4"
            style={{ backgroundColor: Colors.primary }}
          >
            <Text className="font-bold text-[16px] text-text-primary">
              {loading ? t('auth.logging_in') : t('common.log_in')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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
