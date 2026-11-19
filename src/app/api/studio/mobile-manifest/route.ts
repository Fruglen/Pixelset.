import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { brandFor } from "@/lib/brand";

// Night build: web app manifest for the Studio Manager mobile app. The icon
// and colours come from the photographer's own brand settings.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brand = await brandFor(user.id).catch(() => null);
  const name = user.businessName || user.name || "Studio";
  return NextResponse.json(
    {
      name: `${name} Studio`,
      short_name: "Studio",
      description: "Bookings, invoices, contracts and clients for your studio.",
      start_url: "/studio/app",
      scope: "/studio",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: brand?.accent || "#111111",
      icons: brand?.logoUrl
        ? [{ src: brand.logoUrl, sizes: "512x512", type: "image/png", purpose: "any" }]
        : [{ src: "/favicon.ico", sizes: "64x64", type: "image/x-icon", purpose: "any" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
