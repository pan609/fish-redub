import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

// 运行时只判断一次：iOS 26 为 true，Android 与旧版 iOS 为 false
export const liquidGlass = isLiquidGlassAvailable();

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 玻璃着色；降级时作为实色背景 */
  tintColor?: ColorValue;
  /** 降级时的背景色（未设 tintColor 时使用） */
  fallbackColor: ColorValue;
  interactive?: boolean;
};

// 注意：可交互玻璃（isInteractive）会在原生层拦截触摸，放在 Pressable 内部时会导致
// onPress 不触发（M9 联调发现）。按钮内的玻璃只做视觉，触摸交给外层 Pressable。

/**
 * 液态玻璃容器。M0 验证：Android 上 GlassView 渲染为透明 View，
 * 所以不可用时必须渲染带背景色的普通 View（PLAN §5）。
 */
export function Glass({ children, style, tintColor, fallbackColor, interactive }: Props) {
  if (liquidGlass) {
    return (
      <GlassView isInteractive={interactive} tintColor={tintColor} style={style} pointerEvents={interactive ? 'auto' : 'none'}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[{ backgroundColor: tintColor ?? fallbackColor }, style]} pointerEvents={interactive ? 'auto' : 'none'}>
      {children}
    </View>
  );
}
