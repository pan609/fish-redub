import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { LANGUAGE_LABEL, VOICES, type Voice } from '@/config/voices';
import { useRedub } from '@/features/redub/store';
import { AppText } from '@/ui/components/AppText';
import { IconButton } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { Tag, VoiceAvatar } from '@/ui/components/Misc';
import { SheetLayout } from '@/ui/components/Sheet';
import { usePlayback } from '@/ui/components/AudioPlayer';
import { useTheme } from '@/ui/theme';
import { hitSlop } from '@/ui/tokens';

// 声音选择弹层（PRD V1–V3、DESIGN §5.5）：点击即选中并立即生效；
// 只有"完成"按钮，任何方式关闭都保持当前选择；关闭时试听随播放器释放而停止。
export default function VoicePickerSheet() {
  const voiceId = useRedub((s) => s.voiceId);
  const selectVoice = useRedub((s) => s.selectVoice);

  return (
    <SheetLayout
      title="选择声音"
      scroll
      right={<IconButton icon="check" onPress={() => router.back()} accessibilityLabel="完成" testID="voice.done" />}>
      <AppText variant="caption" color="textTertiary" style={{ marginBottom: 4 }}>
        点击即选中，关闭后保持当前选择。所有声音都支持中英文，标签表示样例语言。
      </AppText>
      {VOICES.map((v) => (
        <VoiceRow key={v.id} voice={v} selected={v.id === voiceId} onSelect={() => selectVoice(v.id)} />
      ))}
    </SheetLayout>
  );
}

function VoiceRow({ voice, selected, onSelect }: { voice: Voice; selected: boolean; onSelect: () => void }) {
  const { colors } = useTheme();
  const pb = usePlayback(`sample-${voice.id}`, voice.sample);
  const progress = pb.durationMs > 0 ? pb.currentMs / pb.durationMs : 0;

  return (
    <Pressable
      testID={`voice.item.${voice.id}`}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${voice.name}，${LANGUAGE_LABEL[voice.language]}，${voice.description}`}
      style={[
        styles.row,
        {
          backgroundColor: selected ? colors.accentSoft : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}>
      <VoiceAvatar source={voice.avatar} size={48} selected={selected} />
      <View style={styles.meta}>
        <View style={styles.line}>
          <AppText variant="headline">{voice.name}</AppText>
          <Tag label={LANGUAGE_LABEL[voice.language]} />
          {selected ? <Icon name="success" size={16} color={colors.accentText} /> : null}
        </View>
        {pb.playing ? (
          <>
            <AppText variant="caption" color="accentText">
              试听中
            </AppText>
            <View style={[styles.track, { backgroundColor: colors.waveIdle }]}>
              <View style={[styles.fill, { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: colors.accent }]} />
            </View>
          </>
        ) : (
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {voice.description}
          </AppText>
        )}
      </View>
      <Pressable
        testID={`voice.preview.${voice.id}`}
        onPress={pb.toggle}
        hitSlop={hitSlop(40)}
        accessibilityRole="button"
        accessibilityLabel={`${pb.playing ? '暂停' : '试听'} ${voice.name}`}
        style={[styles.play, { backgroundColor: colors.primary }]}>
        <Icon name={pb.playing ? 'pause' : 'play'} size={17} color={colors.onPrimary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  meta: { flex: 1, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
