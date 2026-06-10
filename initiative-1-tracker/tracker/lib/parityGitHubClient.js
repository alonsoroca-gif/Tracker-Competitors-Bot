/**
 * GitHub REST client for entrata-core parity (read-only).
 * Uses recursive git tree + contents API at a pinned ref (default: main).
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'entrata-core-github.json');

const SOURCE_EXT = /\.(php|phtml|inc|js|cjs|mjs|tsx?|jsx|vue|twig)$/i;

function loadGitHubConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {
      owner: process.env.ENTRATA_CORE_GITHUB_OWNER || '',
      repo: process.env.ENTRATA_CORE_GITHUB_REPO || 'entrata-core',
      default_ref: 'main',
      applications_path: 'Applications',
      api_base: process.env.GITHUB_API_URL || 'https://api.github.com',
    };
  }
}

function resolveToken() {
  return (
    (process.env.ENTRATA_CORE_GITHUB_TOKEN || '').trim() ||
    (process.env.GITHUB_TOKEN || '').trim() ||
    ''
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class ParityGitHubClient {
  constructor(opts = {}) {
    const cfg = { ...loadGitHubConfig(), ...opts };
    this.owner = (cfg.owner || '').trim();
    this.repo = (cfg.repo || 'entrata-core').trim();
    this.ref = (cfg.default_ref || 'main').trim();
    this.applicationsPath = (cfg.applications_path || 'Applications').replace(/\/$/, '');
    this.apiBase = (cfg.api_base || 'https://api.github.com').replace(/\/$/, '');
    this.token = resolveToken();
    this._treeCache = null;
    this._rateLimitRemaining = null;
  }

  configured() {
    return Boolean(this.owner && this.repo && this.token && !this.owner.startsWith('SPONSOR_FILL'));
  }

  missingReason() {
    if (!this.token) return 'ENTRATA_CORE_GITHUB_TOKEN (or GITHUB_TOKEN) is not set';
    if (!this.owner || this.owner.startsWith('SPONSOR_FILL')) {
      return `Set owner in ${CONFIG_PATH} or ENTRATA_CORE_GITHUB_OWNER`;
    }
    return 'GitHub Core config incomplete';
  }

  async request(apiPath, { retries = 2 } = {}) {
    if (!this.configured()) throw new Error(this.missingReason());
    const url = `${this.apiBase}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'tracker-parity-github',
        },
      });
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining != null) this._rateLimitRemaining = Number(remaining);

      if (res.status === 403 && remaining === '0') {
        const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
        const waitMs = Math.max(1000, reset - Date.now() + 1000);
        process.stderr.write(
          `parity-github: rate limit hit — sleeping ${Math.ceil(waitMs / 1000)}s\n`,
        );
        await sleep(Math.min(waitMs, 120000));
        continue;
      }

      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * (attempt + 1));
        lastErr = new Error(`GitHub API ${res.status} for ${apiPath}`);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`GitHub API ${res.status} ${apiPath}: ${body.slice(0, 200)}`);
      }

      return res.json();
    }
    throw lastErr || new Error(`GitHub API failed for ${apiPath}`);
  }

  async fetchRepository() {
    return this.request(`/repos/${this.owner}/${this.repo}`);
  }

  accessDeniedHint() {
    return (
      `Cannot read ${this.owner}/${this.repo} via GitHub API (404). For private org repos this usually means:\n` +
      `  • Fine-grained token still **Pending** org approval for entrata/core — open ` +
      `https://github.com/settings/tokens?type=beta and wait until status is Active\n` +
      `  • Token missing **Contents: Read-only** on entrata/core\n` +
      `  • Wrong owner/repo (expected entrata/core per local clone remote)\n` +
      `GitHub often returns 404 instead of 403 when the token cannot see the repo.`
    );
  }

  async resolveCommitSha() {
    const refPath = `/repos/${this.owner}/${this.repo}/git/ref/heads/${encodeURIComponent(this.ref)}`;
    try {
      const refData = await this.request(refPath);
      return refData.object.sha;
    } catch (err) {
      const is404 = String(err.message).includes('404');
      if (!is404) throw err;

      let repo;
      try {
        repo = await this.fetchRepository();
      } catch (repoErr) {
        if (String(repoErr.message).includes('404')) {
          throw new Error(this.accessDeniedHint());
        }
        throw repoErr;
      }

      const defaultBranch = repo.default_branch;
      if (defaultBranch && defaultBranch !== this.ref) {
        process.stderr.write(
          `parity-github: ref '${this.ref}' not found — retrying default_branch '${defaultBranch}'\n`,
        );
        this.ref = defaultBranch;
        const refData = await this.request(
          `/repos/${this.owner}/${this.repo}/git/ref/heads/${encodeURIComponent(this.ref)}`,
        );
        return refData.object.sha;
      }

      throw new Error(
        `Branch '${this.ref}' not found on ${this.owner}/${this.repo}` +
          (defaultBranch ? ` (GitHub default_branch: ${defaultBranch})` : ''),
      );
    }
  }

  /** Full recursive tree for ref — cached per client instance (one parity batch). */
  async getRecursiveTree() {
    if (this._treeCache) return this._treeCache;
    const sha = await this.resolveCommitSha();
    const data = await this.request(
      `/repos/${this.owner}/${this.repo}/git/trees/${sha}?recursive=1`,
    );
    this._treeCache = (data.tree || []).filter((e) => e.type === 'blob');
    process.stderr.write(
      `parity-github: tree @ ${this.ref} — ${this._treeCache.length} blobs (rate remaining: ${this._rateLimitRemaining ?? '?'})\n`,
    );
    return this._treeCache;
  }

  listApplicationNames(tree) {
    const prefix = `${this.applicationsPath}/`;
    const names = new Set();
    for (const e of tree) {
      if (!e.path.startsWith(prefix)) continue;
      const seg = e.path.slice(prefix.length).split('/')[0];
      if (seg) names.add(seg);
    }
    return [...names].sort().map((name) => ({
      name,
      prefix: `${prefix}${name}`,
    }));
  }

  /**
   * Virtual walk: filter tree blobs under app prefix (depth, ext, skip dirs).
   */
  selectAppFilePaths(tree, appPrefix, opts = {}) {
    const maxDepth = opts.maxDepth ?? 8;
    const maxFiles = opts.maxFiles ?? 600;
    const skipDirs = opts.skipDirs || new Set([
      'node_modules', 'vendor', '.git', 'cache', 'tmp', 'temp', 'logs',
      'coverage', 'dist', 'build', '.next', 'Library', 'bower_components',
    ]);
    const relPrefix = appPrefix.endsWith('/') ? appPrefix : `${appPrefix}/`;
    const candidates = [];

    for (const e of tree) {
      const p = e.path;
      if (!p.startsWith(relPrefix)) continue;
      if (!SOURCE_EXT.test(p)) continue;
      const rel = p.slice(relPrefix.length);
      const parts = rel.split('/');
      if (parts.some((seg) => skipDirs.has(seg))) continue;
      const depth = parts.length - 1;
      if (depth > maxDepth) continue;
      candidates.push({ path: p, relativePath: rel, size: e.size || 0 });
    }

    candidates.sort((a, b) => a.path.localeCompare(b.path));
    return candidates.slice(0, maxFiles);
  }

  async fetchFileContent(filePath) {
    const data = await this.request(
      `/repos/${this.owner}/${this.repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(this.ref)}`,
    );
    if (data.encoding !== 'base64' || !data.content) {
      throw new Error(`Unexpected content encoding for ${filePath}`);
    }
    const buf = Buffer.from(data.content.replace(/\n/g, ''), 'base64');
    return buf.toString('utf8');
  }

  async fetchFilesBatch(paths, batchSize = 8) {
    const out = new Map();
    for (let i = 0; i < paths.length; i += batchSize) {
      const chunk = paths.slice(i, i + batchSize);
      const results = await Promise.all(
        chunk.map(async (p) => {
          try {
            const content = await this.fetchFileContent(p);
            return { path: p, content };
          } catch (e) {
            return { path: p, error: e.message };
          }
        }),
      );
      for (const r of results) {
        if (r.content != null) out.set(r.path, r.content);
      }
      if (this._rateLimitRemaining != null && this._rateLimitRemaining < 100) {
        process.stderr.write(
          `parity-github: WARN low rate limit (${this._rateLimitRemaining}) — pausing 2s\n`,
        );
        await sleep(2000);
      }
    }
    return out;
  }

  blobUrl(filePath) {
    return `https://github.com/${this.owner}/${this.repo}/blob/${this.ref}/${filePath}`;
  }
}

module.exports = {
  ParityGitHubClient,
  loadGitHubConfig,
  resolveToken,
  SOURCE_EXT,
};
