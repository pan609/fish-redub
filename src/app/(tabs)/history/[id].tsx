import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { findVoice, LANGUAGE_LABEL } from '@/config/voices';
import { useExportActions } from '@/features/redub/components/ResultCard';
import { findRecord, useHistory } from '@/features/history/store';
import { audioCoordinator } from '@/services/audio/coordinator';
import { toAppError, type AppError } from '@/services/errors';
import type { LoadedRecord } from '@/services/storage/historyRepo';
import { AppText } from '@/ui/components/AppText';
import { AudioPlayer } from '@/ui/components/AudioPlayer';
import { Button } from '@/ui/components/Button';
import { InlineAlert } from '@/ui/components/InlineAlert';
import { AmbientGlow, Tag, VoiceAvatar } from '@/ui/components/Misc';
import { useTheme } from '@/ui/theme';
import { radius, spacing } from '@/ui/tokens';
import { formatFullTime } from '@/utils/format';

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const item = useHistory((s) => findRecord(s.records, id));
  useFocusEffect(useCallback(() => () => audioCoordinator.stopAll(), []));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AmbientGlow />
      <Stack.Screen options={{ title: '', headerLargeTitle: false, headerBackTitle: '历史' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {!item ? (
          <InlineAlert kind="warning" message="记录不存在或已删除" />
        ) : item.kind === 'broken' ? (
          <BrokenRecord id={item.id} />
        ) : (
          <Detail item={item} />
        )}
      </ScrollView>
    </View>
  );
}

function Detail({ item }: { item: Extract<LoadedRecord, { kind: 'ok' }> }) {
  const { colors } = useTheme();
  const { record } = item;
  const voice = findVoice(record.voice.id);
  const edited = record.finalText !== record.transcript;
  const { error, busy, share, exportFile } = useExportActions(item.dubUri, record.voice.name, record.createdAt);
  const remove = useDelete(record.id);

  return (
    <>
      <View style={styles.head}>
        {voice ? <VoiceAvatar source={voice.avatar} size={56} /> : null}
        <View style={{ gap: 4, flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            {record.voice.name}
          </AppText>
          <AppText variant="callout" color="textTertiary">
            {formatFullTime(record.createdAt)}
            {record.language && LANGUAGE_LABEL[record.language] ? ` · ${LANGUAGE_LABEL[record.language]}` : ''}
          </AppText>
        </View>
      </View>

      <View style={[styles.box, { backgroundColor: colors.surface }]}>
        <AudioPlayer
          playbackKey={`history-src-${record.id}`}
          source={{ uri: item.sourceUri }}
          label="原音"
          name={`原音 ${record.sourceName}`}
          knownDurationMs={record.sourceDurationMs}
          unavailable={!item.sourceAvailable}
          testID="history.detail.play.source"
        />
        <AudioPlayer
          playbackKey={`history-dub-${record.id}`}
          source={{ uri: item.dubUri }}
          label="新配音"
          name="新配音"
          knownDurationMs={record.dubDurationMs}
          unavailable={!item.dubAvailable}
          testID="history.detail.play.dub"
        />
        <AppText variant="caption" color="textTertiary">
          原音：{record.sourceName}
        </AppText>
      </View>

      <View style={[styles.box, { backgroundColor: colors.surface }]}>
        <View style={{ gap: 6 }}>
          <AppText variant="callout" color="textTertiary" style={{ fontWeight: '600' }}>
            原始转写
          </AppText>
          <AppText variant="body" color="textSecondary" testID="history.detail.transcript">
            {record.transcript || '（未识别到语音，文字为手动输入）'}
          </AppText>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={{ gap: 6 }}>
          <View style={styles.labelRow}>
            <AppText variant="callout" color="textTertiary" style={{ fontWeight: '600' }}>
              配音文字
            </AppText>
            {edited ? <Tag label="已编辑" tone="accent" /> : null}
          </View>
          <AppText variant="body" testID="history.detail.final">
            {record.finalText}
          </AppText>
        </View>
      </View>

      {error ? <InlineAlert kind="error" message={error.message} /> : null}
      {remove.error ? <InlineAlert kind="error" message={remove.error.message} /> : null}
      <View style={styles.actions}>
        <Button label="分享" variant="secondary" onPress={share} disabled={busy || !item.dubAvailable} style={styles.action} testID="history.detail.share" />
        <Button label="导出" variant="secondary" onPress={exportFile} disabled={busy || !item.dubAvailable} style={styles.action} testID="history.detail.export" />
        <Button label="删除" variant="danger" onPress={remove.confirm} style={styles.action} testID="history.detail.delete" />
      </View>
    </>
  );
}

function BrokenRecord({ id }: { id: string }) {
  const remove = useDelete(id);
  return (
    <View style={{ gap: 12 }}>
      <InlineAlert kind="warning" message="这条记录的信息已损坏，无法显示详情。音频文件仍保留在本机。" />
      {remove.error ? <InlineAlert kind="error" message={remove.error.message} /> : null}
      <Button label="删除这条记录" variant="danger" onPress={remove.confirm} />
    </View>
  );
}

/** 删除前二次确认，同时删除记录和本地文件（PRD H3） */
function useDelete(id: string) {
  const removeRecord = useHistory((s) => s.remove);
  const [error, setError] = useState<AppError | null>(null);
  const confirm = () =>
    Alert.alert('删除这条记录？', '原音和配音文件会一起删除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          audioCoordinator.stopAll();
          try {
            await removeRecord(id);
            router.back();
          } catch (e) {
            setError(toAppError(e, 'save_failed'));
          }
        },
      },
    ]);
  return { confirm, error };
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: 16, paddingBottom: 48 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  box: { borderRadius: radius.card, padding: spacing.lg, gap: 14 },
  divider: { height: StyleSheet.hairlineWidth },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, paddingHorizontal: 8 },
});
