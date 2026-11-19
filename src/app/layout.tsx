import type { Metadata } from "next";
import "./globals.css";
import { PIXORA_ICON } from "@/lib/brand-assets";

// Webfonts (Nunito Sans product sans; EB Garamond / Bodoni Moda / Dancing
// Script for gallery + website display) load from Google Fonts: the repo's
// push path is text-only, so self-hosted woff2 files cannot ship (yet).
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700;6..12,800&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500;6..96,600;6..96,700&family=Dancing+Script:wght@400;600;700&display=swap";

export const metadata: Metadata = {
  title: "Pixora",
  description: "Client galleries, websites and studio tools for photographers.",
  icons: {
    icon: PIXORA_ICON,
    apple: PIXORA_ICON,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONTS_HREF} rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
