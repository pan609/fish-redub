import { useEffect, useState } from 'react';
import { Animated, Keyboard, StyleSheet, TextInput, View } from 'react-native';

import { TEXT_LIMIT } from '@/copy/strings';
import { LANGUAGE_LABEL } from '@/config/voices';
import { isDubLocked, validateDraft } from '@/features/redub/machine';
import { useRedub } from '@/features/redub/store';
import { AppText } from '@/ui/components/AppText';
import { Button, TextButton } from '@/ui/components/Button';
import { InlineAlert } from '@/ui/components/InlineAlert';
import { Tag } from '@/ui/components/Misc';
import { StepCard, type StepState } from '@/ui/components/StepCard';
import { useTheme } from '@/ui/theme';
import { radius, typography } from '@/ui/tokens';

import { useSourceActions } from './StepAudio';
import { useRetryCountdown, withCountdown } from './useRetryCountdown';

export function StepText({ onInputFocus }: { onInputFocus?: () => void }) {
  const text = useRedub((s) => s.text);
  const sourceReady = useRedub((s) => s.source.kind === 'ready');
  const locked = useRedub(isDubLocked);
  const { startTranscribe, cancelTranscribe, startManualInput, editDraft, restoreTranscript, confirmText, reopenText } = useRedub();
  const { openRecorder, importFile } = useSourceActions();
  const countdown = useRetryCountdown(text.kind === 'failed' ? text.error : undefined);

  if (!sourceReady || text.kind === 'locked') {
    return <StepCard index={2} title="文字" state="locked" status="添加音频后自动转写" testID="step.text" />;
  }

  const meta: Record<string, [StepState, string]> = {
    transcribing: ['active', '转写中'],
    cancelled: ['active', '待转写'],
    failed: ['active', '转写失败'],
    empty: ['active', '未识别'],
    editing: ['active', '待确认'],
    confirmed: ['done', '已确认'],
  };
  const [state, status] = meta[text.kind];

  return (
    <StepCard
      index={2}
      title="文字"
      state={state}
      status={status}
      action={text.kind === 'confirmed' ? <TextButton label="编辑" onPress={reopenText} disabled={locked} testID="step.text.edit" /> : undefined}
      testID="step.text">
      {text.kind === 'transcribing' ? (
        <>
          <Skeleton />
          <View style={styles.row}>
            <AppText variant="callout" color="textSecondary" style={{ flex: 1 }}>
              正在转写…
            </AppText>
            <TextButton label="取消" onPress={cancelTranscribe} testID="step.text.cancel" />
          </View>
        </>
      ) : null}

      {text.kind === 'cancelled' ? (
        <>
          <AppText variant="callout" color="textSecondary">
            已取消转写，音频已保留。
          </AppText>
          <Button label="开始转写" onPress={startTranscribe} testID="step.text.start" />
        </>
      ) : null}

      {text.kind === 'failed' ? (
        <>
          <InlineAlert
            kind="error"
            message={withCountdown(text.error.message, countdown)}
            actionLabel={text.error.retryable ? '重试' : undefined}
            actionDisabled={countdown > 0}
            onAction={text.error.retryable ? startTranscribe : undefined}
            testID={`alert.${text.error.code}`}
          />
          <View style={styles.choices}>
            <Button label="重新录音" variant="secondary" onPress={openRecorder} style={styles.choice} />
            <Button label="重新导入" variant="secondary" onPress={importFile} style={styles.choice} />
            <Button label="手动输入" variant="secondary" onPress={startManualInput} style={styles.choice} />
          </View>
        </>
      ) : null}

      {text.kind === 'empty' ? (
        <>
          <InlineAlert kind="warning" message="未识别到有效语音。可以重新录音、重新导入，或手动输入文字。" testID="alert.empty" />
          <View style={styles.choices}>
            <Button label="重新录音" variant="secondary" onPress={openRecorder} style={styles.choice} testID="step.text.rerecord" />
            <Button label="重新导入" variant="secondary" onPress={importFile} style={styles.choice} testID="step.text.reimport" />
            <Button label="手动输入" variant="secondary" onPress={startManualInput} style={styles.choice} testID="step.text.manual" />
          </View>
        </>
      ) : null}

      {text.kind === 'editing' ? (
        <Editor
          draft={text.draft}
          transcript={text.transcript}
          language={text.language}
          disabled={locked}
          onChange={editDraft}
          onRestore={restoreTranscript}
          onConfirm={confirmText}
          onFocus={onInputFocus}
        />
      ) : null}

      {text.kind === 'confirmed' ? (
        <AppText variant="body" color="textSecondary" numberOfLines={4} testID="step.text.confirmed">
          {text.finalText}
        </AppText>
      ) : null}
    </StepCard>
  );
}

function Editor(props: {
  draft: string;
  transcript: string;
  language?: string;
  disabled: boolean;
  onChange: (t: string) => void;
  onRestore: () => void;
  onConfirm: () => void;
  onFocus?: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const problem = validateDraft(props.draft);
  const length = props.draft.trim().length;
  const canRestore = props.transcript.length > 0 && props.draft !== props.transcript;

  return (
    <>
      <View style={styles.row}>
        {props.language && LANGUAGE_LABEL[props.language] ? <Tag label={LANGUAGE_LABEL[props.language]} /> : <View />}
        <View style={{ flex: 1 }} />
        {canRestore ? <TextButton label="恢复原文" icon="undo" onPress={props.onRestore} testID="step.text.restore" /> : null}
      </View>
      <View
        style={[
          styles.input,
          { backgroundColor: colors.surfaceMuted, borderColor: focused ? colors.accent : 'transparent' },
        ]}>
        <TextInput
          testID="step.text.input"
          value={props.draft}
          onChangeText={props.onChange}
          editable={!props.disabled}
          multiline
          // 回车即"完成"并收起键盘：配音文字不需要换行，也避免键盘挡住确认按钮
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          placeholder="请输入要配音的文字"
          placeholderTextColor={colors.textTertiary}
          onFocus={() => {
            setFocused(true);
            props.onFocus?.();
          }}
          onBlur={() => setFocused(false)}
          style={[typography.body, styles.textInput, { color: colors.textPrimary }]}
          accessibilityLabel="配音文字"
          accessibilityHint="可修改错字、增删内容"
        />
        <AppText variant="caption" style={{ color: length > TEXT_LIMIT ? colors.danger : colors.textTertiary }} testID="step.text.count">
          {length} / {TEXT_LIMIT}
        </AppText>
      </View>
      {problem === 'empty' ? (
        <AppText variant="callout" color="textTertiary">
          请输入要配音的文字
        </AppText>
      ) : problem === 'too_long' ? (
        <AppText variant="callout" color="danger">
          文字超过 {TEXT_LIMIT} 字，请删减后再确认
        </AppText>
      ) : null}
      <Button
        label="确认文字"
        onPress={() => {
          Keyboard.dismiss();
          props.onConfirm();
        }}
        disabled={!!problem || props.disabled}
        testID="step.text.confirm"
      />
    </>
  );
}

/** 转写中的骨架闪烁；"减弱动态效果"开启时 RN 仍会执行，但幅度很小 */
function Skeleton() {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View style={{ gap: 8, opacity }}>
      {[1, 0.92, 0.6].map((w, i) => (
        <View key={i} style={{ height: 14, width: `${w * 100}%`, borderRadius: 7, backgroundColor: colors.surfaceMuted }} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderRadius: radius.input, borderWidth: 1.5, padding: 14, gap: 8 },
  textInput: { minHeight: 96, maxHeight: 240, padding: 0, textAlignVertical: 'top' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexGrow: 1, flexBasis: 96, paddingHorizontal: 8 },
});
