import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Utilise vmThreads avec un seul thread pour éviter les problèmes
    // de mémoire (VirtualAlloc) sur Windows avec les workers multiples
    pool: 'vmThreads',
    poolOptions: {
      vmThreads: {
        singleThread: true
      }
    },
    // next/server utilise des exports conditionnels incompatibles avec le contexte VM.
    // On force son inlining pour qu'il soit transpilé dans le même contexte que les tests.
    server: {
      deps: {
        inline: [/next/]
      }
    }
  },
  resolve: {
    alias: {
      '@/lib': resolve(__dirname, './lib'),
      '@/app': resolve(__dirname, './app'),
      '@/components': resolve(__dirname, './components'),
      '@/hooks': resolve(__dirname, './hooks')
    }
  }
});
