import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioPlayer as useExpoAudioPlayer } from 'expo-audio';
import { registerAudioStop } from '../lib/audioRegistry';

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const player = useExpoAudioPlayer(null);

  useEffect(() => {
    return registerAudioStop(() => {
      player.pause();
      currentIdRef.current = null;
      setPlayingId(null);
    });
  }, [player]);

  const play = useCallback(async (id: string, uri: string) => {
    if (currentIdRef.current === id) {
      player.pause();
      currentIdRef.current = null;
      setPlayingId(null);
      return;
    }

    if (!uri) return;
    currentIdRef.current = id;
    setPlayingId(id);
    player.replace({ uri });
    player.play();
  }, [player]);

  const stop = useCallback(async () => {
    player.pause();
    currentIdRef.current = null;
    setPlayingId(null);
  }, [player]);

  return { playingId, play, stop };
}
