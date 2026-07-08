#!/usr/bin/env node
/**
 * Start local static server (if needed) and open Tracker Brief Viewer
 * in Cursor Simple Browser (default) — not external Chrome/Safari.
 *
 * Requires one-time: npm run brief:install-opener
 * (Cursor does not support vscode.runCommands URLs — it tries to install a fake extension.)
 *
 * Usage:
 *   node scripts/open-brief-viewer.js
 *   node scripts/open-brief-viewer.js --run _sample-product-day
 *   node scripts/open-brief-viewer.js --port 8765 --no-open
 *   node scripts/open-brief-viewer.js --external   # system browser fallback
 */

const net = require('net');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');
const path = require('path');
const { loadLatest } = require('../lib/briefPaths.js');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');
const DEFAULT_PORT = 8765;
const EXT_ID = 'entrata.tracker-brief-opener';

function parseArgs(argv) {
  const args = { run: null, port: DEFAULT_PORT, open: true, external: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--run' && argv[i + 1]) {
      args.run = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--port' && argv[i + 1]) {
      args.port = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--no-open') {
      args.open = false;
    } else if (argv[i] === '--external') {
      args.external = true;
    }
  }
  return args;
}

function findCursorBin() {
  const candidates = [
    process.env.CURSOR_BIN,
    '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
  ].filter(Boolean);
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

/**
 * Returns false only when the CLI confirms the opener is absent. A stalled/failed
 * CLI returns true ("unknown — proceed"): the request-file watcher is the real open
 * path and harmlessly no-ops if the extension truly isn't installed. This keeps a
 * slow `--list-extensions` from blocking the run or suppressing the open.
 */
function isOpenerExtensionInstalled(cursorBin) {
  try {
    const listed = execSync(`"${cursorBin}" --list-extensions`, {
      encoding: 'utf8',
      timeout: 3000,
    });
    return listed.split('\n').some((line) => line.trim() === EXT_ID);
  } catch {
    return true;
  }
}

function portInUse(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(true));
    srv.once('listening', () => {
      srv.close(() => resolve(false));
    });
    srv.listen(port, '127.0.0.1');
  });
}

async function ensureServer(port) {
  if (await portInUse(port)) {
    process.stdout.write(`open-brief-viewer: port ${port} already in use — reusing.\n`);
    return null;
  }
  const child = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  process.stdout.write(`open-brief-viewer: started python3 -m http.server ${port} (repo root).\n`);
  await new Promise((r) => setTimeout(r, 400));
  return child;
}

function viewerUrl(port, runId) {
  const base = `http://127.0.0.1:${port}/tracker-briefs/viewer/index.html`;
  // Per-open cache-bust on the PAGE url (not just ?v= assets). Simple Browser
  // otherwise caches index.html itself, so viewer code changes silently don't
  // show up until a manual hard-refresh — the recurring "stale viewer" bug.
  const bust = `_t=${Date.now()}`;
  return runId ? `${base}?run=${encodeURIComponent(runId)}&${bust}` : `${base}?${bust}`;
}

function activateCursor() {
  if (process.platform !== 'darwin') return;
  try {
    // Fire-and-forget: `osascript ... activate` can take several seconds when Cursor
    // is busy. Bringing the app forward is cosmetic, so it must never block the open.
    const child = spawn('osascript', ['-e', 'tell application "Cursor" to activate'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    /* Cursor not installed or not running */
  }
}

function copyUrlToClipboard(url) {
  if (process.platform !== 'darwin') return;
  try {
    execSync('pbcopy', { input: url });
    process.stdout.write('open-brief-viewer: URL copied to clipboard (fallback).\n');
  } catch {
    /* ignore */
  }
}

/** Local extension URI — cursor://vscode.runCommands is broken in Cursor (marketplace error). */
function extensionOpenerUri(url) {
  const query = new URLSearchParams({ url }).toString();
  return `cursor://${EXT_ID}/open?${query}`;
}

/**
 * Fire-and-forget secondary. The watched request file is the reliable open path,
 * so this CLI nudge must never block: detach it and don't wait. Setups where
 * cursor:// routing already works get an extra (harmless, idempotent) open.
 */
function openViaCursorCli(cursorBin, targetUrl) {
  const child = spawn(cursorBin, ['--open-url', targetUrl], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

const HOME_REQUEST_PATH = path.join(os.homedir(), '.tracker-brief-open-request.json');
// Workspace request file — the agent sandbox allows workspace writes but blocks
// home-dir writes, so this is the path that lets a sandboxed morningbrief trigger
// auto-open. The extension (>=1.1.0) watches it.
const WS_REQUEST_PATH = path.join(repoRoot, 'tracker-briefs', '.open-request.json');

/**
 * Primary open path: write a request file the extension watches. Written to BOTH
 * the home dir (works when run outside the sandbox) and the workspace (works when
 * run sandboxed, since workspace writes are permitted). Each write is independent
 * so a blocked home write never prevents the workspace write. Returns true if at
 * least one landed.
 */
function writeOpenRequest(url) {
  const payload = JSON.stringify({ url, ts: Date.now() });
  let wrote = false;
  for (const p of [WS_REQUEST_PATH, HOME_REQUEST_PATH]) {
    try {
      fs.writeFileSync(p, payload, 'utf8');
      wrote = true;
    } catch {
      /* path blocked (e.g. sandbox blocks home dir) — the other path may succeed */
    }
  }
  return wrote;
}

/** Default — Cursor Simple Browser tab via the watched request file (+ CLI best-effort). */
function openInCursorSimpleBrowser(url, cursorBin) {
  // Reliable path first: the watcher opens within ~1s regardless of CLI latency.
  const wrote = writeOpenRequest(url);
  // Best-effort, non-blocking extras: bring Cursor forward and nudge the URI handler
  // for setups where cursor:// routing already works.
  activateCursor();
  try {
    openViaCursorCli(cursorBin, extensionOpenerUri(url));
  } catch {
    /* request file is the reliable path; CLI is optional */
  }
  return wrote;
}

function openInExternalBrowser(url) {
  execSync(`open "${url}"`, { stdio: 'ignore' });
}

function printManualFallback() {
  process.stdout.write('  Manual: Cmd+Shift+P → "Simple Browser: Show" → Cmd+V (URL in clipboard)\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const latest = loadLatest();
  let runId = args.run || (latest?.status === 'ready' ? latest.run_id : null);
  // Default latest is often PMM-only (0 prototypes) — demo run shows ROI cards
  if (!args.run && latest && (latest.prototype_count ?? 0) === 0) {
    runId = '_sample-product-day';
    process.stdout.write('open-brief-viewer: latest has 0 prototypes — opening Product-day demo.\n');
  }
  await ensureServer(args.port);
  const url = viewerUrl(args.port, runId);

  process.stdout.write(`\nTracker Brief Viewer:\n  ${url}\n`);

  if (!args.open) {
    process.stdout.write('\nopen-brief-viewer: --no-open — paste URL in Simple Browser if needed.\n');
    return;
  }

  if (process.platform !== 'darwin') {
    process.stdout.write('\nopen-brief-viewer: auto-open is macOS-only — paste URL in Simple Browser.\n');
    return;
  }

  copyUrlToClipboard(url);

  if (args.external) {
    openInExternalBrowser(url);
    process.stdout.write('open-brief-viewer: opened in system browser (--external).\n');
    return;
  }

  const cursorBin = findCursorBin();
  if (!cursorBin) {
    process.stdout.write('\nopen-brief-viewer: Cursor CLI not found — install Cursor or set CURSOR_BIN.\n');
    printManualFallback();
    return;
  }

  // Fire the open immediately: writing the watched request file is the reliable path
  // and the extension opens the Simple Browser within ~1s. Slow Cursor-CLI probes are
  // deferred below so they never delay the actual open.
  try {
    const wrote = openInCursorSimpleBrowser(url, cursorBin);
    if (wrote) {
      process.stdout.write('open-brief-viewer: requested Simple Browser open via watched request file.\n');
    } else {
      process.stdout.write('open-brief-viewer: could not write a request file (home + workspace both blocked).\n');
      printManualFallback();
    }
  } catch (err) {
    process.stdout.write(`open-brief-viewer: auto-open failed — ${err.message}\n`);
    printManualFallback();
    process.exit(1);
  }

  // Advisory only (post-open): if the CLI confirms the opener is missing, tell the
  // user how to install it. A slow/blocked CLI is treated as "present" and skipped.
  if (!isOpenerExtensionInstalled(cursorBin)) {
    process.stdout.write(`\nopen-brief-viewer: ${EXT_ID} not installed (required once).\n`);
    process.stdout.write('  Run: npm run brief:install-opener --prefix initiative-1-tracker/tracker\n');
    process.stdout.write('  Then reload Cursor and re-run this command.\n');
    printManualFallback();
  } else {
    process.stdout.write('  If nothing appeared: ensure the window is reloaded after install, then retry.\n');
  }

  // The request file is written and detached helpers are launched; nothing else needs
  // the event loop. Exit now so a slow Cursor CLI can never stall the morningbrief run.
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`open-brief-viewer: ${err.message}\n`);
  process.exit(1);
});
