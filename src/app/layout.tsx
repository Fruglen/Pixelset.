import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pixelset",
  description: "Client galleries, websites and studio management for photographers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
