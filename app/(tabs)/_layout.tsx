import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import AccountSheet from '../../components/AccountSheet';

function Header({ title }: { title: string }) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [showAccount, setShowAccount] = useState(false);

  return (
    <>
      <SafeAreaView className="bg-white border-b border-gray-100">
        <View className="flex-row items-center px-4 py-2 h-14">
          <View className="flex-row items-center gap-2 flex-1">
            <View
              className="w-8 h-8 rounded-lg items-center justify-center"
              style={{ backgroundColor: Colors.primary }}
            >
              <Ionicons name="alarm" size={18} color="white" />
            </View>
            <Text className="font-bold text-[15px] text-text-primary">Peace Alarm</Text>
          </View>

          <Text className="text-[17px] font-semibold text-text-primary absolute left-0 right-0 text-center">
            {title}
          </Text>

          {isLoggedIn ? (
            <TouchableOpacity
              onPress={() => setShowAccount(true)}
              className="rounded-full px-4 py-1.5"
              style={{ backgroundColor: Colors.primary }}
            >
              <Text className="font-semibold text-[14px] text-text-primary">Account</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              className="rounded-full px-4 py-1.5 border"
              style={{ borderColor: Colors.textPrimary }}
            >
              <Text className="font-semibold text-[14px] text-text-primary">Log In</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
      <AccountSheet visible={showAccount} onClose={() => setShowAccount(false)} />
    </>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        header: () => {
          const titles: Record<string, string> = {
            browse: 'Browse',
            favorites: 'Favorites',
            schedule: 'Schedule',
            uploads: 'Uploads',
          };
          return <Header title={titles[route.name] ?? ''} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: '#E5E5E5',
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
          title: 'Browse',
          tabBarIcon: ({ color }) => <Ionicons name="grid" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color }) => <Ionicons name="heart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => <Ionicons name="alarm" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="uploads"
        options={{
          title: 'Uploads',
          tabBarIcon: ({ color }) => <Ionicons name="cloud-upload" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
