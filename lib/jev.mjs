// TypeSafe Jev scorer for stage-illusion relevance.
//
// Two modes. Rank (on unless JEV_RANK=0): every kept listing gets a `jev` tag — its P(yes)
// on `stage_illusion` and a band from jev.config.json's thresholds — and the UI hides the
// "not-stage" band behind a toggle. The tag never changes `verdict` and never drops a
// listing from disk. Shadow (JEV_SHADOW=1): also log every graded listing, rejects included,
// for offline comparison. Every call fails open (resolves to null) on any error, timeout, or
// missing key, and an untagged listing is shown exactly as before. See jev.config.json for
// the questions and cutoffs and tools/jev-bridge.py for the process this talks to (all Jev calls go through
// ~/.claude/skills/jev-savings/scripts/jev_client.py; nothing here reimplements the key
// lookup, redaction, or logging that script already does).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(HERE, '..', 'tools', 'jev-bridge.py');
const CONFIG = path.join(HERE, '..', 'jev.config.json');
const SITE = 'illusion_relevance';
const TIMEOUT_MS = 5000; // matches the gateway timeout in jev-savings/references/migration-protocol.md

export const JEV_SHADOW_ENABLED = process.env.JEV_SHADOW === '1';
export const JEV_RANK_ENABLED = process.env.JEV_RANK !== '0';

// Cutoffs live in jev.config.json (one file per repo); policy lives here.
const THRESHOLDS = (() => {
  try { return JSON.parse(readFileSync(CONFIG, 'utf8')).sites[SITE].thresholds; } catch { return null; }
})();

/**
 * Band one Jev answer: 'not-stage' below demote_below_p_yes, 'review' below
 * review_below_p_yes, else 'stage'. Null (show as before) on a missing answer or config.
 */
export function jevTag(answers, t = THRESHOLDS) {
  const p = answers?.stage_illusion?.noul;
  if (typeof p !== 'number' || !t) return null;
  const band = p < t.demote_below_p_yes ? 'not-stage' : p < t.review_below_p_yes ? 'review' : 'stage';
  return { p_yes: p, band };
}

let proc = null, buf = '', queue = [];

// One long-lived python3 process per scan (amortizes interpreter startup), fed one JSON
// request per line and read back one JSON response per line, in order.
function ensureBridge() {
  if (proc) return proc;
  // Decision-log label: 'live:' when rank mode acts on the answer, 'shadow:' when only logged.
  const env = { ...process.env, JEV_SITE_PREFIX: JEV_RANK_ENABLED ? 'live:' : 'shadow:' };
  proc = spawn('python3', [BRIDGE, CONFIG, SITE], { stdio: ['pipe', 'pipe', 'inherit'], env });
  proc.on('exit', () => { proc = null; });
  proc.on('error', () => { proc = null; }); // e.g. python3 not found — callers still fail open
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', chunk => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      const entry = queue.shift();
      if (!entry) continue;
      try { entry.resolve(JSON.parse(line)); } catch (e) { entry.resolve({ error: String(e) }); }
    }
  });
  return proc;
}

/** State sent to Jev: named fields only, never the classifier's own score or verdict. */
export function toState(item) {
  const description = (item.desc || item.subtitle || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const price = item.priceText || (typeof item.price === 'number' ? `$${item.price}` : 'no price listed');
  const source = item.sourceLabel || item.source || 'unknown';
  return { title: (item.title || '').trim(), description, price, source };
}

/**
 * Score one listing against jev.config.json's `illusion_relevance` questions.
 * Returns { answers, input_tokens, cost_usd, latency_ms } or null. Never throws. Never
 * does arithmetic on Jev's output; jevTag() only compares P(yes) to the configured cutoffs.
 */
export async function shadowScore(item) {
  if (!JEV_SHADOW_ENABLED && !JEV_RANK_ENABLED) return null;
  try {
    const p = ensureBridge();
    if (!p.stdin.writable) return null;
    const result = await new Promise((resolve, reject) => {
      const entry = { resolve: () => {} };
      queue.push(entry);
      const timer = setTimeout(() => { entry.timedOut = true; reject(new Error('jev shadow timeout')); }, TIMEOUT_MS);
      entry.resolve = v => { if (!entry.timedOut) { clearTimeout(timer); resolve(v); } };
      p.stdin.write(JSON.stringify({ state: toState(item) }) + '\n', err => { if (err) reject(err); });
    });
    if (result.error) return null;
    return result;
  } catch {
    return null; // fail open — a shadow failure never touches the live scan
  }
}

/** Call once at the end of a scan so the process doesn't outlive it. */
export function closeJevBridge() {
  if (proc) { proc.stdin.end(); proc = null; }
}
