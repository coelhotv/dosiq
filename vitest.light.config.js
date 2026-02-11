import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    exclude: [
      '**/*.smoke.test.{js,jsx}',
      '**/*.integration.test.{js,jsx}',
      'src/components/**/*.test.{js,jsx}'
    ],
    pool: 'forks',
    maxWorkers: 2,
    testTimeout: 5000,
    reporters: ['dot'],
    coverage: { enabled: false },
  },
})
