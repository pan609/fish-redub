import { useNetworkState } from 'expo-network';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { env } from '@/config/env';
import { StepAudio } from '@/features/redub/components/StepAudio';
import { StepDub } from '@/features/redub/components/StepDub';
import { StepText } from '@/features/redub/components/StepText';
import { StepVoice } from '@/features/redub/components/StepVoice';
import { visibleResult } from '@/features/redub/machine';
import { useRedub } from '@/features/redub/store';
import { audioCoordinator } from '@/services/audio/coordinator';
import { ERROR_MESSAGES } from '@/copy/strings';
import { AppText } from '@/ui/components/AppText';
import { InlineAlert } from '@/ui/components/InlineAlert';
import { AmbientGlow } from '@/ui/components/Misc';
import { useTheme } from '@/ui/theme';
import { spacing } from '@/ui/tokens';

const STEPS = ['音频', '文字', '声音', '配音'];

/** 当前所在步骤：第一个未完成的步骤 */
function useCurrentStep() {
  return useRedub((s) => {
    if (s.source.kind !== 'ready') return 0;
    if (s.text.kind !== 'confirmed') return 1;
    const result = visibleResult(s);
    if (s.dub.kind === 'success' && result) return 4;
    return 3;
  });
}

export default function RedubScreen() {
  const { colors } = useTheme();
  const network = useNetworkState();
  const current = useCurrentStep();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const textY = useRef(0);

  // PRD A3：离开页面时暂停播放
  useFocusEffect(useCallback(() => () => audioCoordinator.stopAll(), []));

  const offline = network.isConnected === false || network.isInternetReachable === false;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AmbientGlow />
      <Stack.Screen
        options={{
          title: '配音',
          headerRight: () => <BrandMark />,
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        testID="redub.scroll">
        {!env.isConfigured ? <InlineAlert kind="error" message={ERROR_MESSAGES.not_configured} testID="alert.not_configured" /> : null}
        {offline ? <InlineAlert kind="warning" message="网络不可用，转写和配音需要联网" testID="alert.offline_banner" /> : null}

        <Stepper current={current} />
        <StepAudio />
        <View onLayout={(e) => (textY.current = e.nativeEvent.layout.y)}>
          <StepText onInputFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, textY.current - 12), animated: true }), 250)} />
        </View>
        <StepVoice />
        <StepDub />
      </ScrollView>
    </View>
  );
}

function Stepper({ current }: { current: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepper} accessible accessibilityLabel={`进度：第 ${Math.min(current + 1, 4)} 步，共 4 步`}>
      <View style={styles.stepperRow}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[styles.seg, { backgroundColor: i < current ? colors.textPrimary : i === current ? colors.accent : colors.waveIdle }]}
          />
        ))}
      </View>
      <View style={styles.stepperRow}>
        {STEPS.map((s, i) => (
          <AppText
            key={s}
            variant="caption"
            style={[styles.stepLabel, { color: i < current ? colors.textPrimary : i === current ? colors.accentText : colors.textTertiary }]}>
            {s}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/** Fish 风格的竖条品牌标志；开发构建中长按打开故障注入面板 */
function BrandMark() {
  const { colors } = useTheme();
  return (
    <Pressable
      onLongPress={__DEV__ ? () => router.push('/debug') : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="brand.mark"
      style={styles.brand}>
      {[8, 14, 20, 12, 22, 16, 10].map((h, i) => (
        <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: colors.accent }} />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingTop: Platform.OS === 'android' ? spacing.sm : spacing.xl, gap: 14, paddingBottom: 48 },
  stepper: { gap: 6, marginBottom: 2 },
  stepperRow: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, height: 32 },
});
