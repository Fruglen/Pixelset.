import { parseBlocks, type Block } from "./blocks";

// Night build (Website): share a page or a single block as a portable code
// another Pixora site (or the same one) can import. The code is the JSON
// payload base64url encoded behind a short prefix; blocks are revalidated
// through parseBlocks on import so a tampered code can never inject
// unknown block types or fields.

export interface SharePayload {
  v: 1;
  kind: "page" | "block";
  title?: string;
  blocks?: Block[];
  block?: Block;
}

const PREFIX = "PXS1.";

export function makeShareCode(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const b64 = typeof window === "undefined"
    ? Buffer.from(json, "utf8").toString("base64url")
    : btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return PREFIX + b64;
}

export function parseShareCode(code: string): SharePayload | null {
  const raw = (code ?? "").trim();
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const b64 = raw.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof window === "undefined"
      ? Buffer.from(b64, "base64").toString("utf8")
      : decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(json);
    if (!data || data.v !== 1) return null;
    if (data.kind === "block") {
      if (!data.block || typeof data.block !== "object") return null;
      const clean = parseBlocks(JSON.stringify([data.block]));
      if (clean.length !== 1) return null;
      return { v: 1, kind: "block", block: clean[0] };
    }
    if (data.kind === "page") {
      if (!Array.isArray(data.blocks)) return null;
      const clean = parseBlocks(JSON.stringify(data.blocks));
      return { v: 1, kind: "page", title: String(data.title ?? "Shared page").slice(0, 120), blocks: clean };
    }
    return null;
  } catch {
    return null;
  }
}
