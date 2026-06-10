#!/usr/bin/env node
/**
 * Start local static server (if needed) and open Tracker Brief Viewer.
 *
 * Usage:
 *   node scripts/open-brief-viewer.js
 *   node scripts/open-brief-viewer.js --run _sample-product-day
 *   node scripts/open-brief-viewer.js --port 8765 --no-open
 */

const net = require('net');
const { spawn, execSync } = require('child_process');
const path = require('path');
const { loadLatest } = require('../lib/briefPaths.js');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');
const DEFAULT_PORT = 8765;

function parseArgs(argv) {
  const args = { run: null, port: DEFAULT_PORT, open: true };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--run' && argv[i + 1]) {
      args.run = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--port' && argv[i + 1]) {
      args.port = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--no-open') {
      args.open = false;
    }
  }
  return args;
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

async function main() {
  const args = parseArgs(process.argv);
  const latest = loadLatest();
  const runId = args.run || (latest?.status === 'ready' ? latest.run_id : null);
  await ensureServer(args.port);
  const url = viewerUrl(args.port, runId);

  process.stdout.write(`\nTracker Brief Viewer:\n  ${url}\n`);
  process.stdout.write('\nCursor: Simple Browser → paste URL above (or Cmd+Shift+P → Simple Browser: Show)\n');

  if (args.open && process.platform === 'darwin') {
    try {
      execSync(`open "${url}"`, { stdio: 'ignore' });
      process.stdout.write('open-brief-viewer: opened in default browser.\n');
    } catch {
      process.stdout.write('open-brief-viewer: could not auto-open — use URL above.\n');
    }
  }
}

main().catch((err) => {
  process.stderr.write(`open-brief-viewer: ${err.message}\n`);
  process.exit(1);
});
