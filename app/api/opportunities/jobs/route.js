import { hasSitePassword } from '../../../../utils/site-password';

function agentUrl(path) {
  const base = process.env.AGENT_URL;
  if (!base) throw new Error('The opportunities agent is not configured.');
  return new URL(path, base).toString();
}

async function agentRequest(path, options = {}) {
  const secret = process.env.AGENT_SECRET;
  if (!secret) throw new Error('The opportunities agent is not configured.');
  const response = await fetch(agentUrl(path), {
    ...options,
    cache: 'no-store',
    headers: { ...options.headers, AGENT_SECRET: secret },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: 'The opportunities agent returned an invalid response.' }; }
  if (!response.ok) throw new Error(data.error || `The opportunities agent returned HTTP ${response.status}.`);
  return data;
}

export async function POST(request) {
  try {
    const { password } = await request.json();
    if (!hasSitePassword(password)) return Response.json({ error: 'Incorrect site password.' }, { status: 401 });
    const job = await agentRequest('/jobs', { method: 'POST' });
    return Response.json({ id: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to start the opportunities job.' }, { status: 502 });
  }
}
