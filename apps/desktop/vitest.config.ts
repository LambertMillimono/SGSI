import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['out/**', 'node_modules/**'],
    environment: 'node',
    globals: false,
    alias: {
      '@sgsi/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@sgsi/db': path.resolve(__dirname, '../../packages/db/src/client.ts'),
    },
  },
  resolve: {
    alias: {
      '@sgsi/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@sgsi/db': path.resolve(__dirname, '../../packages/db/src/client.ts'),
    },
  },
})
