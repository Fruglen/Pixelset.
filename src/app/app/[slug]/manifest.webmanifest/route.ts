import { NextResponse } from "next/server";
import { resolveMobileApp } from "@/lib/mobile-app";

// Per-collection web-app manifest, makes /app/[slug] installable with the
// collection cover as the app icon.
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const resolved = await resolveMobileApp(params.slug);
  const app = resolved?.app;
  if (!app || !app.enabled) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(
    {
      name: app.appName,
      short_name: app.appName.length > 12 ? app.appName.slice(0, 12).trimEnd() : app.appName,
      // Phase 5B: per client installs open their own personalised page
      id: `/app/${params.slug}`,
      start_url: `/app/${params.slug}`,
      scope: `/`,
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: app.accentColor,
      icons: [
        { src: `/api/app-icon/${app.slug}?size=192`, sizes: "192x192", type: "image/png" },
        { src: `/api/app-icon/${app.slug}?size=512`, sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
