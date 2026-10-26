import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, Text, View } from 'react-native';

// 阶段三最小验证：NativeTabs、透明大标题、formSheet、GlassView、SymbolView
export default function RedubScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: '#FBF7F8' }}>
      <Stack.Screen options={{ title: '配音' }} />
      <View style={{ padding: 20, gap: 16 }}>
        <Text>Liquid Glass 可用：{String(isLiquidGlassAvailable())}</Text>
        <View style={{ flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#FF8C22', borderRadius: 20 }}>
          <GlassView isInteractive style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name={{ ios: 'mic.fill', android: 'mic' }} size={24} tintColor="#1D1D1D" />
          </GlassView>
          <GlassView isInteractive tintColor="#1D1D1D" style={{ flex: 1, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>玻璃主按钮</Text>
          </GlassView>
        </View>
        <Pressable testID="open-sheet" onPress={() => router.push('/voice-picker')} style={{ padding: 16, backgroundColor: '#1D1D1D', borderRadius: 999 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>打开 formSheet</Text>
        </Pressable>
        {Array.from({ length: 30 }).map((_, i) => (
          <View key={i} style={{ height: 60, borderRadius: 16, backgroundColor: i % 2 ? '#FFFFFF' : '#FFE3CC' }} />
        ))}
      </View>
    </ScrollView>
  );
}
