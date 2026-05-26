import { requireCronAuth } from '@/server/cron/auth';
import { runFxCron } from '@/server/cron/handlers';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const auth = requireCronAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await runFxCron({ serviceSupabase: getServiceRoleSupabase() });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cron-error';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
