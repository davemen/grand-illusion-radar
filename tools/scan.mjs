// Headless scan + SCREAMING DEAL alert, for launchd. A lockfile stops two scans racing.
import { openSync, closeSync, unlinkSync, statSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { runScan } from '../lib/engine.mjs';

const LOCK = new URL('../data/scan.lock', import.meta.url).pathname;
mkdirSync(new URL('../data/', import.meta.url).pathname, { recursive: true });
try { if (Date.now() - statSync(LOCK).mtimeMs > 3 * 3600e3) unlinkSync(LOCK); } catch {}
let fd;
try { fd = openSync(LOCK, 'wx'); } catch { console.log('scan already running'); process.exit(0); }
try {
  const r = await runScan({ deep: !process.argv.includes('--quick') });
  console.log(new Date().toISOString(), 'scan done', r?.count ?? '');
  spawnSync('python3', [new URL('./alert.py', import.meta.url).pathname], { stdio: 'inherit' });
} finally { closeSync(fd); unlinkSync(LOCK); }
process.exit(0);
