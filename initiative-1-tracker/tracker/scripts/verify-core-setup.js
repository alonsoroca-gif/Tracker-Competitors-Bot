#!/usr/bin/env node
/**
 * Local Entrata Core preflight (disk clone — no GitHub token).
 *
 * Usage:
 *   node scripts/verify-core-setup.js
 *   node scripts/verify-core-setup.js --json
 *
 * Exit 0 = Core found · 2 = not found
 */

const fs = require('fs');
const path = require('path');

const { resolveCoreRoot } = require('./core-parity-check.js');

function main() {
  const jsonOut = process.argv.includes('--json');
  const { root, applicationsDir, source, reason, tried } = resolveCoreRoot();

  const payload = {
    ok: Boolean(root),
    core_root: root || null,
    applications_dir: applicationsDir || null,
    source: source || null,
    message: '',
    tried_paths: tried || [],
  };

  if (root) {
    const apps = fs.readdirSync(applicationsDir).filter((n) => {
      try {
        return fs.statSync(path.join(applicationsDir, n)).isDirectory();
      } catch {
        return false;
      }
    });
    payload.app_count = apps.length;
    payload.sample_apps = apps.slice(0, 6);
    payload.message = `Local Core OK: ${root} (${apps.length} apps via ${source})`;
    if (jsonOut) {
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } else {
      process.stdout.write(`verify-core-setup: OK — ${payload.message}\n`);
      process.stdout.write(`verify-core-setup: sample → ${payload.sample_apps.join(', ')}\n`);
      process.stdout.write('verify-core-setup: Use core-parity-check.js without --github for Layer 1.\n');
    }
    process.exit(0);
  }

  payload.message = reason;
  if (jsonOut) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  } else {
    process.stderr.write(`verify-core-setup: FAIL — ${reason}\n`);
    process.stderr.write('Tried:\n');
    for (const p of tried || []) process.stderr.write(`  - ${p}\n`);
    process.stderr.write(
      'Fix: clone entrata-core, then:\n' +
        '  node scripts/core-parity-check.js --save-core /path/to/entrata-core\n',
    );
  }
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = { main };
