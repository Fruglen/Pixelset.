import { Fragment } from "react";

// Phase 5B: per-word colour. Text fields accept inline colour markup:
//   [color=accent]words[/color]  (palette roles: accent, subtle, text, muted)
//   [color=#b06a45]words[/color] (any hex colour)
// The block editor wraps the selected words for you.
const RE = /\[color=(#[0-9a-fA-F]{3,8}|accent|subtle|text|muted)\]([\s\S]*?)\[\/color\]/g;

export function colorValue(c: string): string {
  return c.startsWith("#") ? c : `var(--s-${c === "text" ? "text" : c})`;
}

export function rt(text: string): React.ReactNode {
  if (!text || !text.includes("[color=")) return text;
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of Array.from(text.matchAll(RE))) {
    const at = m.index ?? 0;
    if (at > last) out.push(<Fragment key={i++}>{text.slice(last, at)}</Fragment>);
    out.push(
      <span key={i++} style={{ color: colorValue(m[1]) }}>
        {m[2]}
      </span>
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  return out;
}

// Strip the markup (for alt text, titles, summaries).
export function plain(text: string): string {
  return (text || "").replace(RE, "$2");
}
