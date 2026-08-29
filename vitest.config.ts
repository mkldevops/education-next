import path from 'node:path'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

// Les tests d'isolation multi-écoles tapent une vraie base. En CI `DATABASE_URL`
// vient du service postgres ; en local il vient du `.env`. `dotenv` n'écrase pas
// une variable déjà présente, l'environnement reste prioritaire.
config({ quiet: true })

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@peaklab/ui': path.resolve(__dirname, './src/components/ui'),
      '@': path.resolve(__dirname, './src'),
    },
  },
})
