/** @type {import('next').NextConfig} */
const nextConfig = {
  // Handle monorepo React deduplication
  experimental: {
    optimizePackageImports: ['@clerk/nextjs', 'lucide-react'],
  },
  // Disable static page generation for error pages to avoid React context issues
  output: 'standalone',
  // Allow external images from course websites and image CDNs
  images: {
    remotePatterns: [
      // Course websites
      { protocol: 'https', hostname: 'arcadiabluffs.com' },
      { protocol: 'https', hostname: 'www.desertmountain.com' },
      { protocol: 'https', hostname: 'www.egyptvalley.com' },
      { protocol: 'https', hostname: 'www.cascadehillscc.com' },
      { protocol: 'https', hostname: 'dhgc.org' },
      { protocol: 'https', hostname: 'highpointegolf.com' },
      { protocol: 'https', hostname: 'www.kingsleyclub.com' },
      { protocol: 'https', hostname: 'images.squarespace-cdn.com' },
      { protocol: 'https', hostname: 'www.interlachencc.org' },
      // Image CDNs for game hero images
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i0.wp.com' },
    ],
  },
};

export default nextConfig;
