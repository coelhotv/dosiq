import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.smoke.test.jsx', 'src/**/*.smoke.test.js'],
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        isolate: false,
      },
    },
    testTimeout: 5000,
    reporters: ['dot'],
  },
})
