import { setAudioModeAsync } from 'expo-audio';

// 全局单音源协调（PRD M10）：任意时刻最多一个音源在播放；录音优先。
type Entry = { pause: () => void };

const players = new Map<string, Entry>();
let activeKey: string | null = null;
const listeners = new Set<(key: string | null) => void>();

export const audioCoordinator = {
  register(key: string, entry: Entry) {
    players.set(key, entry);
    return () => {
      if (players.get(key) === entry) players.delete(key);
      if (activeKey === key) setActive(null);
    };
  },
  /** 开始播放 key 前调用：暂停其他所有音源 */
  activate(key: string) {
    players.forEach((p, k) => {
      if (k !== key) safePause(p);
    });
    setActive(key);
  },
  /** 录音前、页面离开、App 进入后台时调用 */
  stopAll() {
    players.forEach(safePause);
    setActive(null);
  },
  release(key: string) {
    if (activeKey === key) setActive(null);
  },
  subscribe(fn: (key: string | null) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function safePause(p: Entry) {
  try {
    p.pause();
  } catch {
    // 播放器可能已释放
  }
}

function setActive(key: string | null) {
  activeKey = key;
  listeners.forEach((fn) => fn(key));
}

/** 播放模式：静音开关下也能出声，不与其他 App 混音 */
export function enterPlaybackMode() {
  return setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    interruptionMode: 'doNotMix',
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
}

/** 录音模式；录音结束必须调用 enterPlaybackMode 恢复，否则 iOS 外放会变小（PRD A2） */
export function enterRecordingMode() {
  return setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: true,
    interruptionMode: 'doNotMix',
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
}
