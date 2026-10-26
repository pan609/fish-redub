import type { FetchLike, ResponseLike } from './client';

// 开发构建的网络层故障注入（PLAN §3.9）：包装真实 fetch，让故障走真实的校验路径
export type NetworkFault =
  | 'none'
  | 'offline'
  | 'timeout'
  | 'auth'
  | 'quota'
  | 'rate_limit'
  | 'server'
  | 'truncated'
  | 'not_audio'
  | 'empty_body';

export const NETWORK_FAULT_LABELS: Record<NetworkFault, string> = {
  none: '无',
  offline: '断网',
  timeout: '超时（无响应）',
  auth: '401 认证失败',
  quota: '402 额度不足',
  rate_limit: '429 限流',
  server: '500 服务错误',
  truncated: 'TTS 音频截断',
  not_audio: 'TTS 返回非音频',
  empty_body: 'TTS 返回空内容',
};

const STATUS: Partial<Record<NetworkFault, number>> = { auth: 401, quota: 402, rate_limit: 429, server: 500 };

/** 用字节构造一个最小 ResponseLike */
export function fakeResponse(
  body: Uint8Array | string,
  init: { status?: number; headers?: Record<string, string> } = {},
): ResponseLike {
  const status = init.status ?? 200;
  const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  // 字符串与字节分开保存，避免依赖运行时的 TextDecoder
  const asText = () => (typeof body === 'string' ? body : String.fromCharCode(...Array.from(body)));
  const asBytes = () => (typeof body === 'string' ? new TextEncoder().encode(body) : body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n) => headers[n.toLowerCase()] ?? null },
    text: async () => asText(),
    json: async () => JSON.parse(asText()),
    arrayBuffer: async () => asBytes().slice().buffer as ArrayBuffer,
  };
}

export function createFaultyFetch(real: FetchLike, getFault: () => NetworkFault): FetchLike {
  return async (url, init) => {
    const fault = getFault();
    const isTts = url.endsWith('/v1/tts');
    switch (fault) {
      case 'offline':
        throw new TypeError('Network request failed');
      case 'timeout':
        return new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
        });
      case 'auth':
      case 'quota':
      case 'rate_limit':
      case 'server':
        return fakeResponse(JSON.stringify({ status: STATUS[fault], message: `injected ${fault}` }), {
          status: STATUS[fault],
          headers: fault === 'rate_limit' ? { 'Retry-After': '8' } : {},
        });
      case 'truncated':
      case 'not_audio':
      case 'empty_body': {
        if (!isTts) return real(url, init);
        if (fault === 'not_audio') return fakeResponse('<html>gateway</html>', { headers: { 'Content-Type': 'text/html' } });
        if (fault === 'empty_body') return fakeResponse(new Uint8Array(0), { headers: { 'Content-Type': 'audio/mpeg' } });
        const res = await real(url, init);
        const full = new Uint8Array(await res.arrayBuffer());
        return fakeResponse(full.slice(0, Math.floor(full.length / 2)), {
          headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(full.length) },
        });
      }
      default:
        return real(url, init);
    }
  };
}
