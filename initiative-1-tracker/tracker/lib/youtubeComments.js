/**
 * Prototype: top-level YouTube comments via Data API v3 (official, quota-based).
 * Env: YOUTUBE_DATA_API_KEY (optional — on standby until key; collect skips when unset)
 * @see ../docs/YOUTUBE-REVIEWS-PROTOTYPE.md
 */

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * @param {string} videoId 11-char YouTube video id
 * @param {string} apiKey
 * @param {{ maxResults?: number }} opts
 * @returns {Promise<Array<{ text: string, author: string, publishedAt: string, likeCount: number }>>}
 */
async function fetchYouTubeCommentThreads(videoId, apiKey, { maxResults = 15 } = {}) {
  const id = String(videoId || '').trim();
  const key = String(apiKey || '').trim();
  if (!id || !key) return [];

  const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('videoId', id);
  url.searchParams.set('maxResults', String(Math.min(100, Math.max(1, maxResults))));
  url.searchParams.set('textFormat', 'plainText');
  url.searchParams.set('key', key);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`YouTube API HTTP ${res.status}: ${body.slice(0, 240)}`);
    }
    const data = JSON.parse(body);
    const items = Array.isArray(data.items) ? data.items : [];
    return items
      .map((row) => {
        const top = row.snippet?.topLevelComment?.snippet;
        if (!top) return null;
        const text = String(top.textDisplay || top.textOriginal || '').replace(/\s+/g, ' ').trim();
        return {
          text,
          author: String(top.authorDisplayName || '').trim(),
          publishedAt: String(top.publishedAt || '').slice(0, 10),
          likeCount: Number(top.likeCount) || 0,
        };
      })
      .filter((x) => x && x.text.length >= 8);
  } finally {
    clearTimeout(t);
  }
}

module.exports = { fetchYouTubeCommentThreads };
