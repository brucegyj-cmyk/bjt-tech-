import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Agent, run, tool, webSearchTool } from '@openai/agents';
import { z } from 'zod';

const PORT = Number(process.env.PORT || 8080);
const MAX_SEARCHES = 10;
const MAX_PAGE_READS = 15;
const MAX_DURATION_MS = 4 * 60 * 1000;
const PAGE_TEXT_LIMIT = 24_000;
const jobs = new Map();

function envRequired(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function elapsed(job) {
  return Date.now() - job.startedAt;
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    progress: {
      searches: job.searches,
      pageReads: job.pageReads,
      elapsedMs: elapsed(job),
      limitMs: MAX_DURATION_MS,
    },
    toolCalls: job.toolCalls,
    ...(job.status === 'completed' ? { results: job.results } : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}

function recordToolCall(job, name, details = {}) {
  const call = { name, at: new Date().toISOString(), ...details };
  job.toolCalls.push(call);
  console.log(`[job ${job.id}] tool ${name} ${JSON.stringify(details)}`);
}

function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromHtml(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? cleanHtml(match[1]) : '';
}

function evidenceSignals(text) {
  return {
    age: /\b(age|adult|over[- ]?\d+|years? old|18\+|no age limit)\b/i.test(text),
    location: /\b(auckland|new zealand|online|venue|address|located)\b/i.test(text),
    availability: /\b(apply|application|register|registration|enrol|enrollment|entries open|looking for players|spots remaining)\b/i.test(text),
  };
}

function assertSafePageUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('open_page only accepts http or https URLs.');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === '::1' || /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
    throw new Error('open_page cannot read local or private-network addresses.');
  }
  return url;
}

function createOpenPageTool(job) {
  return tool({
    name: 'open_page',
    description: 'Read exactly one public web page. Use this only after web search to verify an official source for a shortlisted opportunity. Return a short excerpt containing age eligibility, location, and application availability when present.',
    parameters: z.object({ url: z.string().describe('The official public page URL to read.') }),
    async execute({ url }) {
      if (job.controller.signal.aborted) throw new Error('Job cancelled or timed out.');
      if (job.pageReads >= MAX_PAGE_READS) throw new Error(`Page-read limit reached (${MAX_PAGE_READS}).`);
      const target = assertSafePageUrl(url);
      job.pageReads += 1;
      recordToolCall(job, 'open_page', { url: target.toString(), pageRead: job.pageReads });
      const response = await fetch(target, {
        redirect: 'follow',
        signal: job.controller.signal,
        headers: { 'user-agent': 'OpportunityResearchAgent/1.0' },
      });
      if (!response.ok) throw new Error(`Could not read page: HTTP ${response.status}.`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error(`Could not read page: unsupported content type ${contentType || 'unknown'}.`);
      }
      const html = await response.text();
      const text = cleanHtml(html).slice(0, PAGE_TEXT_LIMIT);
      const signals = evidenceSignals(text);
      recordToolCall(job, 'checking_matches', { url: response.url, ...signals });
      return JSON.stringify({
        url: response.url,
        title: titleFromHtml(html),
        text,
        evidenceSignals: signals,
        truncated: cleanHtml(html).length > PAGE_TEXT_LIMIT,
      });
    },
  });
}

function createAgent(job) {
  return new Agent({
    name: 'Opportunity Research Agent',
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    instructions: `You research current competitions, programs, and events for the supplied person.

You must use web_search before open_page. Search first, then open an official source for every item you may shortlist. You have a hard budget of at most ${MAX_SEARCHES} web searches, ${MAX_PAGE_READS} page reads, and four minutes total. Use only the official organiser, host, or government/education page as final evidence. If a page cannot be read, search for another official source.

For each included item, verify all three: age eligibility, location suitability, and that applications/registration are currently open. Age evidence must explicitly state an age range, adulthood, or that no age limit applies; do not infer it from words such as professional, founder, or senior. Location evidence must name the place or confirm online availability. Availability evidence must explicitly show that registration, applications, enrolment, or player intake is current. Do not assume school enrollment, qualifications, work experience, citizenship, or prior achievements. Do not invent enough items to reach five; return fewer if evidence is insufficient.

Return concise JSON only with this shape:
{
  "opportunities": [{"name":"", "type":"competition|program|event", "location":"", "availability":"", "whyItFits":"", "sourceUrl":"", "ageEvidence":"", "locationEvidence":"", "availabilityEvidence":""}],
  "ruledOut": [{"name":"", "reason":"", "sourceUrl":""}],
  "researchNotes":""
}
Every included opportunity must have short official-source excerpts in ageEvidence, locationEvidence, and availabilityEvidence. If any evidence is missing, investigate further and then rule it out rather than accepting it.`,
    tools: [
      webSearchTool({ searchContextSize: 'medium', userLocation: { type: 'approximate', city: 'Auckland', country: 'NZ' } }),
      createOpenPageTool(job),
    ],
  });
}

function hostedToolName(item) {
  const text = JSON.stringify(item).toLowerCase();
  return text.includes('web_search') ? 'web_search' : null;
}

function searchQueryFrom(item) {
  const seen = new Set();
  function find(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return undefined;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'query' || key === 'search_query' || key === 'q') && typeof child === 'string') return child;
      const nested = find(child);
      if (nested) return nested;
    }
    return undefined;
  }
  return find(item);
}

async function runJob(job) {
  job.status = 'running';
  const interests = await readFile(new URL('./interests.txt', import.meta.url), 'utf8');
  const agent = createAgent(job);
  const timeout = setTimeout(() => job.controller.abort(new Error('Research time limit reached.')), MAX_DURATION_MS);
  try {
    const streamed = await run(agent, `Research opportunities for this person. Their details are:\n${interests}`, {
      stream: true,
      maxTurns: MAX_SEARCHES + MAX_PAGE_READS,
      signal: job.controller.signal,
    });
    const seenHostedCalls = new Set();
    for await (const event of streamed) {
      if (event.type !== 'run_item_stream_event' || event.name !== 'tool_called') continue;
      const toolName = hostedToolName(event.item);
      if (toolName !== 'web_search') continue;
      const key = event.item?.rawItem?.id || event.item?.id || JSON.stringify(event.item);
      if (seenHostedCalls.has(key)) continue;
      seenHostedCalls.add(key);
      if (job.searches >= MAX_SEARCHES) {
        job.controller.abort(new Error(`Search limit reached (${MAX_SEARCHES}).`));
        break;
      }
      job.searches += 1;
      const query = searchQueryFrom(event.item);
      recordToolCall(job, 'web_search', { search: job.searches, ...(query ? { query } : {}) });
    }
    await streamed.completed;
    if (job.controller.signal.aborted) throw job.controller.signal.reason || new Error('Job cancelled.');
    job.results = streamed.finalOutput;
    job.status = 'completed';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job.status = job.cancelRequested ? 'cancelled' : 'error';
    job.error = message;
  } finally {
    clearTimeout(timeout);
  }
}

function authorize(request) {
  const expected = envRequired('AGENT_SECRET');
  const supplied = request.headers.agent_secret;
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function body(request) {
  let value = '';
  for await (const chunk of request) {
    value += chunk;
    if (value.length > 16_384) throw new Error('Request body is too large.');
  }
  return value;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('agent is running');
      return;
    }
    if (request.method === 'POST' && url.pathname === '/jobs') {
      if (!authorize(request)) return sendJson(response, 401, { error: 'Unauthorized' });
      await body(request);
      const job = {
        id: randomUUID(), status: 'queued', startedAt: Date.now(), searches: 0, pageReads: 0,
        toolCalls: [], controller: new AbortController(), cancelRequested: false, results: null, error: null,
      };
      jobs.set(job.id, job);
      void runJob(job);
      return sendJson(response, 202, { id: job.id, status: job.status });
    }
    const match = url.pathname.match(/^\/jobs\/([0-9a-f-]+)$/i);
    if (match && request.method === 'GET') {
      const job = jobs.get(match[1]);
      return job ? sendJson(response, 200, publicJob(job)) : sendJson(response, 404, { error: 'Job not found' });
    }
    if (match && request.method === 'POST' && url.pathname.endsWith('/cancel')) {
      return sendJson(response, 404, { error: 'Job not found' });
    }
    const cancelMatch = url.pathname.match(/^\/jobs\/([0-9a-f-]+)\/cancel$/i);
    if (cancelMatch && request.method === 'POST') {
      if (!authorize(request)) return sendJson(response, 401, { error: 'Unauthorized' });
      const job = jobs.get(cancelMatch[1]);
      if (!job) return sendJson(response, 404, { error: 'Job not found' });
      job.cancelRequested = true;
      job.controller.abort(new Error('Cancelled by request.'));
      return sendJson(response, 202, { id: job.id, status: 'cancelling' });
    }
    return sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(response, 500, { error: error instanceof Error ? error.message : 'Server error' });
  }
});

server.listen(PORT, () => console.log(`Opportunity research agent listening on port ${PORT}`));
