import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState, LogBox, Platform } from 'react-native';

import { useHistory } from '@/features/history/store';
import { audioCoordinator, enterPlaybackMode } from '@/services/audio/coordinator';
import { resetWorkDirs } from '@/services/storage/paths';
import { ToastHost } from '@/ui/components/Toast';
import { useTheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// 开发模式下屏蔽已确认无害的第三方警告提示条（避免遮挡界面与演示录屏），控制台仍会输出
LogBox.ignoreLogs(['[RNScreens] FormSheet with ScrollView', '[Layout children]', 'Open debugger to view warnings']);

export default function RootLayout() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);

  // 启动：清空工作目录 → 播放模式 → 加载历史（含恢复与残留清理）。
  // 完成前不渲染主界面，保证清理发生在任何保存之前（PLAN §3.5）。
  useEffect(() => {
    (async () => {
      try {
        resetWorkDirs();
      } catch {
        // 工作目录异常不阻塞启动
      }
      await enterPlaybackMode().catch(() => undefined);
      await useHistory.getState().load();
      setReady(true);
      SplashScreen.hideAsync().catch(() => undefined);
    })();
  }, []);

  // PRD A3：App 进入后台时暂停所有播放
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') audioCoordinator.stopAll();
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  // iOS 26 不设背景色，由系统绘制液态玻璃弹层；Android 补圆角与实色背景（PLAN §5）
  const sheet = (detents: number[]) => ({
    presentation: 'formSheet' as const,
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    // 弹层内的 ScrollView 不参与系统的"滚动到顶自动展开"，避免 iOS 调整其位置导致与标题重叠
    sheetExpandsWhenScrolledToEdge: false,
    sheetCornerRadius: Platform.OS === 'android' ? 28 : undefined,
    contentStyle: Platform.OS === 'android' ? { backgroundColor: colors.surface } : undefined,
  });

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recorder" options={sheet([0.75])} />
        <Stack.Screen name="voice-picker" options={sheet([0.7, 1])} />
        <Stack.Screen name="debug" options={sheet([0.7, 1])} />
      </Stack>
      <ToastHost />
    </>
  );
}
