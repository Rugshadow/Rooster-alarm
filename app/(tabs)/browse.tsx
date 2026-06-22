import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from '../../hooks/useTopInset';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import ChannelAvatar from '../../components/ChannelAvatar';
import ChannelSheet, { type Channel } from '../../components/ChannelSheet';
import AlarmSheet from '../../components/AlarmSheet';
import { useChannels } from '../../hooks/useChannels';
import { useAlarmsContext } from '../../contexts/AlarmsContext';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const GENRES = ['Music', 'News', 'Comedy', 'Ambient', 'Motivational', 'Religious', 'Education', 'Storytelling', 'Fitness', 'Alternative'];

function GenreGridSheet({
  title,
  channels,
  visible,
  onClose,
  onPress,
}: {
  title: string;
  channels: Channel[];
  visible: boolean;
  onClose: () => void;
  onPress: (ch: Channel) => void;
}) {
  const { bg, text, textSecondary } = useTheme();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const topPad = useTopInset();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={[]} style={{ backgroundColor: Colors.primary, paddingTop: topPad }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">{title}</Text>
          </View>
        </SafeAreaView>

        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          columnWrapperStyle={{ gap: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onPress(item)}
              className="flex-1 items-center"
            >
              <ChannelAvatar id={item.id} name={item.name} size="carousel" imageUrl={item.imageUrl} />
              <Text className="text-[12px] mt-2 text-center" numberOfLines={2} style={{ color: textSecondary }}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />

        <View style={{ backgroundColor: Colors.primary, height: 56 }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function CarouselSection({
  title,
  channels,
  onPress,
  onSeeMore,
}: {
  title: string;
  channels: Channel[];
  onPress: (ch: Channel) => void;
  onSeeMore?: () => void;
}) {
  const { text, textSecondary } = useTheme();
  const { t } = useTranslation();
  if (channels.length === 0) return null;
  const visible = channels.slice(0, 10);
  const hasMore = channels.length > 10;

  return (
    <View className="mb-6">
      <Text className="text-[18px] font-bold px-4 mb-3" style={{ color: text }}>{title}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
        ListFooterComponent={
          hasMore && onSeeMore ? (
            <TouchableOpacity
              onPress={onSeeMore}
              className="items-center justify-center"
              style={{ width: 120, height: 120, backgroundColor: Colors.primary }}
            >
              <Ionicons name="arrow-forward-circle-outline" size={28} color={Colors.textPrimary} />
              <Text className="text-[11px] font-semibold mt-1" style={{ color: Colors.textPrimary }}>
                {t('browse.see_more')}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onPress(item)}
            className="items-center"
            style={{ width: 120 }}
          >
            <ChannelAvatar id={item.id} name={item.name} size="carousel" imageUrl={item.imageUrl} />
            <Text className="text-[12px] mt-2 text-center" numberOfLines={2} style={{ color: textSecondary }}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

export default function BrowseScreen() {
  const { bg, textSecondary } = useTheme();
  const { language } = useAuth();
  const { t } = useTranslation();
  const { channels, loading } = useChannels(language);
  const { addAlarm } = useAlarmsContext();
  const [searchText, setSearchText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [alarmSheetVisible, setAlarmSheetVisible] = useState(false);
  const [gridGenre, setGridGenre] = useState<{ title: string; channels: Channel[] } | null>(null);

  const openChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setSheetVisible(true);
  };

  const query = searchText.toLowerCase().trim();
  const filteredChannels = query
    ? channels.filter((c) => c.name.toLowerCase().includes(query))
    : null;

  const topByFollowers = [...channels].sort((a, b) => b.listeners - a.listeners);
  const genres = GENRES.filter((g) => channels.some((c) => c.genre === g));
  const genreSections = genres.map((genre) => ({
    title: t(`genres.${genre.toLowerCase()}`),
    channels: channels.filter((c) => c.genre === genre).sort((a, b) => b.listeners - a.listeners),
  }));

  return (
    <>
      <ScrollView className="flex-1" style={{ backgroundColor: bg }} showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center bg-surface rounded-2xl px-4 py-3 gap-2">
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder={t('browse.search_placeholder')}
              placeholderTextColor={Colors.textSecondary}
              className="flex-1 text-[15px]"
              style={{ color: textSecondary }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <View className="pt-4">
            {filteredChannels ? (
              filteredChannels.length > 0 ? (
                <CarouselSection title={t('browse.results')} channels={filteredChannels} onPress={openChannel} />
              ) : (
                <View className="items-center py-16">
                  <Text className="text-[15px]" style={{ color: textSecondary }}>{t('browse.no_results', { search: searchText })}</Text>
                </View>
              )
            ) : (
              <>
                <CarouselSection title={t('browse.popular')} channels={topByFollowers} onPress={openChannel} onSeeMore={() => setGridGenre({ title: t('browse.popular'), channels: topByFollowers })} />
                {genreSections.map((section, i) => (
                  <CarouselSection
                    key={`${section.title}-${i}`}
                    title={section.title}
                    channels={section.channels}
                    onPress={openChannel}
                    onSeeMore={() => setGridGenre(section)}
                  />
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <ChannelSheet
        channel={selectedChannel}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSetAlarm={(channel) => {
          setSelectedChannel(channel);
          setSheetVisible(false);
          setAlarmSheetVisible(true);
        }}
      />

      <AlarmSheet
        visible={alarmSheetVisible}
        onClose={() => setAlarmSheetVisible(false)}
        onSave={(alarm) => { addAlarm(alarm); setAlarmSheetVisible(false); }}
        preselectedChannel={selectedChannel ?? undefined}
      />

      <GenreGridSheet
        visible={!!gridGenre}
        title={gridGenre?.title ?? ''}
        channels={gridGenre?.channels ?? []}
        onClose={() => setGridGenre(null)}
        onPress={openChannel}
      />
    </>
  );
}
