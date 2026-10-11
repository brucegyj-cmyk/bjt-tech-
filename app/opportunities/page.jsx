'use client';

import { useEffect, useState } from 'react';

function elapsed(ms = 0) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function OpportunityCard({ opportunity, moderation, onDecision }) {
  return <article className="opportunity-card">
    <span className={`badge badge-${opportunity.status}`}>{opportunity.status}</span>
    <h3>{opportunity.title}</h3>
    <p>{opportunity.why_it_fits}</p>
    {opportunity.source_excerpt && <div className="evidence"><p>{opportunity.source_excerpt}</p></div>}
    <a className="source-link" href={opportunity.url} target="_blank" rel="noreferrer">Official source ↗</a>
    {moderation && <div className="moderation-actions"><button type="button" className="decision approve" onClick={() => onDecision(opportunity, 'approve')}>Approve</button><button type="button" className="decision reject" onClick={() => onDecision(opportunity, 'reject')}>Reject</button></div>}
  </article>;
}

export default function OpportunitiesPage() {
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [password, setPassword] = useState('');
  const [isModerator, setIsModerator] = useState(false);
  const [askingPassword, setAskingPassword] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [showActivity, setShowActivity] = useState(false);

  async function loadApproved() {
    const response = await fetch('/api/opportunities', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load approved opportunities.');
    setApproved(data.opportunities);
  }
  async function loadPending(value = password) {
    const response = await fetch('/api/opportunities/new', { cache: 'no-store', headers: { 'x-site-password': value } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load pending opportunities.');
    setPending(data.opportunities);
  }
  useEffect(() => { loadApproved().catch((loadError) => setError(loadError.message)); }, []);
  useEffect(() => {
    if (!job?.id || ['completed', 'error', 'cancelled'].includes(job.status)) return undefined;
    const poll = async () => {
      try {
        const response = await fetch(`/api/opportunities/jobs/${job.id}`, { cache: 'no-store', headers: { 'x-site-password': password } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to read job progress.');
        setJob(data);
        if (data.status === 'completed') await Promise.all([loadApproved(), loadPending()]);
      } catch (pollError) { setError(pollError.message); }
    };
    poll();
    const timer = window.setInterval(poll, 1500);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status, password]);

  const isRunning = job && !['completed', 'error', 'cancelled'].includes(job.status);
  async function unlock(event) {
    event.preventDefault(); setError('');
    try { await loadPending(password); setIsModerator(true); setAskingPassword(false); } catch (unlockError) { setError(unlockError.message); }
  }
  async function startJob() {
    setError('');
    try {
      const response = await fetch('/api/opportunities/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start the job.');
      setJob({ id: data.id, status: data.status, progress: { searches: 0, pageReads: 0, elapsedMs: 0 }, toolCalls: [] });
    } catch (startError) { setError(startError.message); }
  }
  async function refreshOpportunities() { if (!isModerator) { setAskingPassword(true); return; } await startJob(); }
  async function decide(opportunity, decision) {
    const wasPending = pending;
    setPending((items) => items.filter((item) => item.id !== opportunity.id));
    if (decision === 'approve') setApproved((items) => [{ ...opportunity, status: 'approved' }, ...items]);
    try {
      const response = await fetch(`/api/opportunities/${opportunity.id}/${decision}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to ${decision} opportunity.`);
      if (decision === 'approve') setApproved((items) => items.map((item) => item.id === opportunity.id ? data.opportunity : item));
    } catch (decisionError) {
      setPending(wasPending);
      if (decision === 'approve') setApproved((items) => items.filter((item) => item.id !== opportunity.id));
      setError(decisionError.message);
    }
  }
  return <>
    <div className="announcement"><span className="pulse" /> RESEARCH DESK <span>•</span> VERIFIED OPPORTUNITIES</div>
    <header className="site-header"><a className="brand" href="/"><span className="brand-mark">B</span><span>BJT<span className="accent">.</span>TECH</span></a><nav aria-label="Site navigation"><a href="/">Price tracker</a><a className="nav-current" href="/opportunities">Opportunities</a></nav><span className="agent-status">{isModerator ? 'MODERATION / ON' : 'PUBLIC / APPROVED'}</span></header>
    <main className="opportunities-page">
      <section className="opportunity-hero"><div><p className="eyebrow">PERSONALISED RESEARCH</p><h1>Find your next<br /><em>good opportunity.</em></h1><p>Approved opportunities are public. Sign in with the site password to review fresh research before it goes live.</p></div><div className="opportunity-actions"><button className="button primary" type="button" onClick={refreshOpportunities} disabled={isRunning}>{isRunning ? 'Research in progress' : 'Refresh opportunities'} <span>↗</span></button><p>{isModerator ? 'Pending opportunities are visible to you only.' : 'Approved opportunities are shown below.'}</p></div></section>
      {askingPassword && <div className="dialog-backdrop"><form className="watch-dialog password-dialog" onSubmit={unlock}><button className="dialog-close" type="button" aria-label="Close" onClick={() => setAskingPassword(false)}>×</button><p className="eyebrow">SITE ACCESS</p><h2>Review fresh research</h2><p>Enter your site password to view pending items or run a refresh. It is kept only in this page session.</p><label htmlFor="site-password">Site password</label><input id="site-password" type="password" value={password} autoFocus required onChange={(event) => setPassword(event.target.value)} /><button className="button primary" type="submit">Unlock moderation <span>↗</span></button></form></div>}
      {error && <p className="agent-error" role="alert">{error}</p>}
      {isModerator && <section className="result-section moderation-section"><div className="section-heading"><div><p className="eyebrow">PENDING REVIEW</p><h2>Fresh research to decide.</h2></div></div>{pending.length ? <div className="opportunity-grid">{pending.map((item) => <OpportunityCard opportunity={item} moderation onDecision={decide} key={item.id} />)}</div> : <p className="no-results">Nothing is waiting for review.</p>}</section>}
      {job && <section className="job-panel" aria-live="polite"><div className="job-panel-top"><div><p className="eyebrow">RESEARCH JOB</p><h2>{job.status === 'completed' ? 'Research complete.' : job.status === 'error' ? 'Research stopped.' : 'Researching live.'}</h2></div></div><div className="job-metrics"><span><strong>{job.progress?.searches ?? 0}</strong> / 10 searches</span><span><strong>{job.progress?.pageReads ?? 0}</strong> / 15 sources read</span><span><strong>{elapsed(job.progress?.elapsedMs)}</strong> elapsed</span></div><button className="activity-toggle" type="button" onClick={() => setShowActivity((value) => !value)}>{showActivity ? 'Hide' : 'Show'} live activity <span>{job.toolCalls?.length ?? 0}</span></button>{showActivity && <ol className="activity-list">{job.toolCalls?.map((call, index) => <li key={`${call.at}-${index}`}><span>{call.name}</span>{call.url && <a href={call.url} target="_blank" rel="noreferrer">Open source ↗</a>}</li>)}</ol>}</section>}
      <section className="result-section"><div className="section-heading"><div><p className="eyebrow">APPROVED OPPORTUNITIES</p><h2>Ready to explore.</h2></div></div>{approved.length ? <div className="opportunity-grid">{approved.map((item) => <OpportunityCard opportunity={item} key={item.id} />)}</div> : <p className="no-results">No approved opportunities yet. Check back soon.</p>}</section>
    </main>
  </>;
}

/*

import { useEffect, useMemo, useState } from 'react';

function elapsed(ms = 0) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function parseResults(results) {
  if (!results) return null;
  if (typeof results === 'object') return results;
  try { return JSON.parse(results); } catch { return { researchNotes: results, opportunities: [], ruledOut: [] }; }
}

export default function OpportunitiesPage() {
  const [job, setJob] = useState(null);
  const [password, setPassword] = useState('');
  const [askingPassword, setAskingPassword] = useState(false);
  const [error, setError] = useState('');
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => {
    if (!job?.id || ['completed', 'error', 'cancelled'].includes(job.status)) return undefined;
    const poll = async () => {
      try {
        const response = await fetch(`/api/opportunities/jobs/${job.id}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to read job progress.');
        setJob(data);
        if (data.error) setError(data.error);
      } catch (pollError) { setError(pollError.message); }
    };
    poll();
    const timer = window.setInterval(poll, 1500);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  const results = useMemo(() => parseResults(job?.results), [job?.results]);
  const isRunning = job && !['completed', 'error', 'cancelled'].includes(job.status);

  async function startJob(event) {
    event.preventDefault();
    setError('');
    try {
      const response = await fetch('/api/opportunities/jobs', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start the job.');
      setJob({ id: data.id, status: data.status, progress: { searches: 0, pageReads: 0, elapsedMs: 0 }, toolCalls: [] });
      setAskingPassword(false);
    } catch (startError) { setError(startError.message); }
  }

  async function cancelJob() {
    if (!job?.id) return;
    setError('');
    try {
      const response = await fetch(`/api/opportunities/jobs/${job.id}/cancel`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to cancel the job.');
      setJob((current) => ({ ...current, status: data.status }));
    } catch (cancelError) { setError(cancelError.message); }
  }

  return <>
    <div className="announcement"><span className="pulse" /> RESEARCH DESK <span>•</span> LIVE VERIFIED OPPORTUNITIES</div>
    <header className="site-header">
      <a className="brand" href="/"><span className="brand-mark">B</span><span>BJT<span className="accent">.</span>TECH</span></a>
      <nav aria-label="Site navigation"><a href="/">Price tracker</a><a className="nav-current" href="/opportunities">Opportunities</a></nav>
      <span className="agent-status">AGENT / LOCAL</span>
    </header>
    <main className="opportunities-page">
      <section className="opportunity-hero">
        <div><p className="eyebrow">PERSONALISED RESEARCH</p><h1>Find your next<br /><em>good opportunity.</em></h1><p>Fresh competitions, programs and events researched against your location and interests. Every result needs an official source before it appears.</p></div>
        <div className="opportunity-actions"><button className="button primary" type="button" onClick={() => setAskingPassword(true)} disabled={isRunning}>{isRunning ? 'Research in progress' : 'Refresh opportunities'} <span>↗</span></button><p>Results exist only in this browser session.</p></div>
      </section>

      {askingPassword && <div className="dialog-backdrop"><form className="watch-dialog password-dialog" onSubmit={startJob}><button className="dialog-close" type="button" aria-label="Close" onClick={() => setAskingPassword(false)}>×</button><p className="eyebrow">SITE ACCESS</p><h2>Start a research run</h2><p>Enter your site password. It is checked by this site&rsquo;s server and is not saved.</p><label htmlFor="site-password">Site password</label><input id="site-password" type="password" value={password} autoFocus required onChange={(event) => setPassword(event.target.value)} /><button className="button primary" type="submit">Start research <span>↗</span></button></form></div>}

      {error && <p className="agent-error" role="alert">{error}</p>}
      {job && <section className="job-panel" aria-live="polite"><div className="job-panel-top"><div><p className="eyebrow">RESEARCH JOB</p><h2>{job.status === 'completed' ? 'Research complete.' : job.status === 'error' ? 'Research stopped.' : job.status === 'cancelled' ? 'Research cancelled.' : 'Researching live.'}</h2></div>{isRunning && <button className="cancel-button" type="button" onClick={cancelJob}>Cancel</button>}</div><div className="job-metrics"><span><strong>{job.progress?.searches ?? 0}</strong> / 10 searches</span><span><strong>{job.progress?.pageReads ?? 0}</strong> / 15 sources read</span><span><strong>{elapsed(job.progress?.elapsedMs)}</strong> elapsed</span></div><button className="activity-toggle" type="button" onClick={() => setShowActivity((value) => !value)}>{showActivity ? 'Hide' : 'Show'} live activity <span>{job.toolCalls?.length ?? 0}</span></button>{showActivity && <ol className="activity-list">{job.toolCalls?.map((call, index) => <li key={`${call.at}-${index}`}><span>{call.name === 'web_search' ? 'Searching' : call.name === 'open_page' ? 'Reading source' : 'Checking matches'}</span>{call.query && <em>{call.query}</em>}{call.name === 'checking_matches' && <em>age {call.age ? 'found' : 'missing'} · location {call.location ? 'found' : 'missing'} · availability {call.availability ? 'found' : 'missing'}</em>}{call.url && <a href={call.url} target="_blank" rel="noreferrer">Open source ↗</a>}</li>)}{!job.toolCalls?.length && <li><span>Preparing research</span></li>}</ol>}</section>}

      {results && <section className="result-section"><div className="section-heading"><div><p className="eyebrow">VERIFIED MATCHES</p><h2>What the agent found.</h2></div></div>{results.opportunities?.length ? <div className="opportunity-grid">{results.opportunities.map((item, index) => <article className="opportunity-card" key={`${item.name}-${index}`}><span className="badge">{item.type}</span><h3>{item.name}</h3><p>{item.whyItFits}</p><dl><div><dt>Location</dt><dd>{item.location}</dd></div><div><dt>Availability</dt><dd>{item.availability}</dd></div></dl><div className="evidence"><p>{item.ageEvidence || item.sourceExcerpt}</p>{item.locationEvidence && <p>{item.locationEvidence}</p>}{item.availabilityEvidence && <p>{item.availabilityEvidence}</p>}</div><a className="source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a></article>)}</div> : <p className="no-results">No opportunity met every verification requirement in this run.</p>}{results.ruledOut?.length > 0 && <div className="ruled-out"><p className="eyebrow">RULED OUT</p>{results.ruledOut.map((item, index) => <article key={`${item.name}-${index}`}><h3>{item.name}</h3><p>{item.reason}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></article>)}</div>}{results.researchNotes && <p className="research-notes">{results.researchNotes}</p>}</section>}
    </main>
  </>;
}
*/
