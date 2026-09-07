import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Libs de parse de xlsx usadas so em Server Action; fora do bundle do Turbopack.
  serverExternalPackages: ['exceljs', 'officecrypto-tool'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'sonner', '@base-ui/react'],
  },
};

export default nextConfig;
