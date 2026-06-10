const vscode = require('vscode');

/** @param {string | undefined} raw */
async function openInSimpleBrowser(raw) {
  const url = raw?.trim();
  if (!url) return;
  await vscode.commands.executeCommand('simpleBrowser.show', url);
}

/** @param {import('vscode').ExtensionContext} context */
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('entrata.tracker-brief-opener.open', (url) => openInSimpleBrowser(url)),
  );

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri) {
        const params = new URLSearchParams(uri.query);
        const url = params.get('url');
        if (url) return openInSimpleBrowser(decodeURIComponent(url));
        return undefined;
      },
    }),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
