import { Stack } from 'expo-router';

import { stackHeaderOptions } from '@/ui/headerOptions';
import { useTheme } from '@/ui/theme';

export default function TabStackLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={stackHeaderOptions(colors)} />;
}
