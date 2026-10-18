export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RequestRateLimitBindings {
  API_RATE_LIMITER: RateLimitBinding;
  AUTH_RATE_LIMITER: RateLimitBinding;
}

function tooManyRequests(scope: string): Response {
  console.warn(JSON.stringify({ event: 'security.rate_limit', scope }));
  return Response.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '60',
      },
    },
  );
}

export async function enforceRequestRateLimits(
  request: Request,
  bindings: RequestRateLimitBindings,
): Promise<Response | null> {
  const clientIp = request.headers.get('cf-connecting-ip') ?? 'local';
  const apiResult = await bindings.API_RATE_LIMITER.limit({ key: `api:${clientIp}` });
  if (!apiResult.success) {
    return tooManyRequests('api');
  }

  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith('/api/auth/')) {
    const authResult = await bindings.AUTH_RATE_LIMITER.limit({ key: `auth:${clientIp}` });
    if (!authResult.success) {
      return tooManyRequests('auth');
    }
  }

  return null;
}
