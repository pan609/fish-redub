import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';

import { findVoice } from '@/config/voices';
import { canGenerate, isResultExpired, visibleResult, type DubResult } from '@/features/redub/machine';
import { useRedub } from '@/features/redub/store';
import type { AppError } from '@/services/errors';
import { AppText } from '@/ui/components/AppText';
import { Button, TextButton } from '@/ui/components/Button';
import { InlineAlert } from '@/ui/components/InlineAlert';
import { StepCard, type StepState } from '@/ui/components/StepCard';
import { useTheme } from '@/ui/theme';

import { ResultCard } from './ResultCard';

/** 429 时按 Retry-After 倒计时，结束前不能重试（PRD §7.2） */
function useRetryCountdown(error: AppError | undefined) {
  const total = error?.code === 'rate_limit' ? (error.retryAfterSec ?? 0) : 0;
  const [tracked, setTracked] = useState({ error, left: total });
  // 新的错误到来时重置倒计时（渲染期间根据 props 重置 state 的标准写法）
  if (tracked.error !== error) setTracked({ error, left: total });
  useEffect(() => {
    if (!total) return;
    const timer = setInterval(() => setTracked((t) => ({ ...t, left: Math.max(0, t.left - 1) })), 1000);
    return () => clearInterval(timer);
  }, [error, total]);
  return tracked.error === error ? tracked.left : total;
}

export function StepDub() {
  const state = useRedub();
  const { dub, generate, cancelGenerate, retrySave } = state;
  const voice = findVoice(state.voiceId);
  const ready = canGenerate(state);
  const result = visibleResult(state);
  const expired = result ? isResultExpired(state, result) : false;
  const error = dub.kind === 'failed' ? dub.error : undefined;
  const countdown = useRetryCountdown(error);

  const confirmed = state.text.kind === 'confirmed';
  if (!confirmed && !result) {
    return <StepCard index={4} title="配音" state="locked" status="选择声音后生成" testID="step.dub" />;
  }

  let stepState: StepState = 'active';
  let status = '可生成';
  if (dub.kind === 'generating') status = '生成中';
  else if (dub.kind === 'saving') status = '保存中';
  else if (dub.kind === 'failed') status = '生成失败';
  else if (dub.kind === 'saveFailed') status = '保存失败';
  else if (result && expired) [stepState, status] = ['expired', '已过期'];
  else if (result) [stepState, status] = ['done', '已完成'];

  const showGenerate = ready && (dub.kind === 'idle' || (dub.kind === 'success' && expired) || (dub.kind === 'failed' && !error?.retryable));
  const textChanged = state.text.kind === 'confirmed' && result ? result.snapshot.finalText !== state.text.finalText : false;
  const regenerateLabel = !result ? '生成配音' : !textChanged && result.snapshot.voiceId !== state.voiceId ? '用新声音重新生成' : '用新文字重新生成';

  return (
    <StepCard index={4} title="配音" state={stepState} status={status} testID="step.dub">
      {dub.kind === 'generating' ? (
        <Generating voiceName={dub.snapshot.voiceName} label="生成配音" onCancel={cancelGenerate} />
      ) : null}
      {dub.kind === 'saving' ? <Generating voiceName={dub.pending.snapshot.voiceName} label="正在保存配音…" /> : null}

      {dub.kind === 'failed' ? (
        <InlineAlert
          kind="error"
          message={countdown > 0 ? `${dub.error.message}（${countdown} 秒后可重试）` : dub.error.message}
          actionLabel={dub.error.retryable ? '重试' : undefined}
          actionDisabled={countdown > 0 || !ready}
          onAction={dub.error.retryable ? generate : undefined}
          testID={`alert.${dub.error.code}`}
        />
      ) : null}

      {dub.kind === 'saveFailed' ? (
        <InlineAlert kind="error" message={dub.error.message} actionLabel="重试保存" onAction={retrySave} testID="alert.save_failed" />
      ) : null}

      {!confirmed && result ? (
        <AppText variant="callout" color="textTertiary">
          确认文字后可重新生成
        </AppText>
      ) : null}

      {showGenerate && !result ? (
        <AppText variant="callout" color="textSecondary">
          将使用「{voice?.name}」朗读已确认的文字
        </AppText>
      ) : null}

      {result && dub.kind !== 'generating' && dub.kind !== 'saving' ? (
        <ResultCard result={result as DubResult} expired={expired} />
      ) : null}

      {showGenerate ? <Button label={regenerateLabel} onPress={generate} testID="step.dub.generate" /> : null}
    </StepCard>
  );
}

/** 阶段性加载状态：没有真实进度数据（PRD G2） */
function Generating({ voiceName, label, onCancel }: { voiceName: string; label: string; onCancel?: () => void }) {
  const { colors } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.pulse, { opacity: pulse }]}>
        {[12, 22, 34, 22, 12].map((h, i) => (
          <View key={i} style={{ width: 5, height: h, borderRadius: 3, backgroundColor: colors.accent }} />
        ))}
      </Animated.View>
      <AppText variant="callout" color="textSecondary">
        {onCancel ? `正在用「${voiceName}」的声音生成配音…` : label}
      </AppText>
      <View style={styles.busyBtn}>
        <ActivityIndicator color={colors.textTertiary} />
        <AppText variant="headline" color="textTertiary">
          {onCancel ? '生成中…' : '保存中…'}
        </AppText>
      </View>
      {onCancel ? <TextButton label="取消" onPress={onCancel} testID="step.dub.cancel" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  pulse: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36 },
  busyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
