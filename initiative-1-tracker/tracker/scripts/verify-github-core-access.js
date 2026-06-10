#!/usr/bin/env node
/**
 * Smoke test — read-only access to entrata-core on GitHub @ main.
 *
 * Usage:
 *   ENTRATA_CORE_GITHUB_TOKEN=ghp_... node scripts/verify-github-core-access.js
 *   node scripts/verify-github-core-access.js --json
 *
 * Exit 0 = OK · 2 = not configured or API failed
 */

const { ParityGitHubClient, resolveToken } = require('../lib/parityGitHubClient.js');

async function main() {
  const jsonOut = process.argv.includes('--json');
  const client = new ParityGitHubClient();

  const payload = {
    ok: false,
    owner: client.owner,
    repo: client.repo,
    ref: client.ref,
    api_base: client.apiBase,
    token_present: Boolean(resolveToken()),
    message: '',
  };

  if (!client.configured()) {
    payload.message = client.missingReason();
    if (jsonOut) {
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } else {
      process.stderr.write(`verify-github-core-access: FAIL — ${payload.message}\n`);
      process.stderr.write(
        'Steps:\n' +
          '  1. GitHub → Settings → Developer settings → Fine-grained token\n' +
          '  2. Repository access: entrata/core, Contents: Read-only\n' +
          '  3. export ENTRATA_CORE_GITHUB_TOKEN=...\n' +
          '  4. Set owner in config/entrata-core-github.json\n',
      );
    }
    process.exit(2);
  }

  try {
    let repoMeta;
    try {
      repoMeta = await client.fetchRepository();
      payload.default_branch = repoMeta.default_branch;
      payload.repo_private = repoMeta.private;
      if (!jsonOut) {
        process.stderr.write(
          `verify-github-core-access: repo OK — ${client.owner}/${client.repo} ` +
            `(private=${repoMeta.private}, default_branch=${repoMeta.default_branch})\n`,
        );
      }
    } catch (repoErr) {
      if (String(repoErr.message).includes('404')) {
        throw new Error(client.accessDeniedHint());
      }
      throw repoErr;
    }

    const sha = await client.resolveCommitSha();
    const tree = await client.getRecursiveTree();
    const apps = client.listApplicationNames(tree);
    payload.ok = true;
    payload.commit_sha = sha.slice(0, 12);
    payload.blob_count = tree.length;
    payload.app_count = apps.length;
    payload.sample_apps = apps.slice(0, 8).map((a) => a.name);
    payload.message = `GitHub Core ready: ${client.owner}/${client.repo}@${client.ref} (${apps.length} apps, ${tree.length} blobs)`;

    if (jsonOut) {
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } else {
      process.stdout.write(`verify-github-core-access: OK — ${payload.message}\n`);
      process.stdout.write(`verify-github-core-access: apps sample → ${payload.sample_apps.join(', ')}\n`);
      process.stdout.write(
        'verify-github-core-access: Parity uses tree list + selective file fetch (always latest main).\n',
      );
    }
    process.exit(0);
  } catch (err) {
    payload.message = err.message;
    if (jsonOut) {
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } else {
      process.stderr.write(`verify-github-core-access: FAIL — ${err.message}\n`);
    }
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
