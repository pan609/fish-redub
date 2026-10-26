import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';

import { findVoice } from '@/config/voices';
import { useHistory } from '@/features/history/store';
import { audioCoordinator } from '@/services/audio/coordinator';
import type { LoadedRecord } from '@/services/storage/historyRepo';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { InlineAlert } from '@/ui/components/InlineAlert';
import { AmbientGlow, Tag, VoiceAvatar } from '@/ui/components/Misc';
import { useTheme } from '@/ui/theme';
import { radius, spacing } from '@/ui/tokens';
import { formatDuration, formatListTime } from '@/utils/format';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const records = useHistory((s) => s.records);
  const loadError = useHistory((s) => s.loadError);
  useFocusEffect(useCallback(() => () => audioCoordinator.stopAll(), []));

  return (
    <>
      <Stack.Screen
        options={{
          title: '历史',
          headerRight: () =>
            records.length ? (
              <AppText
                variant="callout"
                color="textTertiary"
                style={
                  Platform.OS === 'android'
                    ? { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.surfaceMuted }
                    : { paddingHorizontal: 6 }
                }>
                {records.length} 条记录
              </AppText>
            ) : null,
        }}
      />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        data={records}
        keyExtractor={(r) => (r.kind === 'ok' ? r.record.id : r.id)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.list, !records.length && { flexGrow: 1 }]}
        ListHeaderComponent={
          <>
            <AmbientGlow />
            {loadError ? <InlineAlert kind="error" message="读取历史记录时出现问题，已保留现有文件" /> : null}
          </>
        }
        ListEmptyComponent={<Empty />}
        renderItem={({ item, index }) => <HistoryCard item={item} index={index} />}
        testID="history.list"
      />
    </>
  );
}

function HistoryCard({ item, index }: { item: LoadedRecord; index: number }) {
  const { colors, scheme } = useTheme();
  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surface },
    scheme === 'light' ? styles.shadow : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  ];

  if (item.kind === 'broken') {
    return (
      <Pressable testID={`history.item.${index}`} onPress={() => router.push(`/history/${item.id}`)} style={cardStyle}>
        <InlineAlert kind="warning" message="这条记录的信息已损坏，音频文件已保留" />
      </Pressable>
    );
  }

  const { record } = item;
  const voice = findVoice(record.voice.id);
  const edited = record.finalText !== record.transcript;
  return (
    <Pressable
      testID={`history.item.${index}`}
      onPress={() => router.push(`/history/${record.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${record.voice.name}，${formatListTime(record.createdAt)}，${record.finalText}`}
      style={({ pressed }) => [...cardStyle, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.top}>
        {voice ? <VoiceAvatar source={voice.avatar} size={28} /> : null}
        <AppText variant="headline">{record.voice.name}</AppText>
        {edited ? <Tag label="已编辑" tone="accent" /> : null}
        <View style={{ flex: 1 }} />
        <AppText variant="caption" color="textTertiary">
          {formatListTime(record.createdAt)}
        </AppText>
      </View>
      <AppText variant="body" numberOfLines={2}>
        {record.finalText}
      </AppText>
      <View style={styles.footer}>
        <Icon name={record.sourceType === 'record' ? 'mic' : 'file'} size={13} color={colors.textTertiary} />
        <AppText variant="caption" color="textTertiary" numberOfLines={1} style={{ flex: 1 }}>
          原音：{record.sourceName} · {formatDuration(record.sourceDurationMs)}
        </AppText>
        {!item.dubAvailable || !item.sourceAvailable ? (
          <AppText variant="caption" color="danger">
            文件不可用
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

function Empty() {
  const { colors } = useTheme();
  return (
    <View style={styles.empty} testID="history.empty">
      <View style={styles.art}>
        {[14, 26, 44, 30, 58, 36, 20, 40, 24, 12].map((h, i) => (
          <View key={i} style={{ width: 6, height: h, borderRadius: 3, backgroundColor: colors.accent, opacity: i % 3 === 1 ? 1 : 0.4 }} />
        ))}
      </View>
      <AppText variant="title">还没有配音记录</AppText>
      <AppText variant="callout" color="textTertiary">
        生成的配音会自动保存在这里
      </AppText>
      <Button label="去创建第一条配音" onPress={() => router.navigate('/(tabs)/(redub)')} testID="history.create" />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.xl, gap: 12, paddingBottom: 120 },
  card: { borderRadius: radius.card, padding: spacing.lg, gap: 10 },
  shadow: { shadowColor: '#1D1D1D', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 80 },
  art: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 64 },
});
