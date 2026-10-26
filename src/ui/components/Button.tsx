import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { hitSlop, radius } from '../tokens';
import { AppText } from './AppText';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/** 胶囊按钮：primary 为黑色主按钮（一个阶段只有一个），secondary 为暖灰次按钮 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  testID,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';
  const bg = inactive && isPrimary ? colors.surfaceMuted : isPrimary ? colors.primary : colors.surfaceMuted;
  const fg = inactive
    ? colors.textTertiary
    : isPrimary
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.danger
        : colors.textPrimary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { height: isPrimary ? 52 : 48, backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={17} color={fg} /> : null}
      <AppText variant="headline" style={{ color: fg }} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

type TextButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  testID?: string;
};

/** 行内文字按钮（更换、编辑、恢复原文），用 accentText 保证对比度 */
export function TextButton({ label, onPress, icon, disabled, testID }: TextButtonProps) {
  const { colors } = useTheme();
  const color = disabled ? colors.textTertiary : colors.accentText;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop(24)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.6 : 1 }]}>
      {icon ? <Icon name={icon} size={15} color={color} /> : null}
      <AppText variant="callout" style={{ color, fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  testID?: string;
  disabled?: boolean;
};

/** 圆形图标按钮：iOS 26 为可交互玻璃，其他平台为暖灰实色 */
export function IconButton({ icon, onPress, accessibilityLabel, size = 40, testID, disabled }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop(size)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Glass
        fallbackColor={colors.surfaceMuted}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={disabled ? colors.textTertiary : colors.textPrimary} />
      </Glass>
    </Pressable>
  );
}

/** 两个等宽按钮并排 */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', gap: 12 },
});
