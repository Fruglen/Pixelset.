/** @type {import('next').NextConfig} */
const nextConfig = {
  // Parallel dev servers can isolate their build output (default stays .next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  experimental: {
    serverComponentsExternalPackages: ["sharp"],
  },
};

export default nextConfig;
