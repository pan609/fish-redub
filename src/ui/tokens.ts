// 设计令牌：与 docs/DESIGN.md §3 保持一致
export const palette = {
  light: {
    bg: '#FBF7F8',
    surface: '#FFFFFF',
    surfaceMuted: '#F5F1F0',
    border: '#EEE8E7',
    textPrimary: '#1D1D1D',
    textSecondary: '#615F60',
    textTertiary: '#716866',
    primary: '#1D1D1D',
    onPrimary: '#FFFFFF',
    accent: '#EF8328',
    accentText: '#A84F0C',
    accentSoft: '#FFF1E6',
    success: '#2E9E5B',
    successText: '#1F7A43',
    danger: '#B42727',
    dangerSoft: '#FDECEC',
    waveIdle: '#D9D2D0',
    waveActive: '#1D1D1D',
    scrim: 'rgba(29,29,29,0.32)',
    glowA: 'rgba(255,140,34,0.22)',
    glowB: 'rgba(242,112,138,0.16)',
  },
  dark: {
    bg: '#121011',
    surface: '#1D1A1B',
    surfaceMuted: '#2A2627',
    border: '#332E2F',
    textPrimary: '#F5F1F0',
    textSecondary: '#B5ADAB',
    textTertiary: '#9C9391',
    primary: '#F5F1F0',
    onPrimary: '#1D1D1D',
    accent: '#FF9640',
    accentText: '#FF9C4D',
    accentSoft: '#3A2616',
    success: '#4CC27A',
    successText: '#4CC27A',
    danger: '#FF6B6B',
    dangerSoft: '#3A1C1C',
    waveIdle: '#4A4344',
    waveActive: '#F5F1F0',
    scrim: 'rgba(0,0,0,0.56)',
    glowA: 'rgba(255,140,34,0.16)',
    glowB: 'rgba(242,112,138,0.12)',
  },
} as const;

export type ColorName = keyof (typeof palette)['light'];
export type Colors = Record<ColorName, string>;

/** 录音按钮渐变 */
export const accentGradient = ['#FF8C22', '#FFA94D'] as const;
/** 进行中步骤圆上的数字颜色（橙底黑字，6.4:1） */
export const onAccent = '#1D1D1D';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { chip: 999, button: 999, card: 20, sheet: 28, input: 16, alert: 12 } as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '800' },
  timer: { fontSize: 48, lineHeight: 56, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** 视觉尺寸小于 44 的控件用 hitSlop 补足点击区域 */
export const hitSlop = (visualSize: number) => {
  const pad = Math.max(0, Math.ceil((44 - visualSize) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
};
