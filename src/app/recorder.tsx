import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { RECORD_MESSAGES } from '@/copy/strings';
import { MAX_RECORD_MS, useRecorderSession } from '@/features/recorder/useRecorderSession';
import { useRedub } from '@/features/redub/store';
import { AppText } from '@/ui/components/AppText';
import { AudioPlayer } from '@/ui/components/AudioPlayer';
import { Button, ButtonRow, IconButton } from '@/ui/components/Button';
import { Glass } from '@/ui/components/Glass';
import { Icon } from '@/ui/components/Icon';
import { InlineAlert } from '@/ui/components/InlineAlert';
import { SheetLayout } from '@/ui/components/Sheet';
import { useTheme } from '@/ui/theme';
import { accentGradient, typography } from '@/ui/tokens';
import { formatDuration, formatSize, recordingName } from '@/utils/format';

const LEVELS = 44;

export default function RecorderSheet() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const session = useRecorderSession();
  const { phase } = session;
  const acceptSource = useRedub((s) => s.acceptSource);
  const [levels, setLevels] = useState<number[]>([]);
  const closingRef = useRef(false);

  // 录音中禁止下滑关闭，避免误触（DESIGN §5.4）
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: phase.kind !== 'recording' && phase.kind !== 'finalizing' && phase.kind !== 'starting' });
  }, [navigation, phase.kind]);

  // 录音电平 → 实时波形：每 100ms 采样一次最新电平
  const meteringRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    meteringRef.current = session.metering;
  }, [session.metering]);
  useEffect(() => {
    if (phase.kind !== 'recording') return;
    const timer = setInterval(() => {
      const db = meteringRef.current ?? -60;
      const v = Math.min(1, Math.max(0.08, (db + 55) / 55));
      setLevels((prev) => [...prev.slice(-(LEVELS - 1)), v]);
    }, 100);
    return () => clearInterval(timer);
  }, [phase.kind]);

  const startRecording = () => {
    setLevels([]);
    void session.start();
  };

  // 重录时清空上一段的波形，避免误以为仍有录音
  const retake = () => {
    setLevels([]);
    session.retake();
  };

  // 弹层关闭（未点"使用此录音"）时丢弃录音文件
  const discardRef = useRef(session.discard);
  useEffect(() => {
    discardRef.current = session.discard;
  });
  useEffect(() => {
    return () => {
      if (!closingRef.current) void discardRef.current();
    };
  }, []);

  const close = () => {
    if (phase.kind === 'recording') {
      Alert.alert('放弃本次录音？', undefined, [
        { text: '继续录音', style: 'cancel' },
        { text: '放弃', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  };

  const use = async () => {
    const audio = await session.accept();
    if (!audio) return;
    closingRef.current = true;
    acceptSource(audio);
    router.back();
  };

  const remainingMs = MAX_RECORD_MS - session.elapsedMs;

  const body = (() => {
    switch (phase.kind) {
      case 'checking':
        return null;
      case 'permissionPrompt':
      case 'denied': {
        const denied = phase.kind === 'denied';
        return (
          <View style={styles.center}>
            <View style={[styles.permIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name={denied ? 'micOff' : 'mic'} size={30} color={colors.accentText} />
            </View>
            <AppText variant="title" style={styles.centerText}>
              {denied ? RECORD_MESSAGES.deniedTitle : RECORD_MESSAGES.permissionTitle}
            </AppText>
            <AppText variant="body" color="textSecondary" style={styles.centerText}>
              {denied ? RECORD_MESSAGES.deniedBody : RECORD_MESSAGES.permissionBody}
            </AppText>
          </View>
        );
      }
      case 'preview':
        return (
          <View style={styles.previewBox}>
            {phase.notice ? <InlineAlert kind="warning" message={phase.notice} testID="recorder.notice" /> : null}
            <View style={[styles.clip, { backgroundColor: colors.bg }]}>
              <View style={styles.clipHead}>
                <View style={[styles.srcIcon, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="mic" size={17} color={colors.accentText} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="headline" numberOfLines={1}>
                    {recordingName(phase.createdAt)}
                  </AppText>
                  <AppText variant="caption" color="textTertiary">
                    {formatDuration(phase.durationMs)} · {formatSize(phase.sizeBytes)}
                  </AppText>
                </View>
              </View>
              <AudioPlayer
                playbackKey={`recording-${phase.uri}`}
                source={{ uri: phase.uri }}
                name="录音"
                knownDurationMs={phase.durationMs}
                testID="recorder.play"
              />
            </View>
          </View>
        );
      case 'invalid':
        return (
          <View style={styles.previewBox}>
            <InlineAlert kind="warning" message={phase.message} testID="recorder.invalid" />
          </View>
        );
      default: {
        const recording = phase.kind === 'recording';
        return (
          <View style={styles.center}>
            <View style={styles.timerRow} accessible accessibilityLabel={`已录制 ${Math.floor(session.elapsedMs / 1000)} 秒，上限 60 秒`}>
              <AppText
                variant="timer"
                testID="recorder.timer"
                style={{ color: recording && remainingMs <= 10_000 ? colors.accentText : colors.textPrimary }}>
                {formatDuration(session.elapsedMs)}
              </AppText>
              <AppText variant="headline" color="textTertiary" style={typography.headline}>
                / 01:00
              </AppText>
            </View>
            <View style={styles.levels}>
              {Array.from({ length: LEVELS }).map((_, i) => {
                const v = levels[i - (LEVELS - levels.length)] ?? 0;
                return (
                  <View
                    key={i}
                    style={{ width: 3, height: Math.max(6, v * 64), borderRadius: 2, backgroundColor: v > 0 ? colors.accent : colors.waveIdle }}
                  />
                );
              })}
            </View>
            <RecordButton
              recording={recording}
              busy={phase.kind === 'finalizing' || phase.kind === 'starting'}
              onPress={recording ? session.stop : startRecording}
            />
            <AppText variant="callout" color="textSecondary">
              {recording
                ? '正在录音 · 再次点击结束'
                : phase.kind === 'finalizing'
                  ? '正在保存录音…'
                  : phase.kind === 'starting'
                    ? '正在准备录音…'
                    : '点击开始录音，最长 60 秒'}
            </AppText>
          </View>
        );
      }
    }
  })();

  const footer = (() => {
    switch (phase.kind) {
      case 'permissionPrompt':
        return <Button label="继续" onPress={session.requestPermission} testID="recorder.permission" />;
      case 'denied':
        return (
          <>
            <Button label="去设置开启" onPress={session.openSettings} testID="recorder.settings" />
            <Button label="改为导入文件" variant="secondary" onPress={() => router.back()} testID="recorder.importInstead" />
          </>
        );
      case 'preview':
        return (
          <ButtonRow>
            <Button label="重录" variant="secondary" onPress={retake} style={{ flex: 1 }} testID="recorder.retake" />
            <Button label="使用此录音" onPress={use} style={{ flex: 1 }} testID="recorder.use" />
          </ButtonRow>
        );
      case 'invalid':
        return <Button label="重新录音" onPress={retake} testID="recorder.retry" />;
      default:
        return null;
    }
  })();

  return (
    <SheetLayout
      title="录音"
      left={<IconButton icon="close" onPress={close} accessibilityLabel="关闭录音" testID="recorder.close" />}
      footer={footer}>
      {body}
    </SheetLayout>
  );
}

function RecordButton({ recording, busy, onPress }: { recording: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID="recorder.toggle"
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={recording ? '结束录音' : '开始录音'}>
      <Glass tintColor="rgba(255,140,34,0.18)" fallbackColor="rgba(255,140,34,0.14)" style={styles.ring}>
        <View style={[styles.recordBtn, { experimental_backgroundImage: `linear-gradient(135deg, ${accentGradient[0]}, ${accentGradient[1]})` }]}>
          {recording ? <View style={styles.stopSquare} /> : <Icon name="mic" size={28} color="#FFFFFF" />}
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 20, paddingTop: 12 },
  centerText: { textAlign: 'center' },
  permIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  timerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  levels: { height: 72, flexDirection: 'row', alignItems: 'center', gap: 3 },
  ring: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  recordBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#FFFFFF' },
  previewBox: { gap: 14, paddingTop: 4 },
  clip: { borderRadius: 20, padding: 16, gap: 14 },
  clipHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  srcIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
