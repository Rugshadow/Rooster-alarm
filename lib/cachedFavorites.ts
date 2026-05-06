import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const STORAGE_KEY = '@peace_alarm_favorites';
const IMAGE_DIR = FileSystem.documentDirectory + 'channel_covers/';

export type CachedChannel = {
  id: string;
  name: string;
  imageUrl?: string;       // original remote URL
  localImagePath?: string; // cached local file URI
};

async function ensureImageDir() {
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
}

async function readAll(): Promise<CachedChannel[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeAll(channels: CachedChannel[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
}

export async function saveFavoriteChannel(channel: { id: string; name: string; imageUrl?: string }) {
  const all = await readAll();
  const exists = all.find(c => c.id === channel.id);
  if (exists) return; // already cached

  let localImagePath: string | undefined;
  if (channel.imageUrl) {
    try {
      await ensureImageDir();
      const ext = channel.imageUrl.split('?')[0].split('.').pop() ?? 'jpg';
      const dest = `${IMAGE_DIR}${channel.id}.${ext}`;
      const result = await FileSystem.downloadAsync(channel.imageUrl, dest);
      if (result.status === 200) localImagePath = result.uri;
    } catch {
      // image download failed — cache metadata without image
    }
  }

  await writeAll([...all, { id: channel.id, name: channel.name, imageUrl: channel.imageUrl, localImagePath }]);
}

export async function removeFavoriteChannel(channelId: string) {
  const all = await readAll();
  const entry = all.find(c => c.id === channelId);

  if (entry?.localImagePath) {
    try { await FileSystem.deleteAsync(entry.localImagePath, { idempotent: true }); } catch {}
  }

  await writeAll(all.filter(c => c.id !== channelId));
}

export async function getCachedFavorites(): Promise<CachedChannel[]> {
  return readAll();
}

// Returns the best available image URI: local cache first, then remote URL
export function resolveImageUri(channel: CachedChannel): string | undefined {
  return channel.localImagePath ?? channel.imageUrl;
}
