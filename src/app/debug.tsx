import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useFaults } from '@/features/debug/faults';
import { NETWORK_FAULT_LABELS, type NetworkFault } from '@/services/fish/faults';
import { STORAGE_FAULT_LABELS, type StorageFault } from '@/services/storage/faults';
import { AppText } from '@/ui/components/AppText';
import { IconButton } from '@/ui/components/Button';
import { SheetLayout } from '@/ui/components/Sheet';
import { useTheme } from '@/ui/theme';

// 开发构建的故障注入面板（PLAN §3.9），入口：长按配音页右上角品牌标志
export default function DebugSheet() {
  const { network, storage, setNetwork, setStorage } = useFaults();
  if (!__DEV__) return null;
  return (
    <SheetLayout
      title="故障注入（开发）"
      scroll
      right={<IconButton icon="check" onPress={() => router.back()} accessibilityLabel="完成" testID="debug.done" />}>
      <AppText variant="caption" color="textTertiary">
        选中后对之后的请求或保存生效，测试完记得切回「无」。
      </AppText>
      <Group title="网络层（转写与配音请求）">
        {(Object.keys(NETWORK_FAULT_LABELS) as NetworkFault[]).map((k) => (
          <Option key={k} label={NETWORK_FAULT_LABELS[k]} selected={network === k} onPress={() => setNetwork(k)} testID={`debug.net.${k}`} />
        ))}
      </Group>
      <Group title="存储层（保存到历史）">
        {(Object.keys(STORAGE_FAULT_LABELS) as StorageFault[]).map((k) => (
          <Option key={k} label={STORAGE_FAULT_LABELS[k]} selected={storage === k} onPress={() => setStorage(k)} testID={`debug.fs.${k}`} />
        ))}
      </Group>
    </SheetLayout>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      <AppText variant="headline">{title}</AppText>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

function Option({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surfaceMuted }]}>
      <AppText variant="callout" style={{ color: selected ? colors.onPrimary : colors.textPrimary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
});
