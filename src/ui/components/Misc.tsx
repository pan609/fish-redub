import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius } from '../tokens';
import { AppText } from './AppText';

/** 语言 / 状态标签 */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: tone === 'accent' ? colors.accentSoft : colors.surfaceMuted }]}>
      <AppText variant="caption" style={{ color: tone === 'accent' ? colors.accentText : colors.textSecondary }}>
        {label}
      </AppText>
    </View>
  );
}

/** 圆形声音头像；选中时外圈描边 */
export function VoiceAvatar({ source, size, selected }: { source: number; size: number; selected?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: selected ? 2 : 0,
        borderColor: colors.primary,
        padding: selected ? 2 : 0,
      }}>
      <Image source={source} style={{ flex: 1, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />
    </View>
  );
}

/** 页面背景的两团暖色光晕，让液态玻璃有可以折射的内容（DESIGN §7.1） */
export function AmbientGlow() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.glow, { top: -140, right: -120, backgroundColor: colors.glowA }]} />
      <View style={[styles.glow, { top: 420, left: -160, backgroundColor: colors.glowB }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.chip, alignSelf: 'flex-start' },
  glow: { position: 'absolute', width: 340, height: 340, borderRadius: 170, filter: [{ blur: 80 }] },
});
