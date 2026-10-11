import { createAdminClient } from '../../../utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await createAdminClient().from('opportunities').select('id, title, url, source_excerpt, why_it_fits, status, found_at').eq('status', 'approved').order('found_at', { ascending: false });
    if (error) throw error;
    return Response.json({ opportunities: data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load opportunities.' }, { status: 500 });
  }
}
