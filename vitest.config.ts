import path from 'node:path'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { configDefaults, defineConfig } from 'vitest/config'

// Les tests d'isolation multi-écoles tapent une vraie base. En CI `DATABASE_URL`
// vient du service postgres ; en local il vient du `.env`. `dotenv` n'écrase pas
// une variable déjà présente, l'environnement reste prioritaire.
//
// L'expansion reproduit `dotenv-cli`, par lequel passent `dev`, `start` et `db:seed` :
// sans elle, un `.env` qui compose ses URL (`http://localhost:${PORT}`) livre la
// référence littérale et Better Auth rejette l'URL au chargement.
expand(config({ quiet: true }))

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Depuis Node 25, le `localStorage` natif de Node masque celui de jsdom et vaut
    // `undefined` sans `--localstorage-file` : le store persisté de zustand casse.
    execArgv: ['--no-experimental-webstorage'],
    // `.worktrees` et `.claude/worktrees` (worktrees des agents) sont ignorés par git
    // mais restent sur le disque : sans exclusion, chaque test d'un worktree est collecté
    // en double, avec les dépendances de l'autre arbre, et le hook de pre-push échoue
    // sur des fichiers hors branche.
    exclude: [...configDefaults.exclude, '**/.worktrees/**', '**/.claude/worktrees/**'],
  },
  resolve: {
    alias: {
      '@peaklab/ui': path.resolve(__dirname, './src/components/ui'),
      '@': path.resolve(__dirname, './src'),
    },
  },
})
