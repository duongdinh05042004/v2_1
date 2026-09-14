export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  isRetryable?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function isRetryableError(error: unknown): boolean {
  const status = extractStatus(error);
  if (status === 429 || status === 408) {
    return true;
  }
  if (status !== undefined && status >= 500) {
    return true;
  }
  const message = extractMessage(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('rate limit') ||
    message.includes('query exceeded') ||
    message.includes('too many requests')
  );
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const isRetryable = options.isRetryable ?? isRetryableError;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < options.maxAttempts && isRetryable(error);
      if (!canRetry) {
        throw error;
      }
      const delay = computeBackoff(options.baseDelayMs, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

export function computeBackoff(baseDelayMs: number, attempt: number): number {
  const exp = baseDelayMs * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * Math.min(250, baseDelayMs));
  return exp + jitter;
}

export function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const maybe = error as {
    response?: { status?: number };
    status?: number;
    code?: number;
  };
  return maybe.response?.status ?? maybe.status ?? maybe.code;
}

export function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
