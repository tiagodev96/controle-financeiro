import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: false,
    // Integração compartilha o mesmo Supabase local (um household por teste).
    // Paralelismo entre arquivos vira race: A trunca enquanto B insere. Único
    // workaround robusto sem reescrever tudo com household isolado é serializar.
    fileParallelism: false,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'tests/integration/**/*.test.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/app/**',
        'src/types/**',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        // Adapters de infra: o client/server do Supabase são chamadas diretas
        // ao SDK sem lógica de domínio. Testá-los exigiria duplicar o SDK em
        // mocks; cobertura efetiva vem dos testes de integração.
        'src/lib/supabase/**',
        // cn() helper do shadcn — wrapper de clsx+tailwind-merge, sem lógica.
        'src/lib/utils.ts',
      ],
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        'src/lib/**/*.{ts,tsx}': {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
