# Architecture

- Clean Architecture: Server Action → Use Case → Domain → Gateway
- Server Actions comme API boundary (`'use server'`)
- Gateway pattern pour l'infrastructure (DB, API externes, email)
- Domain entities pour les règles métier
- Result type pattern: retourner `'OK'` ou un code d'erreur typé
- Zod 4 pour la validation des entrées (`z.email()`, `z.uuid()` au lieu de `z.string().email()`)
