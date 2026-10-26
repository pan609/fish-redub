import { GlassView } from 'expo-glass-effect';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

export default function VoicePickerSheet() {
  return (
    <View style={{ flex: 1, padding: 20, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '700' }}>选择声音</Text>
        <Pressable onPress={() => router.back()}>
          <GlassView isInteractive style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name={{ ios: 'checkmark', android: 'check' }} size={20} tintColor="#1D1D1D" />
          </GlassView>
        </Pressable>
      </View>
      <Text>formSheet 验证：不设背景色</Text>
    </View>
  );
}
