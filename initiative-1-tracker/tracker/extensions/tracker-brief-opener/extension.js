const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Diagnostic breadcrumb. open-brief-viewer.js / a human can read this to confirm
// the request actually reached the extension — the old silent failure gave no signal.
const LOG_PATH = path.join(os.homedir(), '.tracker-brief-opener.log');

// Request file the opener writes to. Watched here so we never depend on
// `cursor --open-url` URI routing, which is not delivered to this handler when
// the opener runs from an agent shell / a different window context.
const REQUEST_PATH = path.join(os.homedir(), '.tracker-brief-open-request.json');

function log(msg) {
  try {
    fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* logging is best-effort */
  }
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

/** Read the request file and open its URL if it's a new request. */
let lastHandledTs = 0;
function handleRequestFile() {
  try {
    const req = JSON.parse(fs.readFileSync(REQUEST_PATH, 'utf8'));
    if (req && req.url && req.ts && req.ts !== lastHandledTs) {
      lastHandledTs = req.ts;
      log(`request file ${req.ts}`);
      openInSimpleBrowser(req.url);
    }
  } catch {
    /* file absent or mid-write — next tick retries */
  }
}

/** @param {import('vscode').ExtensionContext} context */
function activate(context) {
  log('activate');

  context.subscriptions.push(
    vscode.commands.registerCommand('entrata.tracker-brief-opener.open', (url) =>
      openInSimpleBrowser(url),
    ),
  );

  // Primary mechanism: watch a request file. fs.watchFile polls, so it works
  // regardless of which window/context wrote the file. Seed lastHandledTs from
  // the current file so we don't replay a stale request on every reload.
  try {
    const seed = JSON.parse(fs.readFileSync(REQUEST_PATH, 'utf8'));
    if (seed && seed.ts) lastHandledTs = seed.ts;
  } catch {
    /* no prior request */
  }
  fs.watchFile(REQUEST_PATH, { interval: 1000 }, () => handleRequestFile());
  context.subscriptions.push({ dispose: () => fs.unwatchFile(REQUEST_PATH) });

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

function deactivate() {}

module.exports = { activate, deactivate };
