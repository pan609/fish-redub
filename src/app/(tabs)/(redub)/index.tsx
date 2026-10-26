import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { File, Paths } from 'expo-file-system';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { transcribe } from '@/services/fish/asr';
import { synthesize } from '@/services/fish/tts';
import { probeDurationMs } from '@/services/audio/probe';

// 阶段三最小验证：NativeTabs、透明大标题、formSheet、GlassView、SymbolView
export default function RedubScreen() {
  const [log, setLog] = useState('');
  // M2 临时自检：TTS 二进制响应 → 写文件 → 读时长 → ASR multipart 上传
  const selfCheck = async () => {
    try {
      setLog('TTS 请求中…');
      const bytes = await synthesize({ text: '你好，这是接口自检。', voiceId: 'faccba1a8ac54016bcfc02761285e67f' });
      const f = new File(Paths.cache, 'selfcheck.mp3');
      if (f.exists) f.delete();
      f.create();
      await f.write(bytes);
      const ms = await probeDurationMs(f.uri);
      setLog(`TTS ${bytes.length}B，时长 ${ms}ms；ASR 请求中…`);
      const asr = await transcribe({ uri: f.uri });
      setLog(`OK：TTS ${bytes.length}B / ${ms}ms；ASR「${asr.text}」(${asr.language})`);
    } catch (e: any) {
      setLog('失败：' + (e?.code ?? '') + ' ' + (e?.detail ?? e?.message ?? String(e)));
    }
  };
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
        <Pressable testID="selfcheck" onPress={selfCheck} style={{ padding: 16, backgroundColor: '#EF8328', borderRadius: 999 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>接口自检</Text>
        </Pressable>
        <Text testID="selfcheck-log">{log}</Text>
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
