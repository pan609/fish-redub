import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { IMPORT_MESSAGES } from '@/copy/strings';
import { pickAndValidateAudio } from '@/features/importer/importAudio';
import { isDubLocked } from '@/features/redub/machine';
import { useRedub } from '@/features/redub/store';
import { audioCoordinator } from '@/services/audio/coordinator';
import { appError } from '@/services/errors';
import { AppText } from '@/ui/components/AppText';
import { AudioPlayer } from '@/ui/components/AudioPlayer';
import { TextButton } from '@/ui/components/Button';
import { Icon, type IconName } from '@/ui/components/Icon';
import { InlineAlert } from '@/ui/components/InlineAlert';
import { StepCard } from '@/ui/components/StepCard';
import { useTheme } from '@/ui/theme';
import { accentGradient, radius } from '@/ui/tokens';
import { formatDuration, formatSize } from '@/utils/format';

/** 录音与导入入口（第 ① 步、转写为空时的"重新录音 / 重新导入"共用） */
export function useSourceActions() {
  const locked = useRedub(isDubLocked);
  const beginSourceChange = useRedub((s) => s.beginSourceChange);
  const endSourceChange = useRedub((s) => s.endSourceChange);
  const acceptSource = useRedub((s) => s.acceptSource);

  const openRecorder = () => {
    if (locked) return;
    router.push('/recorder');
  };

  const importFile = async () => {
    if (!beginSourceChange()) return;
    audioCoordinator.stopAll();
    try {
      const r = await pickAndValidateAudio();
      if (r.kind === 'ok') acceptSource(r.audio);
      else if (r.kind === 'cancelled') endSourceChange(); // PRD I2：取消不提示
      else endSourceChange(appError('bad_audio', { message: r.message }));
    } catch (e) {
      endSourceChange(appError('bad_audio', { message: IMPORT_MESSAGES.unreadable, detail: String(e) }));
    }
  };

  return { locked, openRecorder, importFile };
}

export function StepAudio() {
  const { colors } = useTheme();
  const source = useRedub((s) => s.source);
  const busy = useRedub((s) => s.sourceBusy);
  const error = useRedub((s) => s.sourceError);
  const { locked, openRecorder, importFile } = useSourceActions();

  const change = () =>
    Alert.alert('更换音频', '更换后会重新转写，当前文字和配音结果将被替换。', [
      { text: '录音', onPress: openRecorder },
      { text: '导入文件', onPress: importFile },
      { text: '取消', style: 'cancel' },
    ]);

  const ready = source.kind === 'ready';
  return (
    <StepCard
      index={1}
      title="音频"
      state={ready && !busy ? 'done' : 'active'}
      status={busy ? '读取中' : ready ? '已就绪' : '添加一段语音'}
      action={ready && !busy ? <TextButton label="更换" onPress={change} disabled={locked} testID="step.audio.change" /> : undefined}
      testID="step.audio">
      {error ? (
        <InlineAlert kind="error" message={error.message} actionLabel="重新选择" onAction={importFile} testID="alert.source" />
      ) : null}

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accent} />
          <AppText variant="callout" color="textSecondary">
            正在读取文件…
          </AppText>
        </View>
      ) : null}

      {!ready && !busy ? (
        <>
          <View style={styles.tiles}>
            <Tile icon="mic" label="录音" gradient onPress={openRecorder} testID="step.audio.record" disabled={locked} />
            <Tile icon="folder" label="导入文件" onPress={importFile} testID="step.audio.import" disabled={locked} />
          </View>
          <AppText variant="caption" color="textTertiary">
            1–60 秒 · MP3 / WAV / M4A · 不超过 10MB
          </AppText>
        </>
      ) : null}

      {ready && !busy ? (
        <>
          <View style={styles.source}>
            <View style={[styles.srcIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name={source.audio.type === 'record' ? 'mic' : 'file'} size={17} color={colors.accentText} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="headline" numberOfLines={1} testID="step.audio.name">
                {source.audio.name}
              </AppText>
              <AppText variant="caption" color="textTertiary">
                {source.audio.type === 'record' ? '录音' : '导入'} · {formatDuration(source.audio.durationMs)} · {formatSize(source.audio.sizeBytes)}
              </AppText>
            </View>
          </View>
          <AudioPlayer
            playbackKey={`source-${source.audio.id}`}
            source={{ uri: source.audio.uri }}
            name="原音"
            knownDurationMs={source.audio.durationMs}
            testID="step.audio.play"
          />
        </>
      ) : null}
    </StepCard>
  );
}

function Tile(props: { icon: IconName; label: string; gradient?: boolean; onPress: () => void; testID: string; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={props.testID}
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [styles.tile, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.8 : props.disabled ? 0.5 : 1 }]}>
      <View
        style={[
          styles.tileIcon,
          props.gradient
            ? { experimental_backgroundImage: `linear-gradient(135deg, ${accentGradient[0]}, ${accentGradient[1]})` }
            : { backgroundColor: colors.primary },
        ]}>
        <Icon name={props.icon} size={22} color={props.gradient ? '#FFFFFF' : colors.onPrimary} />
      </View>
      <AppText variant="headline">{props.label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, alignItems: 'center', gap: 10, paddingVertical: 20, borderRadius: radius.input },
  tileIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  srcIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
