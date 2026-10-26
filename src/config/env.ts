// 运行配置：通过 .env.local 注入（见 .env.example）。
// 注意：EXPO_PUBLIC_* 会被打包进客户端，正式产品应改为服务端代理（README 已说明）。
const apiKey = process.env.EXPO_PUBLIC_FISH_API_KEY?.trim() ?? '';
const apiBase = (process.env.EXPO_PUBLIC_FISH_API_BASE?.trim() || 'https://api.fish.audio').replace(/\/+$/, '');

export const env = {
  apiKey,
  apiBase,
  /** 缺少 Key 时页面直接提示，而不是等到请求时才失败 */
  isConfigured: apiKey.length > 0,
} as const;
