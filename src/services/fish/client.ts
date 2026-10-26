import { env } from '@/config/env';
import { appError, isAppError, type AppError, type ErrorCode } from '@/services/errors';

/** fetch 返回值中我们用到的部分，便于测试和故障注入时伪造 */
export type ResponseLike = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<any>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type FetchLike = (
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: any; signal: AbortSignal },
) => Promise<ResponseLike>;

let fetchImpl: FetchLike = (url, init) => fetch(url, init) as unknown as Promise<ResponseLike>;

/** 替换底层 fetch（测试与开发构建的故障注入使用） */
export function setFetchImpl(impl: FetchLike) {
  fetchImpl = impl;
}

export function getFetchImpl(): FetchLike {
  return fetchImpl;
}

type RequestOptions<T> = {
  method: 'GET' | 'POST';
  path: string;
  headers?: Record<string, string>;
  body?: any;
  /** 超时覆盖到响应体读取完毕（PLAN §3.2） */
  timeoutMs: number;
  /** 用户取消 */
  signal?: AbortSignal;
  /** 读取并解析响应体 */
  read: (res: ResponseLike) => Promise<T>;
  /** 响应头已到、读取响应体时出错归为哪类错误 */
  bodyErrorCode: ErrorCode;
};

export async function fishRequest<T>(opts: RequestOptions<T>): Promise<T> {
  if (!env.isConfigured) throw appError('not_configured');
  if (opts.signal?.aborted) throw appError('cancelled');

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs);

  const classify = (e: unknown, stage: 'connect' | 'body'): AppError => {
    if (timedOut) return appError('timeout');
    if (opts.signal?.aborted) return appError('cancelled');
    if (isAppError(e)) return e;
    if (stage === 'body') return appError(opts.bodyErrorCode, { detail: String(e) });
    // RN 网络失败抛 TypeError("Network request failed")
    return appError(e instanceof TypeError ? 'offline' : 'unknown', { detail: String(e) });
  };

  // 任何一步等待都与中止信号赛跑：即使底层实现不响应 abort（例如响应体卡住），
  // 超时和取消也一定能结束请求
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  aborted.catch(() => undefined);
  const guard = <R>(p: Promise<R>) => Promise.race([p, aborted]);

  try {
    let res: ResponseLike;
    try {
      res = await guard(
        fetchImpl(`${env.apiBase}${opts.path}`, {
          method: opts.method,
          headers: { Authorization: `Bearer ${env.apiKey}`, ...opts.headers },
          body: opts.body,
          signal: controller.signal,
        }),
      );
    } catch (e) {
      throw classify(e, 'connect');
    }
    if (!res.ok) throw await guard(httpError(res));
    try {
      return await guard(opts.read(res));
    } catch (e) {
      throw classify(e, 'body');
    }
  } catch (e) {
    throw classify(e, 'connect');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/** HTTP 状态码 → 错误类别（PRD §7.1，含实测：401 Invalid Token、400 invalid_audio） */
export async function httpError(res: ResponseLike): Promise<AppError> {
  let body: { message?: string; code?: string } = {};
  try {
    body = JSON.parse(await res.text());
  } catch {
    // 非 JSON 错误体，忽略
  }
  const detail = `HTTP ${res.status} ${body.code ?? ''} ${body.message ?? ''}`.trim();
  const s = res.status;
  if (s === 401 || s === 403) return appError('auth', { detail });
  if (s === 402) return appError('quota', { detail });
  if (s === 429) {
    const ra = Number(res.headers.get('retry-after'));
    return appError('rate_limit', { detail, retryAfterSec: Number.isFinite(ra) && ra > 0 ? Math.ceil(ra) : undefined });
  }
  if (s === 400 || s === 413 || s === 415 || s === 422) {
    const audioIssue = body.code === 'invalid_audio' || /audio/i.test(body.message ?? '');
    return appError(audioIssue ? 'bad_audio' : 'bad_request', { detail });
  }
  if (s >= 500) return appError('server', { detail });
  return appError('unknown', { detail });
}
