import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    exclude: ['node_modules', 'e2e/**'],
    setupFiles: ['./src/__tests__/setup.ts'],
    server: {
      deps: {
        inline: ['ai', '@openrouter/ai-sdk-provider', '@ai-sdk/provider-utils'],
      },
    },
  },
})
