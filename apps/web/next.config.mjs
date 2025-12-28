/** @type {import('next').NextConfig} */
const nextConfig = {
  // Handle monorepo React deduplication
  experimental: {
    optimizePackageImports: ['@clerk/nextjs', 'lucide-react'],
  },
  // Disable static page generation for error pages to avoid React context issues
  output: 'standalone',
};

export default nextConfig;
