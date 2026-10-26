import type { ErrorCode } from '@/services/errors';

// 错误文案以 PRD §7.1 为准，界面内不重复造词
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  offline: '网络连接不可用，请检查网络后重试',
  timeout: '请求超时，请重试',
  auth: 'API Key 无效或已过期，请检查配置',
  quota: '账户额度不足，请充值后再试',
  rate_limit: '请求过于频繁，请稍后重试',
  bad_audio: '音频无法识别，请更换文件',
  bad_request: '请求参数有误，请调整后重试',
  server: '服务暂时不可用，请稍后重试',
  incomplete_audio: '配音音频接收不完整，请重试',
  save_failed: '保存到本地失败，请检查存储空间后重试',
  not_configured: '未配置 API Key，请在 .env.local 中设置 EXPO_PUBLIC_FISH_API_KEY',
  cancelled: '已取消',
  unknown: '出现未知问题，请重试',
};

// 导入校验文案（PRD I3）
export const IMPORT_MESSAGES = {
  format: '仅支持 MP3、WAV、M4A 格式',
  empty: '文件为空，请选择其他音频',
  tooLarge: (mb: string) => `文件超过 10MB 上限（当前 ${mb}MB）`,
  unreadable: '无法读取该音频文件，可能已损坏',
  duration: (sec: string) => `音频时长需在 1–60 秒之间（当前 ${sec} 秒）`,
} as const;

// 录音文案（PRD R4、R5、R8）
export const RECORD_MESSAGES = {
  tooShort: '录音过短，请至少录制 1 秒',
  saveFailed: '录音未能保存，请重新录制',
  startFailed: '无法启动录音，请检查麦克风是否被其他应用占用后重试',
  autoStopped: '已达到 60 秒上限，录音已自动结束',
  backgrounded: '录音已在切到后台时结束',
  backgroundedInvalid: '切到后台时录音不足 1 秒，未能保存，请重新录制',
  interrupted: '录音被系统中断，已自动结束',
  permissionTitle: '需要使用麦克风',
  permissionBody: '用于录制需要转写的语音。录音仅上传至 Fish Audio 用于转写。',
  deniedTitle: '麦克风权限已关闭',
  deniedBody: '录音需要使用麦克风。请在系统设置中允许 Redub 访问麦克风，返回后即可开始录音。',
} as const;

export const TEXT_LIMIT = 1000;
