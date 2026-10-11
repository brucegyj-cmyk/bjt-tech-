import { hasRequestSitePassword } from '../../../../utils/site-password';
import { createAdminClient } from '../../../../utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!hasRequestSitePassword(request)) return Response.json({ error: 'Incorrect site password.' }, { status: 401 });
  try {
    const { data, error } = await createAdminClient().from('opportunities').select('id, title, url, source_excerpt, why_it_fits, status, found_at').eq('status', 'new').order('found_at', { ascending: false });
    if (error) throw error;
    return Response.json({ opportunities: data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load pending opportunities.' }, { status: 500 });
  }
}
