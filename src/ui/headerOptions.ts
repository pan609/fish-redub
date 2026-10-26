import { Platform } from 'react-native';

import type { Colors } from './tokens';

/**
 * 页面导航栏：iOS 使用透明大标题（iOS 26 滚动后变为液态玻璃导航栏）；
 * Android 透明标题会与内容重叠（PLAN §5），改用实色导航栏。
 */
export function stackHeaderOptions(colors: Colors) {
  if (Platform.OS === 'ios') {
    return {
      headerLargeTitle: true,
      headerTransparent: true,
      headerShadowVisible: false,
      headerLargeTitleShadowVisible: false,
      headerTintColor: colors.textPrimary,
      headerLargeTitleStyle: { color: colors.textPrimary, fontWeight: '800' as const },
      headerTitleStyle: { color: colors.textPrimary },
      contentStyle: { backgroundColor: colors.bg },
    };
  }
  return {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' as const },
    contentStyle: { backgroundColor: colors.bg },
  };
}
