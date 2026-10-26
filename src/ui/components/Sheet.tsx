import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { AppText } from './AppText';
import { liquidGlass } from './Glass';

type Props = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
};

/**
 * 弹层内容框架。iOS 26 不设背景色，由系统绘制液态玻璃弹层；
 * Android 自绘抓手与实色背景（PLAN §5 验证结论）。
 */
export function SheetLayout({ title, left, right, children, footer, scroll }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.root, { backgroundColor: liquidGlass ? 'transparent' : colors.surface }]}>
      {Platform.OS === 'android' ? (
        <View style={styles.grabberRow}>
          <View style={[styles.grabber, { backgroundColor: colors.waveIdle }]} />
        </View>
      ) : null}
      <View style={styles.header}>
        {left}
        <AppText variant="title" style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
        {right}
      </View>
      <Body style={styles.body} contentContainerStyle={scroll ? styles.scrollContent : undefined}>
        {children}
      </Body>
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grabberRow: { alignItems: 'center', paddingTop: 10 },
  grabber: { width: 36, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  title: { flex: 1 },
  body: { flex: 1, paddingHorizontal: spacing.xl },
  scrollContent: { gap: spacing.sm, paddingBottom: spacing.lg },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
});
