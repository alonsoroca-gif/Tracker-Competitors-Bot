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
const { spawn, spawnSync, execSync } = require('child_process');
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

function isOpenerExtensionInstalled(cursorBin) {
  try {
    const listed = execSync(`"${cursorBin}" --list-extensions`, { encoding: 'utf8' });
    return listed.split('\n').some((line) => line.trim() === EXT_ID);
  } catch {
    return false;
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
  return runId ? `${base}?run=${encodeURIComponent(runId)}` : base;
}

function activateCursor() {
  if (process.platform !== 'darwin') return;
  try {
    execSync('osascript -e \'tell application "Cursor" to activate\'', { stdio: 'ignore' });
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

/** Cursor CLI writes under ~/Library/Application Support/Cursor/logs — blocked in agent sandbox. */
function isCursorCliBlocked() {
  if (process.platform !== 'darwin') return false;
  const probeDir = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Cursor',
    'logs',
    `.open-probe-${process.pid}`,
  );
  try {
    fs.mkdirSync(probeDir, { recursive: true });
    fs.rmdirSync(probeDir);
    return false;
  } catch (err) {
    return err.code === 'EPERM' || err.code === 'EACCES';
  }
}

function openViaCursorCli(cursorBin, targetUrl) {
  const result = spawnSync(cursorBin, ['--open-url', targetUrl], {
    encoding: 'utf8',
    timeout: 15000,
  });
  const combined = `${result.stderr || ''}${result.stdout || ''}${result.error?.message || ''}`;
  if (/EPERM|operation not permitted/i.test(combined)) {
    const err = new Error('CURSOR_CLI_SANDBOX_BLOCKED');
    err.detail = combined.trim();
    throw err;
  }
  if (result.status !== 0) {
    throw new Error(`cursor --open-url exited ${result.status ?? 'unknown'}`);
  }
}

/** Default — Cursor Simple Browser tab via local extension + cursor --open-url. */
function openInCursorSimpleBrowser(url, cursorBin) {
  activateCursor();
  openViaCursorCli(cursorBin, extensionOpenerUri(url));
}

function openInExternalBrowser(url) {
  execSync(`open "${url}"`, { stdio: 'ignore' });
}

function printManualFallback() {
  process.stdout.write('  Manual: Cmd+Shift+P → "Simple Browser: Show" → Cmd+V (URL in clipboard)\n');
}

function printSandboxBlockedHelp() {
  process.stdout.write('\nopen-brief-viewer: auto-open blocked — agent sandbox cannot run cursor --open-url.\n');
  process.stdout.write('  Agent: re-run with Shell required_permissions ["all"].\n');
  printManualFallback();
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

  if (isCursorCliBlocked()) {
    printSandboxBlockedHelp();
    process.exit(1);
  }

  if (!isOpenerExtensionInstalled(cursorBin)) {
    process.stdout.write(`\nopen-brief-viewer: ${EXT_ID} not installed (required once).\n`);
    process.stdout.write('  Run: npm run brief:install-opener --prefix initiative-1-tracker/tracker\n');
    process.stdout.write('  Then reload Cursor and re-run this command.\n');
    printManualFallback();
    return;
  }

  try {
    openInCursorSimpleBrowser(url, cursorBin);
    process.stdout.write('open-brief-viewer: sent to Cursor Simple Browser via local extension.\n');
    process.stdout.write('  If nothing appeared: reload Cursor window, then retry.\n');
  } catch (err) {
    if (err.message === 'CURSOR_CLI_SANDBOX_BLOCKED') {
      printSandboxBlockedHelp();
    } else {
      process.stdout.write(`open-brief-viewer: auto-open failed — ${err.message}\n`);
      printManualFallback();
    }
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`open-brief-viewer: ${err.message}\n`);
  process.exit(1);
});
