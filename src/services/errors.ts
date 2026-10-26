import { ERROR_MESSAGES } from '@/copy/strings';

// 统一错误模型（PLAN §3.2）。界面只依赖 code，文案来自 copy/strings.ts。
export type ErrorCode =
  | 'offline'
  | 'timeout'
  | 'auth'
  | 'quota'
  | 'rate_limit'
  | 'bad_audio'
  | 'bad_request'
  | 'server'
  | 'incomplete_audio'
  | 'save_failed'
  | 'not_configured'
  | 'cancelled'
  | 'unknown';

export type AppError = {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  /** 429 时服务端建议的等待秒数 */
  retryAfterSec?: number;
  /** 调试信息，不展示给用户 */
  detail?: string;
};

const RETRYABLE: Record<ErrorCode, boolean> = {
  offline: true,
  timeout: true,
  auth: false,
  quota: false,
  rate_limit: true,
  bad_audio: false,
  bad_request: false,
  server: true,
  incomplete_audio: true,
  save_failed: true,
  not_configured: false,
  cancelled: false,
  unknown: true,
};

export function appError(code: ErrorCode, extra: Partial<Omit<AppError, 'code'>> = {}): AppError {
  return { code, message: ERROR_MESSAGES[code], retryable: RETRYABLE[code], ...extra };
}

export function isAppError(e: unknown): e is AppError {
  return typeof e === 'object' && e !== null && 'code' in e && 'retryable' in e;
}

export function toAppError(e: unknown, fallback: ErrorCode = 'unknown'): AppError {
  if (isAppError(e)) return e;
  return appError(fallback, { detail: e instanceof Error ? e.message : String(e) });
}
