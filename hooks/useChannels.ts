import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Channel, AudioClip } from '../components/ChannelSheet';

export function useChannels(language?: string) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [language]);

  const load = async () => {
    let channelsQuery = supabase.from('channels').select('channel_id, name, genre, bio, cover_photo, owner_id, listening_order');
    if (language) channelsQuery = channelsQuery.contains('language', [language]);

    const [{ data: channelRows }, { data: audioFiles }, { data: users }] = await Promise.all([
      channelsQuery,
      supabase.from('audio_files').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('user_id, set_alarms'),
    ]);

    if (!channelRows) { setLoading(false); return; }

    const files = audioFiles ?? [];

    // alarms may store channelId as owner user_id (old) or channel_id (new) — resolve both
    const ownerToChannelId: Record<string, string> = {};
    for (const ch of channelRows) {
      ownerToChannelId[ch.owner_id] = ch.channel_id;
    }

    // Count users who have at least one alarm set for each channel
    const alarmCountMap: Record<string, number> = {};
    for (const u of (users ?? [])) {
      const alarms = u.set_alarms as Record<string, { channelId: string }> | null;
      if (!alarms) continue;
      const seen = new Set<string>();
      for (const alarm of Object.values(alarms)) {
        if (!alarm.channelId) continue;
        const resolvedId = ownerToChannelId[alarm.channelId] ?? alarm.channelId;
        if (!seen.has(resolvedId)) {
          seen.add(resolvedId);
          alarmCountMap[resolvedId] = (alarmCountMap[resolvedId] ?? 0) + 1;
        }
      }
    }

    const mapped: Channel[] = channelRows.map((ch: any) => {
      const now = new Date();
      const uploads: AudioClip[] = files
        .filter((f: any) => f.channel_id === ch.channel_id && (!f.release_at || new Date(f.release_at) <= now))
        .map((f: any) => ({
          id: f.audio_id,
          title: f.title,
          date: new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          duration: f.duration_seconds ?? 0,
          audioUrl: f.audio_file,
          imageUrl: f.cover_photo,
        }));

      return {
        id: ch.channel_id,
        name: ch.name,
        genre: ch.genre ?? 'general',
        listeners: alarmCountMap[ch.channel_id] ?? 0,
        bio: ch.bio ?? '',
        imageUrl: ch.cover_photo ?? undefined,
        uploads,
        listeningOrder: (ch.listening_order as 'newest' | 'oldest') ?? 'newest',
      };
    });

    setChannels(mapped.filter((ch) => ch.uploads.length > 0));
    setLoading(false);
  };

  return { channels, loading, refetch: load };
}
