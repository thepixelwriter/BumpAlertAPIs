import { describe, expect, it, vi } from 'vitest';
import { enforceRequestRateLimits, type RateLimitBinding } from './request-rate-limit';

function limiter(success: boolean): RateLimitBinding {
  return { limit: vi.fn(async () => ({ success })) };
}

describe('enforceRequestRateLimits', () => {
  it('applies both general and authentication limits using the Cloudflare client IP', async () => {
    const api = limiter(true);
    const auth = limiter(true);
    const request = new Request('https://api.example.test/api/auth/login', {
      headers: { 'cf-connecting-ip': '203.0.113.7' },
    });

    const result = await enforceRequestRateLimits(request, {
      API_RATE_LIMITER: api,
      AUTH_RATE_LIMITER: auth,
    });

    expect(result).toBeNull();
    expect(api.limit).toHaveBeenCalledWith({ key: 'api:203.0.113.7' });
    expect(auth.limit).toHaveBeenCalledWith({ key: 'auth:203.0.113.7' });
  });

  it('returns a non-cacheable 429 when the general limit is exceeded', async () => {
    const api = limiter(false);
    const auth = limiter(true);

    const result = await enforceRequestRateLimits(
      new Request('https://api.example.test/api/reports'),
      { API_RATE_LIMITER: api, AUTH_RATE_LIMITER: auth },
    );

    expect(result?.status).toBe(429);
    expect(result?.headers.get('cache-control')).toBe('no-store');
    expect(result?.headers.get('retry-after')).toBe('60');
    expect(auth.limit).not.toHaveBeenCalled();
  });

  it('returns a 429 when the stricter authentication limit is exceeded', async () => {
    const api = limiter(true);
    const auth = limiter(false);

    const result = await enforceRequestRateLimits(
      new Request('https://api.example.test/api/auth/register'),
      { API_RATE_LIMITER: api, AUTH_RATE_LIMITER: auth },
    );

    expect(result?.status).toBe(429);
  });

  it('does not hide rate-limit service failures', async () => {
    const api: RateLimitBinding = {
      limit: vi.fn(async () => {
        throw new Error('rate limiter unavailable');
      }),
    };

    await expect(enforceRequestRateLimits(
      new Request('https://api.example.test/api/health'),
      { API_RATE_LIMITER: api, AUTH_RATE_LIMITER: limiter(true) },
    )).rejects.toThrow('rate limiter unavailable');
  });
});
