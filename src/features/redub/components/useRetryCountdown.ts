import { useEffect, useState } from 'react';

import type { AppError } from '@/services/errors';

/** 429 时按 Retry-After 倒计时，结束前不能重试（PRD §7.2）；转写与配音共用 */
export function useRetryCountdown(error: AppError | undefined) {
  const total = error?.code === 'rate_limit' ? (error.retryAfterSec ?? 0) : 0;
  const [tracked, setTracked] = useState({ error, left: total });
  // 新的错误到来时重置倒计时（渲染期间根据 props 重置 state 的标准写法）
  if (tracked.error !== error) setTracked({ error, left: total });
  useEffect(() => {
    if (!total) return;
    const timer = setInterval(() => setTracked((t) => ({ ...t, left: Math.max(0, t.left - 1) })), 1000);
    return () => clearInterval(timer);
  }, [error, total]);
  return tracked.error === error ? tracked.left : total;
}

export function withCountdown(message: string, left: number) {
  return left > 0 ? `${message}（${left} 秒后可重试）` : message;
}
