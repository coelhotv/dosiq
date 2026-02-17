import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.smoke.test.{js,jsx}'],
    
    // Vitest 4+ API (removed deprecated poolOptions.threads)
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    
    testTimeout: 5000,
    reporters: ['dot'],
  },
})
