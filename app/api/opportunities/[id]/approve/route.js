import { hasSitePassword } from '../../../../../utils/site-password';
import { createAdminClient } from '../../../../../utils/supabase/admin';

function validId(id) { return /^\d+$/.test(id); }

export async function POST(request, { params }) {
  let password;
  try { ({ password } = await request.json()); } catch { return Response.json({ error: 'A site password is required.' }, { status: 401 }); }
  if (!hasSitePassword(password)) return Response.json({ error: 'Incorrect site password.' }, { status: 401 });
  const { id } = await params;
  if (!validId(id)) return Response.json({ error: 'Invalid opportunity id.' }, { status: 400 });
  try {
    const { data, error } = await createAdminClient().from('opportunities').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', id).eq('status', 'new').select('id, title, url, source_excerpt, why_it_fits, status, found_at').maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: 'This opportunity is no longer pending.' }, { status: 409 });
    return Response.json({ opportunity: data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to approve opportunity.' }, { status: 500 });
  }
}
