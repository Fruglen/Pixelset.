import { NextRequest, NextResponse } from "next/server";

// Local SVG placeholder imagery for website templates. Works offline; the
// photographer replaces these with their own image URLs or gallery photos.

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const w = Math.min(2400, Math.max(80, parseInt(q.get("w") ?? "1600", 10) || 1600));
  const h = Math.min(2400, Math.max(80, parseInt(q.get("h") ?? "1067", 10) || 1067));
  const hue = ((parseInt(q.get("hue") ?? "32", 10) || 0) % 360 + 360) % 360;
  const label = (q.get("label") ?? "").slice(0, 40);
  const variant = q.get("variant") ?? "photo";

  const r = Math.min(w, h);
  const c1 = `hsl(${hue}, 30%, 76%)`;
  const c2 = `hsl(${(hue + 40) % 360}, 34%, 34%)`;
  const c3 = `hsl(${(hue + 190) % 360}, 24%, 88%)`;
  const c4 = `hsl(${(hue + 20) % 360}, 40%, 55%)`;

  let shapes = "";
  if (variant === "portrait") {
    shapes = `
      <circle cx="${w / 2}" cy="${h * 0.38}" r="${r * 0.16}" fill="${c3}" opacity="0.85"/>
      <path d="M ${w / 2 - r * 0.3} ${h} Q ${w / 2} ${h * 0.52} ${w / 2 + r * 0.3} ${h} Z" fill="${c3}" opacity="0.75"/>`;
  } else if (variant === "detail") {
    shapes = `
      <rect x="${w * 0.18}" y="${h * 0.22}" width="${w * 0.64}" height="${h * 0.56}" fill="none" stroke="${c3}" stroke-width="${r * 0.012}" opacity="0.8"/>
      <circle cx="${w * 0.5}" cy="${h * 0.5}" r="${r * 0.12}" fill="${c4}" opacity="0.5"/>`;
  } else if (variant === "landscape") {
    shapes = `
      <path d="M0 ${h * 0.72} L ${w * 0.3} ${h * 0.4} L ${w * 0.55} ${h * 0.66} L ${w * 0.78} ${h * 0.34} L ${w} ${h * 0.6} L ${w} ${h} L 0 ${h} Z" fill="${c2}" opacity="0.55"/>
      <circle cx="${w * 0.72}" cy="${h * 0.22}" r="${r * 0.09}" fill="${c3}" opacity="0.9"/>`;
  } else {
    shapes = `
      <circle cx="${w * 0.72}" cy="${h * 0.26}" r="${r * 0.17}" fill="${c3}" opacity="0.55"/>
      <circle cx="${w * 0.22}" cy="${h * 0.74}" r="${r * 0.27}" fill="${c2}" opacity="0.35"/>
      <rect x="${w * 0.08}" y="${h * 0.08}" width="${w * 0.84}" height="${h * 0.84}" fill="none" stroke="${c3}" stroke-width="${r * 0.004}" opacity="0.5"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${shapes}
  ${label ? `<text x="50%" y="52%" font-family="Georgia, serif" font-size="${r * 0.055}" fill="rgba(255,255,255,0.92)" text-anchor="middle" letter-spacing="2">${esc(label)}</text>` : ""}
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
