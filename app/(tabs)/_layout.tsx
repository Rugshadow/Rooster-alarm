import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import AccountSheet from '../../components/AccountSheet';
import WelcomeModal from '../../components/WelcomeModal';

function Header({ routeName }: { routeName: string }) {
  const { isLoggedIn, username } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [showAccount, setShowAccount] = useState(false);
  const ringAnim = useRef(new Animated.Value(0)).current;

  const ringLogo = () => {
    ringAnim.setValue(0);
    Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0.7, duration: 70, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: -0.7, duration: 70, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0.4, duration: 60, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const rotate = ringAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-18deg', '0deg', '18deg'],
  });

  const titles: Record<string, string> = {
    browse: t('tabs.browse_title'),
    favorites: t('tabs.favorites_title'),
    schedule: t('tabs.schedule_title'),
    uploads: username ?? t('tabs.create'),
  };
  const title = titles[routeName] ?? '';

  return (
    <>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#3a3a3a' }}>
        <View className="flex-row items-center px-4 pb-2" style={{ height: 44 }}>
          <TouchableOpacity onPress={ringLogo} activeOpacity={1} style={{ width: 40 }}>
            <Animated.Image
              source={require('../../assets/Peace Alarm Icon dark.png')}
              style={{ width: 36, height: 36, borderRadius: 8, transform: [{ rotate }] }}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text
            className="text-[17px] font-semibold text-center"
            style={{ flex: 1, color: '#ffffff' }}
            numberOfLines={1}
          >
            {title}
          </Text>

          {isLoggedIn ? (
            <TouchableOpacity onPress={() => setShowAccount(true)} style={{ width: 40, alignItems: 'flex-end' }}>
              <Ionicons name="person-circle" size={34} color={Colors.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              className="rounded-full px-4 py-1.5 bg-white"
            >
              <Text className="font-semibold text-[14px] text-text-primary">{t('common.log_in')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
      <AccountSheet visible={showAccount} onClose={() => setShowAccount(false)} />
    </>
  );
}

export default function TabLayout() {
  const { isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    AsyncStorage.getItem('has_seen_welcome').then((val) => {
      if (!val) setShowWelcome(true);
    });
  }, [isLoggedIn]);

  const handleWelcomeDismiss = () => {
    setShowWelcome(false);
    AsyncStorage.setItem('has_seen_welcome', 'true');
  };

  return (
    <>
    <WelcomeModal visible={showWelcome} onDismiss={handleWelcomeDismiss} />
    <Tabs
      screenOptions={({ route }) => ({
        header: () => {
          return <Header routeName={route.name} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#ffffff',
        tabBarStyle: {
          backgroundColor: '#3a3a3a',
          borderTopColor: '#3a3a3a',
          paddingBottom: 12,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: t('tabs.browse'),
          tabBarIcon: ({ color }) => <Ionicons name="grid" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t('tabs.favorites'),
          tabBarIcon: ({ color }) => <Ionicons name="heart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('tabs.schedule'),
          tabBarIcon: ({ color }) => <Ionicons name="alarm" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="uploads"
        options={{
          title: t('tabs.create'),
          tabBarIcon: ({ color }) => <Ionicons name="mic" size={22} color={color} />,
        }}
      />
    </Tabs>
    </>
  );
}
