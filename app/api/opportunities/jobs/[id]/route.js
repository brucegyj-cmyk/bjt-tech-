function validId(id) {
  return /^[0-9a-f-]{36}$/i.test(id);
}

function agentUrl(path) {
  const base = process.env.AGENT_URL;
  if (!base) throw new Error('The opportunities agent is not configured.');
  return new URL(path, base).toString();
}

async function agentRequest(path) {
  const secret = process.env.AGENT_SECRET;
  if (!secret) throw new Error('The opportunities agent is not configured.');
  const response = await fetch(agentUrl(path), {
    cache: 'no-store',
    headers: { AGENT_SECRET: secret },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: 'The opportunities agent returned an invalid response.' }; }
  if (!response.ok) throw new Error(data.error || `The opportunities agent returned HTTP ${response.status}.`);
  return data;
}

export async function GET(request, { params }) {
  try {
    if (!hasRequestSitePassword(request)) return Response.json({ error: 'Incorrect site password.' }, { status: 401 });
    const { id } = await params;
    if (!validId(id)) return Response.json({ error: 'Invalid job id.' }, { status: 400 });
    const job = await agentRequest(`/jobs/${id}`);
    return Response.json(job);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to read the opportunities job.' }, { status: 502 });
  }
}
import { hasRequestSitePassword } from '../../../../../utils/site-password';

