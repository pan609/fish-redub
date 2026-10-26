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

  const header = (
    <>
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
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: liquidGlass ? 'transparent' : colors.surface }]}>
      {scroll ? (
        // iOS 原生弹层会接管其中 ScrollView 的位置（贴到弹层顶部），
        // 所以标题放进 ScrollView 内部，避免与内容重叠（M9 联调发现）
        <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent} contentInsetAdjustmentBehavior="never">
          {header}
          <View style={styles.scrollBody}>{children}</View>
        </ScrollView>
      ) : (
        <>
          {header}
          <View style={styles.body}>{children}</View>
        </>
      )}
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
  scrollContent: { paddingBottom: spacing.xxl },
  scrollBody: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
});
