import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

const TABS: Record<string, { label: string; icon: IconName }> = {
  '(redub)': { label: '配音', icon: 'waveform' },
  history: { label: '历史', icon: 'history' },
};

/**
 * Android 的浮动胶囊 Tab Bar：与 iOS 26 液态玻璃 Tab Bar 保持同样的形态与交互
 * （浮动胶囊、选中项浅底高亮、强调色图标），以实色 + 阴影代替玻璃（PM 反馈：双端体验对齐）。
 */
export function FloatingTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View
        style={[
          styles.capsule,
          {
            backgroundColor: scheme === 'dark' ? 'rgba(42,38,39,0.96)' : 'rgba(255,255,255,0.96)',
            borderColor: colors.border,
          },
        ]}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? colors.accent : colors.textTertiary;
          const onPress = () => {
            if (!focused) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={[styles.item, focused && { backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(29,29,29,0.05)' }]}>
              <Icon name={tab.icon} size={22} color={color} />
              <AppText variant="caption" style={{ color, fontSize: 11, fontWeight: focused ? '700' : '500' }} maxFontSizeMultiplier={1.2}>
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  capsule: {
    flexDirection: 'row',
    width: 220,
    height: 62,
    borderRadius: 31,
    padding: 6,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#1D1D1D',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  item: { flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
