import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/ui/theme';

// iOS 26：系统液态玻璃 Tab Bar，向下滚动时最小化；Android：Material 3 底部导航（DESIGN §7.2）
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.accent}>
      <NativeTabs.Trigger name="(redub)">
        <NativeTabs.Trigger.Label>配音</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="waveform" md="graphic_eq" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>历史</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
