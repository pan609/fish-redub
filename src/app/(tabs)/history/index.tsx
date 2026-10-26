import { Stack } from 'expo-router';
import { ScrollView, Text } from 'react-native';

export default function HistoryScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: '历史' }} />
      <Text style={{ padding: 20 }}>历史（验证用）</Text>
    </ScrollView>
  );
}
