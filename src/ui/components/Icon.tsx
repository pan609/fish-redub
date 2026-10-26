import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

// DESIGN §6.2 图标映射表：所有图标都从这里取，界面中不使用 emoji 或文字符号
const ICONS = {
  waveform: { ios: 'waveform', android: 'graphic_eq' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  mic: { ios: 'mic.fill', android: 'mic' },
  stop: { ios: 'stop.fill', android: 'stop' },
  micOff: { ios: 'mic.slash.fill', android: 'mic_off' },
  folder: { ios: 'folder.fill', android: 'folder_open' },
  file: { ios: 'doc.fill', android: 'audio_file' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause' },
  close: { ios: 'xmark', android: 'close' },
  check: { ios: 'checkmark', android: 'check' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  export: { ios: 'square.and.arrow.down', android: 'download' },
  trash: { ios: 'trash', android: 'delete' },
  success: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  error: { ios: 'exclamationmark.circle.fill', android: 'error' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  offline: { ios: 'wifi.slash', android: 'wifi_off' },
  edit: { ios: 'pencil', android: 'edit' },
  regenerate: { ios: 'arrow.clockwise', android: 'refresh' },
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: 17 | 20 | 24 | number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 20, color, style }: Props) {
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color}
      weight="semibold"
      style={[{ width: size, height: size }, style]}
    />
  );
}
