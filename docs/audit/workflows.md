# Workflows à auditer

Inventaire des workflows métier de l'application, point d'entrée de l'audit. Chaque groupe a son
rapport dans `docs/audit/<groupe>.md`.

Axes d'audit, pour chaque workflow :

- **Solide** — authentification et scope avant la première requête, validation d'entrée, cas
  limites, atomicité (transactions), idempotence, tests existants, conformité à
  `docs/business-rules.md`.
- **Simple** — nombre d'étapes et de couches, duplication, code mort, complexité inutile.
- **UX** — erreurs traduites (`t.has('errors.…')`), confirmations sur l'irréversible, états
  vides/chargement, retour après succès, parcours sans impasse.
- **UI** — cohérence des composants, accessibilité (clavier, labels, focus), mobile, i18n fr/en.

Légende priorité : P1 argent/sécurité, P2 scolarité, P3 contenu/config.

## Groupe `money` — Argent (P1)

| # | Workflow | Points d'entrée |
|---|---|---|
| 1 | Paiement manuel, solde famille, remboursements | `payment-actions.ts`, `use-cases/payments/record-payment.ts`, `family-balance.ts`, `/dashboard/payments` |
| 2 | Paiement en ligne Stripe | `online-payment-actions.ts`, `create-checkout-session.ts`, `complete-checkout-session.ts`, `app/api/stripe/webhook` |
| 3 | Cycle de vie d'une inscription | `enrollment-actions.ts` (create, activate, complete, cancel, reassign, discount, setPlan), `/dashboard/enrollments` |
| 4 | Activation des paiements par école | `payments_enabled`, `is-payments-enabled.ts`, garde `paymentsDisabled` |
| 5 | Plans / tarifs | `plan-actions.ts`, `/dashboard/plans` |

## Groupe `auth` — Authentification et compte (P1)

| # | Workflow | Points d'entrée |
|---|---|---|
| 6 | Connexion email, Google, passkey ; mot de passe oublié / reset | `(auth)/login`, `forgot-password`, `reset-password`, `app/api/auth`, `app/api/passkey`, `src/lib/auth.ts` |
| 7 | Invitations (inviter, renvoyer, révoquer, accepter) | `invitation-actions.ts`, `invitation-email.ts`, `/invite/[token]` |
| 12 | Profil : email, mot de passe, passkeys, sessions, suppression du compte | `src/actions/profile-actions.ts`, `passkey-actions.ts`, `/profile`, `/settings` |

## Groupe `access` — Rôles, multi-école, utilisateurs (P1)

| # | Workflow | Points d'entrée |
|---|---|---|
| 8 | Rôles et scope (parent → famille, enseignant → classes, admin vs super admin) | `auth-helper.ts`, `proxy.ts`, pages `[id]` |
| 9 | Multi-école : isolation, sélecteur d'école, deep links | `school-switch.ts`, `src/actions/school-actions.ts`, `deep-link.ts`, tenant guard |
| 10 | Gestion des utilisateurs, impersonation | `user-actions.ts`, `/dashboard/users`, `/dashboard/super-admins`, `src/lib/impersonation.ts` |

## Groupe `mcp` — Accès machine (P1)

| # | Workflow | Points d'entrée |
|---|---|---|
| 11 | Clés API MCP, brouillons preview → commit (inscription, paiement, mise à jour d'inscription, événement), purge | `app/api/mcp`, `src/use-cases/mcp/*` |

## Groupe `school-records` — Familles et structure (P2)

| # | Workflow | Points d'entrée |
|---|---|---|
| 13 | Familles, personnes, élèves ; suppression définitive d'une famille | `family-actions.ts`, `student-actions.ts`, `/dashboard/families`, `/dashboard/students` |
| 14 | Périodes, niveaux, classes | `period-actions.ts`, `level-actions.ts`, `class-period-actions.ts`, `/dashboard/periods`, `levels`, `classes` |
| 15 | Promotion de fin d'année | `previewPromoteStudentsAction`, `promoteStudentsAction` |

## Groupe `teaching` — Enseignement (P2)

| # | Workflow | Points d'entrée |
|---|---|---|
| 16 | Emploi du temps (créneaux, enseignants par créneau) | `class-schedule-actions.ts`, `/dashboard/planning`, `/ecole/[slug]/planning` |
| 17 | Présences (appel planifié / ad hoc, validation, annulation) | `attendance-actions.ts`, `/dashboard/attendance`, `/dashboard/my-classes/[id]/attendance` |
| 18 | Enseignants : accès, archivage, suppression, notes de frais | `teacher-actions.ts`, `/dashboard/teachers` |

## Groupe `content-config` — Contenu public et configuration (P3)

| # | Workflow | Points d'entrée |
|---|---|---|
| 19 | Événements, pages publiques, affiche, flux ICS | `event-actions.ts`, `/dashboard/events`, `/ecole/[slug]/evenements`, `/evenements`, `app/api/schools/[slug]/events.ics`, `(print)/…/affiche` |
| 20 | Configuration école et plateforme, branding, médias | `config-actions.ts`, `media-actions.ts`, `platform-settings-actions.ts`, `app/api/media`, `/dashboard/config` |
| 21 | Administration des écoles, import legacy | `school-admin-actions.ts`, `/dashboard/schools` |
