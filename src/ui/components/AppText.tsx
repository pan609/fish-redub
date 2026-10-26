import { Text, type TextProps } from 'react-native';

import { useTheme } from '../theme';
import { typography, type ColorName, type TypographyVariant } from '../tokens';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: ColorName;
};

// 计时和大标题最多放大 1.3 倍，避免大字体下破版（DESIGN §3.2）
const LIMITED: TypographyVariant[] = ['display', 'timer'];

export function AppText({ variant = 'body', color = 'textPrimary', style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={LIMITED.includes(variant) ? 1.3 : undefined}
      {...rest}
      style={[typography[variant], { color: colors[color] }, style]}
    />
  );
}
