#!/usr/bin/env node
/**
 * One-time install of the local Tracker Brief Opener extension into Cursor.
 * Installs from a bundled .vsix (Cursor cannot install from a folder path).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EXT_ID = 'entrata.tracker-brief-opener';
const trackerRoot = path.join(__dirname, '..');
const vsixPath = path.join(trackerRoot, 'extensions', 'tracker-brief-opener-1.0.0.vsix');
const extSourceDir = path.join(trackerRoot, 'extensions', 'tracker-brief-opener');

function findCursorBin() {
  const candidates = [
    process.env.CURSOR_BIN,
    '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
  ].filter(Boolean);
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  return 'cursor';
}

function ensureVsix() {
  if (fs.existsSync(vsixPath)) return vsixPath;

  process.stdout.write('install-brief-opener: bundling .vsix from source (first time)…\n');
  if (!fs.existsSync(path.join(extSourceDir, 'package.json'))) {
    throw new Error(`missing extension source at ${extSourceDir}`);
  }

  const stage = path.join(os.tmpdir(), 'tracker-brief-opener-pack');
  fs.rmSync(stage, { recursive: true, force: true });
  fs.cpSync(extSourceDir, stage, { recursive: true });

  execSync('npx -y @vscode/vsce package --no-dependencies --allow-missing-repository', {
    cwd: stage,
    stdio: 'inherit',
  });

  const built = fs.readdirSync(stage).find((f) => f.endsWith('.vsix'));
  if (!built) throw new Error('vsce did not produce a .vsix');
  fs.copyFileSync(path.join(stage, built), vsixPath);
  return vsixPath;
}

function main() {
  const cursorBin = findCursorBin();
  const vsix = ensureVsix();

  process.stdout.write(`install-brief-opener: using ${cursorBin}\n`);
  process.stdout.write(`install-brief-opener: installing ${EXT_ID} from ${vsix}\n`);

  execSync(`"${cursorBin}" --install-extension "${vsix}" --force`, { stdio: 'inherit' });

  const listed = execSync(`"${cursorBin}" --list-extensions`, { encoding: 'utf8' });
  if (!listed.includes(EXT_ID)) {
    process.stderr.write(`install-brief-opener: install finished but ${EXT_ID} not listed — reload Cursor and retry.\n`);
    process.exit(1);
  }

  process.stdout.write(`install-brief-opener: OK — ${EXT_ID} installed.\n`);
  process.stdout.write('  Reload Cursor (Cmd+Shift+P → "Developer: Reload Window") if Simple Browser does not open yet.\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(`install-brief-opener: ${err.message}\n`);
  process.exit(1);
}
