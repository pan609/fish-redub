import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useTheme } from '../theme';
import { AppText } from './AppText';

// 轻提示（DESIGN §5.8）：只用于"已导出到所选目录"等成功反馈，错误一律写在卡片里
type ToastState = { message: string | null; seq: number; show: (message: string) => void };

export const useToast = create<ToastState>((set, get) => ({
  message: null,
  seq: 0,
  show: (message) => set({ message, seq: get().seq + 1 }),
}));

export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { message, seq } = useToast();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [message, seq, opacity]);

  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom: insets.bottom + 96, backgroundColor: colors.primary, opacity }]}>
      <AppText variant="callout" style={{ color: colors.onPrimary, fontWeight: '600' }}>
        {message}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
});
