import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { findVoice, LANGUAGE_LABEL } from '@/config/voices';
import { isDubLocked } from '@/features/redub/machine';
import { useRedub } from '@/features/redub/store';
import { AppText } from '@/ui/components/AppText';
import { TextButton } from '@/ui/components/Button';
import { Tag, VoiceAvatar } from '@/ui/components/Misc';
import { StepCard } from '@/ui/components/StepCard';

export function StepVoice() {
  const confirmed = useRedub((s) => s.text.kind === 'confirmed');
  const voice = findVoice(useRedub((s) => s.voiceId));
  const locked = useRedub(isDubLocked);

  if (!confirmed || !voice) {
    return <StepCard index={3} title="声音" state="locked" status="确认文字后选择" testID="step.voice" />;
  }

  return (
    <StepCard
      index={3}
      title="声音"
      state="done"
      status={voice.name}
      action={<TextButton label="更换" onPress={() => router.push('/voice-picker')} disabled={locked} testID="step.voice.change" />}
      testID="step.voice">
      <View style={styles.row}>
        <VoiceAvatar source={voice.avatar} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.line}>
            <AppText variant="headline" testID="step.voice.name">
              {voice.name}
            </AppText>
            <Tag label={LANGUAGE_LABEL[voice.language]} />
          </View>
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {voice.description}
          </AppText>
        </View>
      </View>
    </StepCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
