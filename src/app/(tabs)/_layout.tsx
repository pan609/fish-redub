import { NativeTabs } from 'expo-router/native-tabs';
import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';

import { FloatingTabBar } from '@/ui/components/FloatingTabBar';
import { useTheme } from '@/ui/theme';

// iOS：系统液态玻璃 Tab Bar（NativeTabs），向下滚动时最小化（DESIGN §7.2）。
// Android：自绘浮动胶囊 Tab Bar，与 iOS 形态一致，避免 Material 贴边导航带来的体验差异。
export default function TabsLayout() {
  const { colors } = useTheme();

  if (Platform.OS !== 'ios') {
    return (
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
        <Tabs.Screen name="(redub)" options={{ title: '配音' }} />
        <Tabs.Screen name="history" options={{ title: '历史' }} />
      </Tabs>
    );
  }

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
