const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');

// Diagnostic breadcrumb. open-brief-viewer.js / a human can read this to confirm
// the request actually reached the extension — the old silent failure gave no signal.
const LOG_PATH = path.join(os.homedir(), '.tracker-brief-opener.log');

// Home-dir request file (legacy path — written by the opener when it runs OUTSIDE
// the agent sandbox). Kept for backward compatibility.
const HOME_REQUEST_PATH = path.join(os.homedir(), '.tracker-brief-open-request.json');

// Workspace-relative request file name. The agent sandbox permits workspace writes
// but NOT home-dir writes, so the sandboxed daily brief writes THIS file instead.
// Watching it here (extension host runs outside the sandbox) is what makes
// zero-approval auto-open work from a sandboxed morningbrief run.
const WS_REQUEST_REL = path.join('tracker-briefs', '.open-request.json');

const VIEWER_PORT = 8765;
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function log(msg) {
  try {
    fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* logging is best-effort */
  }
}

/** The workspace folder that contains tracker-briefs/ is the repo root + server root. */
function findRepoRoot() {
  const folders = vscode.workspace.workspaceFolders || [];
  for (const f of folders) {
    const root = f.uri.fsPath;
    if (fs.existsSync(path.join(root, 'tracker-briefs'))) return root;
  }
  return null;
}

/**
 * Minimal read-only static file server rooted at the repo. Owned by the extension
 * host (outside the agent sandbox) so the viewer is reachable even when the daily
 * brief runs sandboxed and cannot bind a port itself. Localhost-only; path-traversal
 * guarded. No-ops if the port is already served (e.g. python http.server).
 */
let server = null;
function startServer(root) {
  if (server) return;
  const srv = http.createServer((req, res) => {
    try {
      let rel = decodeURIComponent((req.url || '/').split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const abs = path.join(root, rel);
      // Traversal guard: resolved path must stay within root.
      if (!abs.startsWith(root + path.sep) && abs !== root) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(abs, (err, buf) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
        res.end(buf);
      });
    } catch (e) {
      res.writeHead(500);
      res.end('error');
    }
  });
  srv.on('error', (err) => {
    // EADDRINUSE = another server (python/opener) already serves this port — fine.
    if (err && err.code === 'EADDRINUSE') {
      log(`server port ${VIEWER_PORT} already in use — reusing external server`);
    } else {
      log(`server error ${err && err.message}`);
    }
    server = null;
  });
  srv.listen(VIEWER_PORT, '127.0.0.1', () => {
    log(`server listening on 127.0.0.1:${VIEWER_PORT} root=${root}`);
  });
  server = srv;
}

/** @param {string | undefined} raw */
async function openInSimpleBrowser(raw) {
  const url = raw?.trim();
  if (!url) {
    log('open called with empty url');
    return;
  }
  try {
    await vscode.commands.executeCommand('simpleBrowser.show', url);
    log(`simpleBrowser.show OK ${url}`);
  } catch (err) {
    // Simple Browser command can be unavailable/late in some Cursor builds.
    // Fall back to the external browser so the brief always opens.
    log(`simpleBrowser.show FAILED (${err?.message}) — opening externally`);
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }
}

/** Read a request file and open its URL if it carries a new timestamp. */
const lastHandledTs = {};
function handleRequestFile(reqPath) {
  try {
    const req = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
    if (req && req.url && req.ts && req.ts !== lastHandledTs[reqPath]) {
      lastHandledTs[reqPath] = req.ts;
      log(`request file ${reqPath} ${req.ts}`);
      openInSimpleBrowser(req.url);
    }
  } catch {
    /* file absent or mid-write — next tick retries */
  }
}

/** Seed the handled-ts so a reload doesn't replay a stale request. */
function seedTs(reqPath) {
  try {
    const seed = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
    if (seed && seed.ts) lastHandledTs[reqPath] = seed.ts;
  } catch {
    /* no prior request */
  }
}

function watch(reqPath) {
  seedTs(reqPath);
  fs.watchFile(reqPath, { interval: 1000 }, () => handleRequestFile(reqPath));
  return { dispose: () => fs.unwatchFile(reqPath) };
}

/** @param {import('vscode').ExtensionContext} context */
function activate(context) {
  log('activate');

  context.subscriptions.push(
    vscode.commands.registerCommand('entrata.tracker-brief-opener.open', (url) =>
      openInSimpleBrowser(url),
    ),
  );

  // Own the static server so the viewer is reachable even when the sandboxed brief
  // can't bind a port. Best-effort: no-ops if a server is already up or no repo found.
  const repoRoot = findRepoRoot();
  if (repoRoot) {
    startServer(repoRoot);
    // Primary (sandbox-safe) path: workspace request file the sandboxed agent can write.
    context.subscriptions.push(watch(path.join(repoRoot, WS_REQUEST_REL)));
  } else {
    log('no workspace folder with tracker-briefs/ — server + workspace watch skipped');
  }

  // Legacy path: home-dir request file (opener runs outside the sandbox).
  context.subscriptions.push(watch(HOME_REQUEST_PATH));

  // Secondary: keep the URI handler for contexts where cursor:// routing works.
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri) {
        log(`handleUri ${uri.toString()}`);
        const url = new URLSearchParams(uri.query).get('url');
        // URLSearchParams already decodes once; no second decodeURIComponent.
        if (url) return openInSimpleBrowser(url);
        return undefined;
      },
    }),
  );
}

function deactivate() {
  if (server) {
    try {
      server.close();
    } catch {
      /* ignore */
    }
    server = null;
  }
}

module.exports = { activate, deactivate };
