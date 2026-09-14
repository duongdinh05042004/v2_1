import {
  computeBackoff,
  extractMessage,
  extractStatus,
  isRetryableError,
  withRetry,
} from '../src/core/retry.util';

describe('retry utils', () => {
  it('nhận diện lỗi retryable', () => {
    expect(isRetryableError({ response: { status: 429 } })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError(new Error('socket timeout'))).toBe(true);
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError('too many requests')).toBe(true);
  });

  it('retry rồi thành công', async () => {
    let n = 0;
    const value = await withRetry(
      async () => {
        n += 1;
        if (n < 3) {
          throw { status: 429, message: 'rate limit' };
        }
        return 'ok';
      },
      { maxAttempts: 4, baseDelayMs: 1, sleep: async () => undefined },
    );
    expect(value).toBe('ok');
    expect(n).toBe(3);
  });

  it('hết lần thử thì ném lỗi', async () => {
    await expect(
      withRetry(
        async () => {
          throw { status: 500, message: 'boom' };
        },
        { maxAttempts: 2, baseDelayMs: 1, sleep: async () => undefined },
      ),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('không retry lỗi 400', async () => {
    let n = 0;
    await expect(
      withRetry(
        async () => {
          n += 1;
          throw { status: 400, message: 'bad' };
        },
        { maxAttempts: 3, baseDelayMs: 1, sleep: async () => undefined },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(n).toBe(1);
  });

  it('extract helpers', () => {
    expect(extractStatus({ response: { status: 429 } })).toBe(429);
    expect(extractMessage(new Error('x'))).toBe('x');
    expect(extractMessage('y')).toBe('y');
    expect(extractMessage(null)).toBe('Unknown error');
    expect(computeBackoff(100, 1)).toBeGreaterThanOrEqual(100);
  });
});
