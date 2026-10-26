import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { hitSlop, radius } from '../tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  kind: 'error' | 'warning' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  testID?: string;
};

/** 卡片内的错误 / 警告条（DESIGN §4）。状态写在卡片里，不用全屏遮罩。 */
export function InlineAlert({ kind, message, actionLabel, onAction, actionDisabled, testID }: Props) {
  const { colors } = useTheme();
  const isError = kind === 'error';
  const bg = isError ? colors.dangerSoft : colors.accentSoft;
  const fg = isError ? colors.danger : colors.textPrimary;
  const iconColor = isError ? colors.danger : colors.accentText;

  return (
    <View testID={testID} style={[styles.box, { backgroundColor: bg }]} accessibilityRole="alert">
      <Icon name={isError ? 'error' : kind === 'warning' ? 'warning' : 'success'} size={17} color={iconColor} />
      <AppText variant="callout" style={[styles.message, { color: fg, fontWeight: '500' }]}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          testID={testID ? `${testID}.action` : undefined}
          onPress={onAction}
          disabled={actionDisabled}
          hitSlop={hitSlop(24)}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}>
          <AppText
            variant="callout"
            style={{ color: actionDisabled ? colors.textTertiary : isError ? colors.danger : colors.accentText, fontWeight: '700' }}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.alert },
  message: { flex: 1 },
});
