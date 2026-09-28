// Shadow-mode TypeSafe Jev scorer for stage-illusion relevance.
//
// This never changes what a scan shows. It is off unless JEV_SHADOW=1, and every call
// fails open (resolves to null) on any error, timeout, or missing key — the caller falls
// straight back to classify()'s own verdict. See jev.config.json for the questions and
// tools/jev-bridge.py for the process this talks to (all Jev calls go through
// ~/.claude/skills/jev-savings/scripts/jev_client.py; nothing here reimplements the key
// lookup, redaction, or logging that script already does).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(HERE, '..', 'tools', 'jev-bridge.py');
const CONFIG = path.join(HERE, '..', 'jev.config.json');
const SITE = 'illusion_relevance';
const TIMEOUT_MS = 5000; // matches the gateway timeout in jev-savings/references/migration-protocol.md

export const JEV_SHADOW_ENABLED = process.env.JEV_SHADOW === '1';

let proc = null, buf = '', queue = [];

// One long-lived python3 process per scan (amortizes interpreter startup), fed one JSON
// request per line and read back one JSON response per line, in order.
function ensureBridge() {
  if (proc) return proc;
  proc = spawn('python3', [BRIDGE, CONFIG, SITE], { stdio: ['pipe', 'pipe', 'inherit'] });
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
 * Shadow-score one listing against jev.config.json's `illusion_relevance` questions.
 * Returns { answers, input_tokens, cost_usd, latency_ms } or null. Never throws. Never
 * does arithmetic on Jev's output — that is the caller's job (logging, comparison only).
 */
export async function shadowScore(item) {
  if (!JEV_SHADOW_ENABLED) return null;
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
