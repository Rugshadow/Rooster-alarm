import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Falls back to a 56dp floor on Android when neither the safe-area-context inset
// nor StatusBar.currentHeight report a usable value — covers emulator/theme combos
// where the system silently fails to dispatch WindowInsets even with edge-to-edge on.
export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0,
    Platform.OS === 'android' ? 56 : 0,
  );
}
