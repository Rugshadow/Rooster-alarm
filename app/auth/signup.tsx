import React, { useState } from 'react';
import {
  View,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from '../../components/Text';
import PrivacyPolicySheet from '../../components/PrivacyPolicySheet';
import TermsSheet from '../../components/TermsSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTopInset } from '../../hooks/useTopInset';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

export default function SignupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const topPad = useTopInset();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

  const handleSignup = async () => {
    if (!email || !username || !password) return;
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      await supabase.from('users').insert({
        user_id: data.user.id,
        username,
      });
    }
    if (!data.session) {
      setError('Please check your email to confirm your account.');
      setLoading(false);
      return;
    }
    router.replace('/(tabs)/browse');
    setLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ paddingTop: topPad }} edges={['left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
          <View className="items-center mb-10">
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 16 }}
              resizeMode="cover"
            />
            <Text className="text-[26px] font-bold text-text-primary">{t('auth.create_account_title')}</Text>
          </View>

          <TouchableOpacity
            className="flex-row items-center justify-center gap-3 bg-surface rounded-2xl py-4 mb-4"
          >
            <FontAwesome name="google" size={20} color="#4285F4" />
            <Text className="font-semibold text-[16px] text-text-primary">{t('auth.signup_google')}</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-4 mb-4">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-text-secondary text-[14px]">{t('auth.or')}</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

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
            value={username}
            onChangeText={setUsername}
            placeholder={t('auth.username')}
            placeholderTextColor={Colors.textSecondary}
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
            onPress={handleSignup}
            disabled={loading}
            className="rounded-full py-4 items-center mt-4 mb-4"
            style={{ backgroundColor: Colors.primary }}
          >
            <Text className="font-bold text-[16px] text-text-primary">
              {loading ? t('auth.creating_account') : t('auth.create_account_title')}
            </Text>
          </TouchableOpacity>

          <Text className="text-text-secondary text-[13px] text-center mb-8">
            {"By creating an account, you are agreeing to Rooster Alarm's "}
            <Text
              style={{ color: '#111111', textDecorationLine: 'underline' }}
              onPress={() => setPrivacyVisible(true)}
            >
              privacy policy
            </Text>
            {' and '}
            <Text
              style={{ color: '#111111', textDecorationLine: 'underline' }}
              onPress={() => setTermsVisible(true)}
            >
              terms and conditions
            </Text>
            {'.'}
          </Text>
        </ScrollView>
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

      <PrivacyPolicySheet visible={privacyVisible} onClose={() => setPrivacyVisible(false)} />
      <TermsSheet visible={termsVisible} onClose={() => setTermsVisible(false)} />
    </SafeAreaView>
  );
}
