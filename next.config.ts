import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'sonner', '@base-ui/react'],
  },
};

export default nextConfig;
