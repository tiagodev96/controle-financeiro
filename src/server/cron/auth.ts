export type CronAuthResult =
  | { ok: true }
  | { ok: false; response: Response };

const UNAUTHORIZED = new Response(
  JSON.stringify({ ok: false, error: 'unauthorized' }),
  { status: 401, headers: { 'content-type': 'application/json' } },
);

function unauthorized(): Response {
  return UNAUTHORIZED.clone();
}

export function requireCronAuth(request: Request): CronAuthResult {
  const expected = process.env.CRON_SECRET;
  if (!expected) return { ok: false, response: unauthorized() };

  const header = request.headers.get('authorization');
  if (!header) return { ok: false, response: unauthorized() };

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || token !== expected) {
    return { ok: false, response: unauthorized() };
  }

  return { ok: true };
}
