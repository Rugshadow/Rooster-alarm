import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import ChannelAvatar from './ChannelAvatar';
import type { Channel } from './ChannelSheet';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import type { SetAlarm } from '../contexts/AlarmsContext';
import { getCachedFavorites, resolveImageUri } from '../lib/cachedFavorites';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const ITEM_HEIGHT = 72;

const LOOP_REPS = 5;

function TimeScroller({
  items,
  selected,
  onChange,
}: {
  items: string[];
  selected: string;
  onChange: (val: string) => void;
}) {
  const { text, textSecondary } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const looped = useMemo(() => Array.from({ length: LOOP_REPS }, () => items).flat(), [items]);
  const centerStart = Math.floor(LOOP_REPS / 2) * items.length;

  const scrollIndexRef = useRef(centerStart + items.indexOf(selected));
  const suppressExternalRef = useRef(false);
  const prevSelectedRef = useRef(selected);
  const isSnappingRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: scrollIndexRef.current * ITEM_HEIGHT, animated: false });
  }, []);

  useEffect(() => {
    if (selected !== prevSelectedRef.current) {
      if (suppressExternalRef.current) {
        suppressExternalRef.current = false;
      } else {
        const newScrollIndex = centerStart + items.indexOf(selected);
        scrollIndexRef.current = newScrollIndex;
        scrollRef.current?.scrollTo({ y: newScrollIndex * ITEM_HEIGHT, animated: false });
      }
    }
    prevSelectedRef.current = selected;
  }, [selected]);

  const resolveItem = (rawIndex: number) => {
    const itemIndex = ((rawIndex % items.length) + items.length) % items.length;
    if (items[itemIndex] !== selected) onChange(items[itemIndex]);
    scrollIndexRef.current = rawIndex;
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSnappingRef.current) return;
    const snappedIndex = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    scrollRef.current?.scrollTo({ y: snappedIndex * ITEM_HEIGHT, animated: false });
    resolveItem(snappedIndex);
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSnappingRef.current) return;
    const snappedIndex = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    resolveItem(snappedIndex);
    isSnappingRef.current = true;
    scrollRef.current?.scrollTo({ y: snappedIndex * ITEM_HEIGHT, animated: true });
    setTimeout(() => { isSnappingRef.current = false; }, 400);
  };

  const handleAdjustPress = (delta: number) => {
    suppressExternalRef.current = true;
    const newScrollIndex = scrollIndexRef.current + delta;
    scrollIndexRef.current = newScrollIndex;
    scrollRef.current?.scrollTo({ y: newScrollIndex * ITEM_HEIGHT, animated: true });
    const newItemIndex = ((newScrollIndex % items.length) + items.length) % items.length;
    onChange(items[newItemIndex]);
  };

  return (
    <View className="items-center">
      <TouchableOpacity onPress={() => handleAdjustPress(1)} className="p-2">
        <Ionicons name="chevron-up" size={20} color={textSecondary} />
      </TouchableOpacity>
      <View style={{ height: ITEM_HEIGHT, overflow: 'hidden', backgroundColor: Colors.primaryLight }} className="rounded-xl px-8 justify-center">
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          decelerationRate={0.999}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScrollEndDrag={handleScrollEndDrag}
          style={{ height: ITEM_HEIGHT }}
        >
          {looped.map((item, idx) => (
            <View key={idx} style={{ height: ITEM_HEIGHT }} className="items-center justify-center">
              <Text style={{ fontSize: 40, fontWeight: 'bold', color: Colors.textPrimary }}>{item}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <TouchableOpacity onPress={() => handleAdjustPress(-1)} className="p-2">
        <Ionicons name="chevron-down" size={20} color={textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (alarm: AlarmData) => void;
  preselectedChannel?: Channel;
  initialAlarm?: SetAlarm;
  onDelete?: () => void;
};

export type AlarmData = {
  channelId: string;
  channelName: string;
  channelImageUrl?: string;
  hour: number;
  minute: number;
  ampm: 'AM' | 'PM';
  repeatDays: number[];
  notificationIds?: string[];
  active?: boolean;
};

function ChannelPickerModal({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (ch: Channel) => void;
  onClose: () => void;
}) {
  const { session, isLoggedIn } = useAuth();
  const { bg, surface, text, textSecondary } = useTheme();
  const [search, setSearch] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && isLoggedIn && session) fetchFavoriteChannels();
  }, [visible]);

  const fetchFavoriteChannels = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('favorite_channels')
        .eq('user_id', session!.user.id)
        .single();

      const favIds: string[] = userData?.favorite_channels ?? [];
      if (favIds.length === 0) { setChannels([]); setLoading(false); return; }

      const { data: favChannels, error } = await supabase
        .from('channels')
        .select('*')
        .in('channel_id', favIds);

      if (error) throw error;

      const mapped: Channel[] = (favChannels ?? []).map((ch) => ({
        id: ch.channel_id,
        name: ch.name,
        genre: ch.genre ?? '',
        listeners: 0,
        bio: ch.bio ?? '',
        imageUrl: ch.cover_photo ?? undefined,
        uploads: [],
      }));

      setChannels(mapped);
    } catch {
      const cached = await getCachedFavorites();
      const mapped: Channel[] = cached.map((ch) => ({
        id: ch.id,
        name: ch.name,
        genre: '',
        listeners: 0,
        bio: '',
        imageUrl: resolveImageUri(ch),
        uploads: [],
      }));
      setChannels(mapped);
    }
    setLoading(false);
  };

  const filtered = search.trim()
    ? channels.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : channels;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-4 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              Favorites
            </Text>
          </View>
        </SafeAreaView>

        <View className="px-4 py-3">
          <View className="flex-row items-center rounded-2xl px-4 py-3 gap-2" style={{ backgroundColor: surface }}>
            <Ionicons name="search" size={18} color={textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search channels..."
              placeholderTextColor={textSecondary}
              className="flex-1 text-[15px]"
              style={{ color: text }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[15px] text-center" style={{ color: textSecondary }}>
              {isLoggedIn ? 'No favorite channels yet. Add some from the Browse tab.' : 'Log in to see your favorites.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={{ padding: 16, gap: 16 }}
            columnWrapperStyle={{ gap: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-1 items-center"
                onPress={() => { onSelect(item); onClose(); }}
              >
                <ChannelAvatar id={item.id} name={item.name} size="carousel" imageUrl={item.imageUrl} />
                <Text className="text-[12px] mt-2 text-center" style={{ color: textSecondary }} numberOfLines={2}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}

        <View style={{ backgroundColor: Colors.primary }}>
          <TouchableOpacity
            onPress={onClose}
            className="flex-row items-center justify-center gap-1 py-4"
            style={{ paddingBottom: 24 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function AlarmSheet({ visible, onClose, onSave, preselectedChannel, initialAlarm, onDelete }: Props) {
  const { timeFormat } = useAuth();
  const { bg, surface, text, textSecondary } = useTheme();
  const HOURS = timeFormat === 'military' ? HOURS_24 : HOURS_12;
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  useEffect(() => {
    if (visible && preselectedChannel) setSelectedChannel(preselectedChannel);
  }, [visible, preselectedChannel]);

  useEffect(() => {
    if (visible) {
      if (initialAlarm) {
        const displayHour = timeFormat === 'military'
          ? String(initialAlarm.hour).padStart(2, '0')
          : String(initialAlarm.hour % 12 || 12).padStart(2, '0');
        setHour(displayHour);
        setMinute(String(initialAlarm.minute).padStart(2, '0'));
        setAmpm(initialAlarm.ampm);
        setRepeatDays(initialAlarm.repeatDays);
        setSelectedChannel({
          id: initialAlarm.channelId,
          name: initialAlarm.channelName,
          imageUrl: initialAlarm.channelImageUrl,
          genre: '',
          listeners: 0,
          bio: '',
          uploads: [],
        });
      } else {
        const h = new Date().getHours();
        const m = new Date().getMinutes();
        setHour(timeFormat === 'military' ? String(h).padStart(2, '0') : (h % 12 === 0 ? '12' : String(h % 12).padStart(2, '0')));
        setMinute(String(m).padStart(2, '0'));
        setAmpm(h < 12 ? 'AM' : 'PM');
      }
    }
  }, [visible]);
  const nowHour = new Date().getHours();
  const nowMinute = new Date().getMinutes();
  const defaultAmpm: 'AM' | 'PM' = nowHour < 12 ? 'AM' : 'PM';
  const defaultHour12 = nowHour % 12 === 0 ? '12' : String(nowHour % 12).padStart(2, '0');
  const defaultHour24 = String(nowHour).padStart(2, '0');

  const [hour, setHour] = useState(timeFormat === 'military' ? defaultHour24 : defaultHour12);
  const [minute, setMinute] = useState(String(nowMinute).padStart(2, '0'));
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(defaultAmpm);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  const isComplete = selectedChannel !== null;

  const toggleDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const reset = () => {
    const h = new Date().getHours();
    const m = new Date().getMinutes();
    setSelectedChannel(null);
    setHour(timeFormat === 'military' ? String(h).padStart(2, '0') : (h % 12 === 0 ? '12' : String(h % 12).padStart(2, '0')));
    setMinute(String(m).padStart(2, '0'));
    setAmpm(h < 12 ? 'AM' : 'PM');
    setRepeatDays([]);
  };

  const handleSave = () => {
    if (!selectedChannel) return;
    let h: number;
    let resolvedAmpm: 'AM' | 'PM';
    if (timeFormat === 'military') {
      h = parseInt(hour);
      resolvedAmpm = h >= 12 ? 'PM' : 'AM';
    } else {
      const raw = parseInt(hour);
      h = ampm === 'AM' ? (raw === 12 ? 0 : raw) : (raw === 12 ? 12 : raw + 12);
      resolvedAmpm = ampm;
    }
    onSave({
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      channelImageUrl: selectedChannel.imageUrl,
      hour: h,
      minute: parseInt(minute),
      ampm: resolvedAmpm,
      repeatDays,
    });
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['left', 'right', 'bottom']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              {initialAlarm ? 'Edit Alarm' : 'New Alarm'}
            </Text>
          </View>
        </SafeAreaView>

        <ScrollView className="flex-1 px-6 pt-6">
          <Text className="text-[12px] font-semibold tracking-wider mb-2" style={{ color: textSecondary }}>
            CHANNEL
          </Text>

          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            className="rounded-lg items-center justify-center self-center"
            style={{
              width: 160,
              height: 160,
              overflow: 'hidden',
              borderWidth: selectedChannel ? 0 : 2,
              borderStyle: 'dashed',
              borderColor: '#D1D5DB',
            }}
          >
            {selectedChannel?.imageUrl ? (
              <Image
                source={{ uri: selectedChannel.imageUrl }}
                style={{ width: 160, height: 160 }}
                resizeMode="cover"
              />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={28} color={textSecondary} />
                <Text className="text-[13px] mt-2 text-center px-2" style={{ color: textSecondary }} numberOfLines={2}>
                  {selectedChannel ? selectedChannel.name : 'Pick a channel'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {selectedChannel && (
            <Text className="text-center text-[14px] font-medium mt-2" style={{ color: text }}>
              {selectedChannel.name}
            </Text>
          )}

          <Text className="text-[12px] font-semibold tracking-wider mt-6 mb-2" style={{ color: textSecondary }}>
            WAKE TIME
          </Text>
          <View className="flex-row items-center justify-center gap-3">
            <TimeScroller items={HOURS} selected={hour} onChange={setHour} />
            <Text style={{ fontSize: 40, fontWeight: 'bold', color: text, marginBottom: 8 }}>:</Text>
            <TimeScroller items={MINUTES} selected={minute} onChange={setMinute} />

            {timeFormat !== 'military' && (
              <View className="items-center gap-2 ml-2">
                {(['AM', 'PM'] as const).map((period) => (
                  <TouchableOpacity
                    key={period}
                    onPress={() => setAmpm(period)}
                    className="px-3 py-2 rounded-xl"
                    style={{ backgroundColor: ampm === period ? Colors.primaryLight : surface }}
                  >
                    <Text
                      className="font-semibold text-[15px]"
                      style={{ color: ampm === period ? Colors.textPrimary : textSecondary }}
                    >
                      {period}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Text className="text-[12px] font-semibold tracking-wider mt-6 mb-3" style={{ color: textSecondary }}>
            REPEAT
          </Text>
          <View className="flex-row gap-2 justify-center">
            {DAYS.map((day, idx) => {
              const active = repeatDays.includes(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleDay(idx)}
                  className="w-10 h-10 rounded-full items-center justify-center border"
                  style={{
                    backgroundColor: active ? Colors.primary : 'transparent',
                    borderColor: active ? Colors.primary : Colors.textSecondary,
                  }}
                >
                  <Text
                    className="font-semibold text-[14px]"
                    style={{ color: active ? Colors.textPrimary : Colors.textSecondary }}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View className="px-6 py-4 gap-3" style={{ borderTopWidth: 1, borderTopColor: surface }}>
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              className="rounded-full py-3 items-center"
              style={{ backgroundColor: Colors.destructive }}
            >
              <Text className="font-bold text-[15px] text-white">Delete Alarm</Text>
            </TouchableOpacity>
          )}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 rounded-full py-3 items-center"
              style={{ backgroundColor: surface }}
            >
              <Text className="font-semibold text-[15px]" style={{ color: text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              className="flex-1 rounded-full py-3 items-center"
              style={{ backgroundColor: isComplete ? Colors.primary : surface }}
            >
              <Text
                className="font-bold text-[15px]"
                style={{ color: isComplete ? Colors.textPrimary : textSecondary }}
              >
                Save Alarm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ChannelPickerModal
        visible={pickerVisible}
        onSelect={setSelectedChannel}
        onClose={() => setPickerVisible(false)}
      />
    </Modal>
  );
}
