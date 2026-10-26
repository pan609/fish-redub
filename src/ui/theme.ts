import { useColorScheme } from 'react-native';

import { palette, type Colors } from './tokens';

export type Theme = { scheme: 'light' | 'dark'; colors: Colors };

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palette[scheme] };
}
