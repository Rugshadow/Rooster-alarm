import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const play = useCallback(async (id: string, uri: string) => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    if (playingId === id) {
      setPlayingId(null);
      return;
    }

    const { sound } = await Audio.Sound.createAsync({ uri });
    soundRef.current = sound;
    setPlayingId(id);

    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setPlayingId(null);
      }
    });
  }, [playingId]);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setPlayingId(null);
  }, []);

  return { playingId, play, stop };
}
