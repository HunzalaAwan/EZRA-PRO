import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `next dev` and `next build` both write to `.next`, so a verification build
  // made while the dev server is running clobbers it (and vice versa). Point a
  // production build elsewhere with NEXT_DIST_DIR=.next-prod for both build and start.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Serve AVIF/WebP to browsers that accept them — the Unsplash activity
    // photography is the heaviest asset class on the storefront and catalog.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
    ],
  },
}

export default nextConfig
