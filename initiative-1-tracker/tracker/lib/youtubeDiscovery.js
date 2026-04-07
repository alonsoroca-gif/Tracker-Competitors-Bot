/**
 * YouTube Data API v3 — discover third-party / review-style videos (search.list + videos.list).
 * Quota: search.list ≈ 100 units/request; videos.list ≈ 1 unit per request (up to 50 ids).
 * Env: YOUTUBE_DATA_API_KEY (optional — on standby until key; collect skips when unset)
 * @see ../docs/YOUTUBE-REVIEWS-PROTOTYPE.md
 */

const DEFAULT_TIMEOUT_MS = 20000;
const API_BASE = 'https://www.googleapis.com/youtube/v3';

function ytGet(url, apiKey) {
  const u = new URL(url);
  u.searchParams.set('key', apiKey);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  return fetch(u.toString(), { signal: controller.signal })
    .then(async (res) => {
      const text = await res.text();
      if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}: ${text.slice(0, 280)}`);
      return JSON.parse(text);
    })
    .finally(() => clearTimeout(t));
}

/**
 * @param {string} apiKey
 * @param {string} query
 * @param {{ maxResults?: number, publishedAfter?: string }} opts  publishedAfter ISO8601 optional
 * @returns {Promise<Array<{ videoId: string, title: string, description: string, channelTitle: string, publishedAt: string }>>}
 */
async function searchYouTubeVideos(apiKey, query, { maxResults = 10, publishedAfter } = {}) {
  const key = String(apiKey || '').trim();
  const q = String(query || '').trim();
  if (!key || !q) return [];

  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', q);
  url.searchParams.set('maxResults', String(Math.min(50, Math.max(1, maxResults))));
  /** Prefer recent review uploads; API still ranks by relevance inside window. */
  url.searchParams.set('order', 'date');
  if (publishedAfter) url.searchParams.set('publishedAfter', publishedAfter);

  const data = await ytGet(url.toString(), key);
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .map((row) => {
      const id = row.id?.videoId;
      const sn = row.snippet;
      if (!id || !sn) return null;
      return {
        videoId: id,
        title: String(sn.title || '').trim(),
        description: String(sn.description || '').replace(/\s+/g, ' ').trim(),
        channelTitle: String(sn.channelTitle || '').trim(),
        publishedAt: String(sn.publishedAt || '').slice(0, 10),
      };
    })
    .filter(Boolean);
}

/**
 * Enrich with duration (ISO 8601) and view count.
 * @param {string} apiKey
 * @param {string[]} videoIds max 50 per call; caller may chunk
 * @returns {Promise<Map<string, { duration: string|null, viewCount: string|null }>>}
 */
async function listVideoDetails(apiKey, videoIds) {
  const key = String(apiKey || '').trim();
  const ids = [...new Set((videoIds || []).filter(Boolean))].slice(0, 50);
  if (!key || !ids.length) return new Map();

  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set('part', 'snippet,contentDetails,statistics');
  url.searchParams.set('id', ids.join(','));

  const data = await ytGet(url.toString(), key);
  const items = Array.isArray(data.items) ? data.items : [];
  const map = new Map();
  for (const row of items) {
    const id = row.id;
    if (!id) continue;
    map.set(id, {
      duration: row.contentDetails?.duration || null,
      viewCount: row.statistics?.viewCount != null ? String(row.statistics.viewCount) : null,
    });
  }
  return map;
}

module.exports = { searchYouTubeVideos, listVideoDetails };
