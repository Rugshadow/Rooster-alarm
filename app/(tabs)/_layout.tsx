import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import AccountSheet from '../../components/AccountSheet';

function Header({ routeName }: { routeName: string }) {
  const { isLoggedIn, username } = useAuth();
  const router = useRouter();
  const [showAccount, setShowAccount] = useState(false);

  const titles: Record<string, string> = {
    browse: 'Browse Alarm Feeds',
    favorites: 'Favorites',
    schedule: 'Scheduled Alarms',
    uploads: username ? `${username}'s Uploads` : 'Uploads',
  };
  const title = titles[routeName] ?? '';

  return (
    <>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
        <View className="flex-row items-center px-4 pb-2" style={{ height: 44 }}>
          <View style={{ width: 40 }}>
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 36, height: 36, borderRadius: 8 }}
              resizeMode="contain"
            />
          </View>

          <Text
            className="text-[17px] font-semibold text-text-primary text-center"
            style={{ flex: 1 }}
            numberOfLines={1}
          >
            {title}
          </Text>

          {isLoggedIn ? (
            <TouchableOpacity onPress={() => setShowAccount(true)} style={{ width: 40, alignItems: 'flex-end' }}>
              <Ionicons name="person-circle" size={34} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              className="rounded-full px-4 py-1.5 bg-white"
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
