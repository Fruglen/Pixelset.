/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  experimental: {
    serverComponentsExternalPackages: ["sharp"],
  },
};

export default nextConfig;
