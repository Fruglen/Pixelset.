// Phase 5B: live Instagram feed for the website Instagram block.
// Uses the Instagram Graph API (graph.instagram.com, the successor of Basic
// Display) with a long-lived access token. The token comes from the website's
// Settings (account setting) or the INSTAGRAM_ACCESS_TOKEN env var. When no
// token is configured the block falls back to hand-picked images and the
// dashboard says "Not connected". Tokens are never logged or sent to clients.

export interface InstagramPost {
  id: string;
  imageUrl: string;
  permalink: string;
  caption: string;
  mediaType: string;
  timestamp: string;
}

export interface InstagramFeed {
  connected: boolean;
  username: string;
  posts: InstagramPost[];
  error: string;
}

const GRAPH = "https://graph.instagram.com";
const cache = new Map<string, { exp: number; feed: InstagramFeed }>();

export function instagramTokenFor(website: { instagramToken?: string | null }): string {
  return (website.instagramToken || process.env.INSTAGRAM_ACCESS_TOKEN || "").trim();
}

export function instagramSource(website: { instagramToken?: string | null }): "settings" | "env" | "none" {
  if ((website.instagramToken || "").trim()) return "settings";
  if ((process.env.INSTAGRAM_ACCESS_TOKEN || "").trim()) return "env";
  return "none";
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (data.error as { message?: string } | undefined)?.message ?? `Instagram returned ${res.status}`;
    throw new Error(err);
  }
  return data;
}

export async function fetchInstagramFeed(token: string, limit = 12): Promise<InstagramFeed> {
  if (!token) return { connected: false, username: "", posts: [], error: "" };
  const key = `${token.slice(-12)}:${limit}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.feed;
  try {
    const t = encodeURIComponent(token);
    const me = await getJson(`${GRAPH}/me?fields=id,username&access_token=${t}`);
    const media = await getJson(
      `${GRAPH}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${t}`
    );
    const rows = Array.isArray(media.data) ? (media.data as Record<string, unknown>[]) : [];
    const posts: InstagramPost[] = rows
      .map((m) => ({
        id: String(m.id ?? ""),
        imageUrl: String((m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? ""),
        permalink: String(m.permalink ?? ""),
        caption: String(m.caption ?? ""),
        mediaType: String(m.media_type ?? "IMAGE"),
        timestamp: String(m.timestamp ?? ""),
      }))
      .filter((p) => p.imageUrl);
    const feed = { connected: true, username: String(me.username ?? ""), posts, error: "" };
    cache.set(key, { exp: Date.now() + 15 * 60_000, feed });
    return feed;
  } catch (e) {
    const feed = { connected: false, username: "", posts: [], error: e instanceof Error ? e.message : "Instagram request failed" };
    cache.set(key, { exp: Date.now() + 60_000, feed });
    return feed;
  }
}
