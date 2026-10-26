import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Platform, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

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
  restart: { ios: 'arrow.counterclockwise', android: 'restart_alt' },
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

// Material Symbols 的字形自带较大留白，同尺寸下明显小于 SF Symbols。
// Android 按图标做视觉尺寸补偿，让两端图标在同一容器中占比一致（PM 反馈：双端效果一致）。
const ANDROID_SCALE: Partial<Record<IconName, number>> = { play: 1.45, pause: 1.3, stop: 1.3, check: 1.2, close: 1.15 };
const ANDROID_DEFAULT_SCALE = 1.15;

type Props = {
  name: IconName;
  size?: 17 | 20 | 24 | number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 20, color, style }: Props) {
  const glyph = Platform.OS === 'android' ? Math.round(size * (ANDROID_SCALE[name] ?? ANDROID_DEFAULT_SCALE)) : size;
  return (
    <SymbolView
      name={ICONS[name]}
      size={glyph}
      tintColor={color}
      weight="semibold"
      style={[{ width: glyph, height: glyph }, style]}
    />
  );
}
