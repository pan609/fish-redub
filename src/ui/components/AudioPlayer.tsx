import { useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { audioCoordinator } from '@/services/audio/coordinator';
import { formatDuration } from '@/utils/format';

import { useTheme } from '../theme';
import { hitSlop } from '../tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** 播放控制：注册到全局协调器，保证同一时刻只有一个音源在播放（PRD A1、P2） */
export function usePlayback(key: string, source: AudioSource | null) {
  const player = useAudioPlayer(source, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => audioCoordinator.register(key, { pause: () => player.pause() }), [key, player]);

  // 播放结束回到开头，下一次点击从头播放
  useEffect(() => {
    if (!status.didJustFinish) return;
    player.pause();
    void player.seekTo(0);
    audioCoordinator.release(key);
  }, [status.didJustFinish, player, key]);

  const durationSec = status.duration > 0 ? status.duration : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      audioCoordinator.release(key);
      return;
    }
    audioCoordinator.activate(key);
    if (durationSec > 0 && status.currentTime >= durationSec - 0.05) void player.seekTo(0);
    player.play();
  };

  const seekToFraction = (fraction: number) => {
    if (durationSec <= 0) return;
    void player.seekTo(Math.min(Math.max(fraction, 0), 1) * durationSec);
  };

  const pause = () => player.pause();

  return {
    playing: status.playing,
    loaded: status.isLoaded,
    currentMs: Math.round(status.currentTime * 1000),
    durationMs: Math.round(durationSec * 1000),
    toggle,
    pause,
    seekToFraction,
  };
}

/* ---------- 波形 ---------- */

/** 由字符串种子生成稳定的伪随机柱高（没有真实采样数据时使用） */
function seededHeights(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const r = ((h ^= h >>> 16) >>> 0) / 4294967295;
    out.push(0.25 + 0.75 * r);
  }
  return out;
}

const BAR = 3;
const GAP = 2;

type WaveformProps = {
  seed: string;
  progress: number;
  height?: number;
  onSeek?: (fraction: number) => void;
  disabled?: boolean;
};

export function Waveform({ seed, progress, height = 28, onSeek, disabled }: WaveformProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const count = Math.max(0, Math.floor((width + GAP) / (BAR + GAP)));
  const heights = useMemo(() => seededHeights(seed, count), [seed, count]);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Pressable
      style={[styles.wave, { height }]}
      onLayout={onLayout}
      disabled={disabled || !onSeek}
      onPress={(e) => width > 0 && onSeek?.(e.nativeEvent.locationX / width)}
      accessible={false}>
      {heights.map((v, i) => (
        <View
          key={i}
          style={{
            width: BAR,
            height: Math.max(4, v * height),
            borderRadius: 2,
            backgroundColor: (i + 0.5) / count <= progress ? colors.waveActive : colors.waveIdle,
          }}
        />
      ))}
    </Pressable>
  );
}

/* ---------- 播放器 ---------- */

type AudioPlayerProps = {
  playbackKey: string;
  source: AudioSource | null;
  /** 行首标签，例如"原音""新配音" */
  label?: string;
  /** 读屏名称，例如"原音""Sarah 样例" */
  name: string;
  /** 加载前用于展示的已知时长 */
  knownDurationMs?: number;
  /** 文件不可用时禁用 */
  unavailable?: boolean;
  testID?: string;
};

export function AudioPlayer({ playbackKey, source, label, name, knownDurationMs, unavailable, testID }: AudioPlayerProps) {
  const { colors } = useTheme();
  const pb = usePlayback(playbackKey, unavailable ? null : source);
  const total = pb.durationMs || knownDurationMs || 0;
  const progress = total > 0 ? pb.currentMs / total : 0;
  const disabled = unavailable || !source;
  const timeText = unavailable ? '文件不可用' : pb.playing || pb.currentMs > 0 ? `${formatDuration(pb.currentMs)} / ${formatDuration(total)}` : formatDuration(total);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${name}，${unavailable ? '文件不可用' : `已播放 ${Math.round(pb.currentMs / 1000)} 秒，共 ${Math.round(total / 1000)} 秒`}`}
      accessibilityActions={[{ name: 'activate' }, { name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate') pb.toggle();
        if (e.nativeEvent.actionName === 'increment') pb.seekToFraction(progress + 0.1);
        if (e.nativeEvent.actionName === 'decrement') pb.seekToFraction(progress - 0.1);
      }}>
      {label ? (
        <AppText variant="callout" color="textSecondary" style={styles.label} numberOfLines={1}>
          {label}
        </AppText>
      ) : null}
      <Pressable
        testID={testID}
        onPress={pb.toggle}
        disabled={disabled}
        hitSlop={hitSlop(40)}
        accessibilityRole="button"
        accessibilityLabel={`${pb.playing ? '暂停' : '播放'}${name}`}
        style={[styles.play, { backgroundColor: disabled ? colors.surfaceMuted : colors.primary }]}>
        {!disabled && !pb.loaded ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Icon name={pb.playing ? 'pause' : 'play'} size={17} color={disabled ? colors.textTertiary : colors.onPrimary} />
        )}
      </Pressable>
      <Waveform seed={playbackKey} progress={progress} onSeek={pb.seekToFraction} disabled={disabled} />
      <AppText variant="caption" color="textTertiary" style={styles.time} numberOfLines={1}>
        {timeText}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { width: 44 },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: GAP, overflow: 'hidden' },
  time: { fontVariant: ['tabular-nums'] },
});
