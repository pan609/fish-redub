export type Voice = {
  /** Fish Audio 模型 ID，即 TTS 的 reference_id */
  id: string;
  name: string;
  /** 样例语言；模型本身支持中英文 */
  language: 'zh' | 'en';
  description: string;
  avatar: number;
  sample: number;
};

// 预置声音（PRD M5，均已通过接口验证）。头像与样例随包打入，不依赖网络。
export const VOICES: Voice[] = [
  {
    id: 'faccba1a8ac54016bcfc02761285e67f',
    name: '温柔女声',
    language: 'zh',
    description: '温柔、抑扬顿挫的女声',
    avatar: require('../../assets/voices/voice1-avatar.webp'),
    sample: require('../../assets/voices/voice1-sample.mp3'),
  },
  {
    id: 'b4bdf5dc66004241a21ff2df165bf442',
    name: '解说男声',
    language: 'zh',
    description: '清晰有表现力，适合解说',
    avatar: require('../../assets/voices/voice2-avatar.webp'),
    sample: require('../../assets/voices/voice2-sample.mp3'),
  },
  {
    id: '933563129e564b19a115bedd57b7406a',
    name: 'Sarah',
    language: 'en',
    description: '投入、自然的女声',
    avatar: require('../../assets/voices/voice3-avatar.webp'),
    sample: require('../../assets/voices/voice3-sample.mp3'),
  },
  {
    id: 'bf322df2096a46f18c579d0baa36f41d',
    name: 'Adrian',
    language: 'en',
    description: '沉稳的旁白男声',
    avatar: require('../../assets/voices/voice4-avatar.webp'),
    sample: require('../../assets/voices/voice4-sample.mp3'),
  },
];

export const LANGUAGE_LABEL: Record<string, string> = { zh: '中文', en: '英文' };

export function findVoice(id: string | undefined): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}

/** 默认选中与转写语言匹配的第一个声音（PRD V4） */
export function defaultVoiceFor(language: string | undefined): Voice {
  return VOICES.find((v) => v.language === language) ?? VOICES[0];
}
