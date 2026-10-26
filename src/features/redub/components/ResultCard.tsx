import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { findVoice } from '@/config/voices';
import type { DubResult } from '@/features/redub/machine';
import { audioCoordinator } from '@/services/audio/coordinator';
import { toAppError, type AppError } from '@/services/errors';
import { exportAudio, shareAudio } from '@/services/export';
import { AppText } from '@/ui/components/AppText';
import { AudioPlayer } from '@/ui/components/AudioPlayer';
import { Button, ButtonRow } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { InlineAlert } from '@/ui/components/InlineAlert';
import { VoiceAvatar } from '@/ui/components/Misc';
import { useToast } from '@/ui/components/Toast';
import { useTheme } from '@/ui/theme';
import { exportFileName, formatListTime } from '@/utils/format';

/** 分享 / 导出（结果卡片与历史详情共用）。取消不当作失败（PRD S4） */
export function useExportActions(dubUri: string, voiceName: string, createdAt: string) {
  const [error, setError] = useState<AppError | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast((s) => s.show);
  const name = exportFileName(voiceName, createdAt);

  const run = async (fn: () => Promise<'shared' | 'saved' | 'cancelled'>) => {
    if (busy) return;
    audioCoordinator.stopAll();
    setError(null);
    setBusy(true);
    try {
      const outcome = await fn();
      if (outcome === 'saved') toast('已导出到所选目录');
    } catch (e) {
      setError(toAppError(e, 'save_failed'));
    } finally {
      setBusy(false);
    }
  };

  return {
    error,
    busy,
    share: () => run(() => shareAudio(dubUri, name)),
    exportFile: () => run(() => exportAudio(dubUri, name)),
  };
}

export function ResultCard({ result, expired }: { result: DubResult; expired: boolean }) {
  const { colors } = useTheme();
  const voice = findVoice(result.snapshot.voiceId);
  const { error, busy, share, exportFile } = useExportActions(result.dubUri, result.snapshot.voiceName, result.createdAt);

  return (
    <View style={{ gap: 12 }}>
      {expired ? (
        <InlineAlert kind="warning" message="文字或声音已修改，下方结果对应修改前的内容，仍可试听和导出" testID="alert.expired" />
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.bg, opacity: expired ? 0.7 : 1 }]} testID="result.card">
        <View style={styles.head}>
          {voice ? <VoiceAvatar source={voice.avatar} size={24} /> : null}
          <AppText variant="headline" style={{ flex: 1 }} numberOfLines={1}>
            {result.snapshot.voiceName}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {formatListTime(result.createdAt)}
          </AppText>
        </View>
        <AppText variant="callout" color="textSecondary" numberOfLines={3} testID="result.text">
          {result.snapshot.finalText}
        </AppText>
        <AudioPlayer playbackKey={`result-src-${result.recordId}`} source={{ uri: result.sourceUri }} label="原音" name="原音" testID="result.play.source" />
        <AudioPlayer
          playbackKey={`result-dub-${result.recordId}`}
          source={{ uri: result.dubUri }}
          label="新配音"
          name="新配音"
          knownDurationMs={result.durationMs}
          testID="result.play.dub"
        />
      </View>
      {error ? <InlineAlert kind="error" message={error.message} actionLabel="重试" onAction={exportFile} testID="alert.export" /> : null}
      <ButtonRow>
        <Button label="分享" icon="share" variant="secondary" onPress={share} disabled={busy} style={{ flex: 1 }} testID="result.share" />
        <Button label="导出" icon="export" variant="secondary" onPress={exportFile} disabled={busy} style={{ flex: 1 }} testID="result.export" />
      </ButtonRow>
      {!expired ? (
        <View style={styles.saved}>
          <Icon name="success" size={15} color={colors.successText} />
          <AppText variant="caption" color="successText">
            已保存到历史
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
