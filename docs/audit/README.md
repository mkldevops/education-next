# Audit des workflows — synthèse

Audit du code (lecture seule), 2026-09-23. Inventaire et axes : [workflows.md](workflows.md).
Pas de parcours navigateur authentifié : l'UX/UI est jugée depuis les composants.

« Confirmé » = revérifié dans le code après le rapport de l'agent. Les autres constats restent à
confirmer avant correction.

## Notes (Solide / Simple / UX / UI, sur 5)

| Groupe | Workflow | S | Si | UX | UI | Rapport |
|---|---|---|---|---|---|---|
| money | Paiement manuel | 2 | 3 | 2 | 3 | [money.md](money.md) |
| money | Stripe | 2 | 4 | 3 | 3 | |
| money | Cycle d'inscription | 3 | 3 | 2 | 3 | |
| money | `payments_enabled` | 4 | 4 | 3 | 4 | |
| money | Plans | 3 | 4 | 2 | 3 | |
| auth | Connexion / reset | 2 | 3 | 3 | 3 | [auth.md](auth.md) |
| auth | Invitations | 3 | 3 | 2 | 2 | |
| auth | Profil / compte | 2 | 3 | 3 | 3 | |
| access | Rôles et scope | 4 | 4 | 3 | 3 | [access.md](access.md) |
| access | Multi-école | 4 | 3 | 3 | 4 | |
| access | Utilisateurs, impersonation | 2 | 3 | 2 | 3 | |
| mcp | Clés API | 4 | 4 | 3 | 4 | [mcp.md](mcp.md) |
| mcp | enroll_family | 2 | 3 | 2 | — | |
| mcp | record_payment | 3 | 4 | 3 | — | |
| school-records | Familles, élèves | 2 | 3 | 3 | 3 | [school-records.md](school-records.md) |
| school-records | Périodes, niveaux, classes | 3 | 3 | 3 | 3 | |
| school-records | Promotion | 2 | 3 | 3 | 3 | |
| teaching | Emploi du temps | 3 | 3 | 3 | 3 | [teaching.md](teaching.md) |
| teaching | Présences | 2 | 2 | 3 | 4 | |
| teaching | Enseignants | 3 | 4 | 3 | 3 | |
| content-config | Événements, ICS | 2 | 4 | 3 | 4 | [content-config.md](content-config.md) |
| content-config | Config, branding, médias | 3 | 4 | 4 | 4 | |
| content-config | Écoles, import legacy | 3 | 4 | 3 | 4 | |

## Priorités transverses

### Critiques

1. **Écriture inter-écoles** (confirmé) — `family-actions.ts:44`, `student-actions.ts:56` : `...data`
   après `schoolId` laisse le client écraser l'école ; le tenant guard ne contrôle que la présence du
   `schoolId`. Seules occurrences du motif dans les actions.
2. **Paiement Stripe perdu** (confirmé) — `complete-checkout-session.ts:39-41` : si le montant dépasse
   le solde à l'arrivée du webhook, 422 sans `Payment` ; Stripe a encaissé.
3. **Inscription publique ouverte** (confirmé) — `src/lib/auth.ts` : pas de `disableSignUp`.
   Pré-création du compte d'un futur invité.
4. **Impersonation sans garde-fou** — passkey enregistrable, suppression de compte, aucune trace
   après arrêt.
5. **Trop-perçu concurrent** — `record-payment.ts`, `commit-record-payment.ts`, `promote-students.ts`,
   `commit-enroll-family.ts` : revérifications hors transaction/verrou (solde, capacité).
6. **Présences** — élève affecté le jour même absent de l'appel ; « Rétablir » repasse une séance
   validée en brouillon.
7. **ICS décalé** — `event-ics.ts:109-110` : heure locale exportée en UTC (`Z`).
8. **Suppression définitive de famille** — P2003 dès qu'une présence existe.

### Majeurs récurrents

- **Garde tenant incomplet** (confirmé) : `AttendanceSession`, `AttendanceEntry` absents de
  `TENANT_SCOPED_MODELS`.
- **Concurrence** : aucune invariante « au plus / au moins » protégée par verrou (super-admin actif,
  capacité, solde).
- **Erreurs Prisma non interceptées** → error boundary : doublon de plan, suppression de créneau,
  montant hors bornes.
- **Irréversible sans confirmation** : annuler/clôturer une inscription, archiver.
- **SSRF** via `logo_url` récupéré côté serveur (`branding-icon.ts`).
- **Compte** : changement d'email confirmé sur la nouvelle adresse, suppression sans mot de passe,
  changement de mot de passe sans révocation des autres sessions.
- **Traçabilité** : pas d'auteur sur `Payment`/`Enrollment`, origine MCP perdue à la purge.
- **i18n** : `paymentsDisabled` non traduit.

### Couverture de tests

Tests unitaires verts mais mockés : aucun test de concurrence, aucun test sur base réelle pour les
chemins d'argent et de MCP.
