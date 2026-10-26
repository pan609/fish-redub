import { createAudioPlayer } from 'expo-audio';

/**
 * 读取音频时长（毫秒）：用播放器加载，等待 isLoaded 且 duration > 0。
 * 超时或加载失败返回 null（PLAN §3.3：5 秒超时，用完释放）。
 */
export function probeDurationMs(uri: string, timeoutMs = 5000): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      if (poll) clearInterval(poll);
      clearTimeout(timer);
      sub?.remove();
      try {
        player?.remove();
      } catch {
        // 已释放
      }
      resolve(value);
    };

    const check = () => {
      if (player?.isLoaded && player.duration > 0 && Number.isFinite(player.duration)) {
        finish(Math.round(player.duration * 1000));
      }
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    let sub: { remove(): void } | undefined;
    try {
      player = createAudioPlayer({ uri }, { updateInterval: 100 });
      sub = player.addListener('playbackStatusUpdate', check);
      // 部分平台加载完成不一定触发状态回调，补充轮询
      poll = setInterval(check, 100);
      check();
    } catch {
      finish(null);
    }
  });
}
