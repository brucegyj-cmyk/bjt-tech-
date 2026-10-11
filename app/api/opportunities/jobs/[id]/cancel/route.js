import { hasSitePassword } from '../../../../../../utils/site-password';

function validId(id) {
  return /^[0-9a-f-]{36}$/i.test(id);
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { password } = await request.json();
    if (!validId(id)) return Response.json({ error: 'Invalid job id.' }, { status: 400 });
    if (!hasSitePassword(password)) return Response.json({ error: 'Incorrect site password.' }, { status: 401 });
    const base = process.env.AGENT_URL;
    const secret = process.env.AGENT_SECRET;
    if (!base || !secret) throw new Error('The opportunities agent is not configured.');
    const response = await fetch(new URL(`/jobs/${id}/cancel`, base), {
      method: 'POST', headers: { AGENT_SECRET: secret }, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `The opportunities agent returned HTTP ${response.status}.`);
    return Response.json({ id: data.id, status: data.status });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to cancel the opportunities job.' }, { status: 502 });
  }
}
