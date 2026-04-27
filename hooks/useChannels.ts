import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Channel, AudioClip } from '../components/ChannelSheet';

export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [{ data: channelRows }, { data: audioFiles }, { data: users }] = await Promise.all([
      supabase.from('channels').select('channel_id, name, genre, cover_photo, owner_id'),
      supabase.from('audio_files').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('user_id, num_of_followers'),
    ]);

    if (!channelRows) { setLoading(false); return; }

    const files = audioFiles ?? [];
    const usersMap = Object.fromEntries((users ?? []).map((u: any) => [u.user_id, u]));

    const mapped: Channel[] = channelRows.map((ch: any) => {
      const uploads: AudioClip[] = files
        .filter((f: any) => f.channel_id === ch.channel_id)
        .map((f: any) => ({
          id: f.audio_id,
          title: f.title,
          date: new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          duration: f.duration_seconds ?? 0,
          audioUrl: f.audio_file,
          imageUrl: f.cover_photo,
        }));

      const owner = usersMap[ch.owner_id];

      return {
        id: ch.channel_id,
        name: ch.name,
        genre: ch.genre ?? 'general',
        listeners: owner?.num_of_followers ?? 0,
        bio: '',
        imageUrl: ch.cover_photo ?? undefined,
        uploads,
      };
    });

    setChannels(mapped);
    setLoading(false);
  };

  return { channels, loading, refetch: load };
}
