import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!email || !username || !password) return;
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signUp({ email, password });
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
    router.replace('/(tabs)/browse');
    setLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="px-4 py-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
          <View className="items-center mb-10">
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: Colors.primary }}
            >
              <Ionicons name="alarm" size={36} color="white" />
            </View>
            <Text className="text-[26px] font-bold text-text-primary">Create account</Text>
            <Text className="text-text-secondary text-[15px] mt-1">Join Peace Alarm</Text>
          </View>

          <TouchableOpacity
            className="flex-row items-center justify-center gap-3 bg-surface rounded-2xl py-4 mb-4"
          >
            <Text style={{ fontSize: 20 }}>G</Text>
            <Text className="font-semibold text-[16px] text-text-primary">Sign up with Google</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-4 mb-4">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-text-secondary text-[14px]">or</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            className="bg-surface rounded-2xl px-4 py-4 text-[15px] text-text-primary mb-3"
          />

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            className="bg-surface rounded-2xl px-4 py-4 text-[15px] text-text-primary mb-3"
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
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
            className="rounded-full py-4 items-center mt-4 mb-8"
            style={{ backgroundColor: Colors.primaryDark }}
          >
            <Text className="font-bold text-[16px] text-text-primary">
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
