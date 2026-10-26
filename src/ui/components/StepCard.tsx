import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { onAccent, radius, spacing } from '../tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

export type StepState = 'locked' | 'active' | 'done' | 'expired';

type Props = {
  index: number;
  title: string;
  state: StepState;
  /** 头部右侧状态文字，例如"已就绪""待确认" */
  status?: string;
  /** 头部右侧附加操作（编辑、更换） */
  action?: ReactNode;
  children?: ReactNode;
  testID?: string;
};

const STATE_LABEL: Record<StepState, string> = { locked: '未解锁', active: '进行中', done: '已完成', expired: '已过期' };

/**
 * 步骤卡片（DESIGN §4）。未解锁状态不使用整体透明度，
 * 改用 textTertiary，保证前置条件说明可读。
 */
export function StepCard({ index, title, state, status, action, children, testID }: Props) {
  const { colors, scheme } = useTheme();
  const badgeBg =
    state === 'done' ? colors.success : state === 'active' ? colors.accent : state === 'expired' ? colors.textTertiary : colors.surfaceMuted;
  const statusColor =
    state === 'done' ? colors.successText : state === 'active' ? colors.accentText : colors.textTertiary;

  return (
    <View
      testID={testID}
      accessible={false}
      style={[
        styles.card,
        { backgroundColor: colors.surface },
        scheme === 'light' ? styles.shadow : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
      ]}>
      <View
        style={styles.header}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`第${index}步，${title}，${status ?? STATE_LABEL[state]}`}>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          {state === 'done' ? (
            <Icon name="check" size={14} color="#FFFFFF" />
          ) : state === 'expired' ? (
            <Icon name="regenerate" size={13} color="#FFFFFF" />
          ) : (
            <AppText variant="caption" style={{ color: state === 'active' ? onAccent : colors.textTertiary, fontWeight: '700' }}>
              {index}
            </AppText>
          )}
        </View>
        <AppText variant="headline" color={state === 'locked' ? 'textTertiary' : 'textPrimary'} style={styles.title}>
          {title}
        </AppText>
        {action}
        {status ? (
          <AppText variant="caption" style={{ color: statusColor }} numberOfLines={1}>
            {status}
          </AppText>
        ) : null}
      </View>
      {children ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: spacing.lg, gap: 14 },
  shadow: {
    shadowColor: '#1D1D1D',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  body: { gap: spacing.md },
});
