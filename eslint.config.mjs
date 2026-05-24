import nextConfig from 'eslint-config-next';

const config = [
  ...nextConfig,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'supabase/.branches/**',
      'supabase/.temp/**',
      'src/types/database.ts',
    ],
  },
];

export default config;
