import { Text, type TextProps } from 'react-native';

import { useTheme } from '../theme';
import { typography, type ColorName, type TypographyVariant } from '../tokens';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: ColorName;
};

// 支持系统字体放大，但设上限避免破版（DESIGN §3.2 / §5.9）：
// 计时和大标题最多 1.3 倍，其余文字最多 1.8 倍
const LIMITED: TypographyVariant[] = ['display', 'timer'];
export const MAX_FONT_SCALE = 1.8;

export function AppText({ variant = 'body', color = 'textPrimary', style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={LIMITED.includes(variant) ? 1.3 : MAX_FONT_SCALE}
      {...rest}
      style={[typography[variant], { color: colors[color] }, style]}
    />
  );
}
