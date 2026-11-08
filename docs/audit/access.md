# Audit du groupe `access` : rôles, multi-école, utilisateurs

Périmètre : workflows 8 (rôles et scope), 9 (multi-école, sélecteur, liens profonds, tenant guard),
10 (gestion des utilisateurs et impersonation). Audit en lecture seule, septembre 2026.

Tests exécutés : `pnpm vitest run` sur 8 fichiers liés à l'accès, soit 85 tests réussis.
Les constats marqués « à vérifier » n'ont pas été reproduits à l'exécution.

## 1. Synthèse

| Workflow                          | Solide | Simple | UX  | UI  | Verdict                                                                                                                            |
| --------------------------------- | ------ | ------ | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| W8 Rôles et scope                 | 4/5    | 4/5    | 3/5 | 3/5 | Gardes centralisées et appliquées avant la première requête ; le rôle TEACHER est à moitié intégré et la doc diverge du code.      |
| W9 Multi-école                    | 4/5    | 3/5    | 3/5 | 4/5 | Contexte relu en base et liens profonds scopés en une requête ; deux modèles scopés échappent au tenant guard.                     |
| W10 Utilisateurs et impersonation | 2/5    | 3/5    | 2/5 | 3/5 | Impersonation sans audit ni restriction, invariant du dernier super-admin non atomique, inscription publique probablement ouverte. |

Points solides à préserver :

- `getSchoolContext()` relit la base à chaque requête ; le cookie `active_school` n'est jamais cru
  (`src/lib/school-context.ts:86-113`).
- `resolveDeepLink` scope la lecture par `schoolId: { in }` et classe le résultat en une seule requête
  (`app/[locale]/(dashboard)/_lib/deep-link.ts:30-48`, `src/domain/school-scope.ts:36-48`).
- Le retrait et le changement de rôle d'un membre vérifient le dernier admin en transaction Serializable
  (`src/gateways/school-member-gateway.ts:72-123`).
- Les requêtes brutes (`src/gateways/school-gateway.ts:110`, `src/gateways/advisory-lock.ts:5`)
  n'exposent aucune donnée d'une autre école.

## 2. Constats par workflow

### W8. Rôles et scope

#### Critique

Aucun.

#### Majeur

- **Le rôle TEACHER existe en base mais pas dans les règles ni dans l'interface de rôle.**
  - Où : `prisma/schema.prisma:75-79` (enum `ADMIN PARENT TEACHER`) ; commentaire obsolète en
    `prisma/schema.prisma:98` (« SchoolRole n'a que ADMIN et PARENT ») ; `docs/business-rules.md`
    (section Roles and scope : ADMIN ou PARENT) ; schéma `ADMIN|PARENT` de
    `app/[locale]/(dashboard)/_lib/user-actions.ts:275-292` ;
    `app/[locale]/(dashboard)/dashboard/users/_components/school-member-dialogs.tsx:64-72`.
  - Scénario : un admin ouvre le dialogue de rôle d'un enseignant. Le Select reçoit la valeur TEACHER,
    qui ne figure pas dans ses options, et la soumission renvoie `validation_error`. Un enseignant ne
    peut donc être ni promu ni rétrogradé depuis l'interface.
  - Correction : ajouter TEACHER au schéma et au Select, puis documenter le rôle dans business-rules
    et corriger le commentaire du schéma.

- **Un parent lié à plusieurs familles n'en voit qu'une, choisie arbitrairement.**
  - Où : `src/lib/school-context.ts:107-113` (`userFamily.findFirst` trié par `familyId asc`) ;
    `adminOrLinkedTo` en `app/[locale]/(dashboard)/_lib/deep-link.ts:57-62`.
  - Scénario : un parent lié à F1 et F2 dans la même école ne voit que les élèves de la famille dont
    l'UUID est le plus petit dans les listes, alors que les liens profonds vers F2 fonctionnent. Il
    en conclut qu'un de ses enfants a disparu.
  - Correction : porter `familyIds: string[]` dans le contexte et filtrer par `familyId: { in }`, ou
    interdire explicitement le multi-lien et le documenter.

#### Mineur

- **La documentation contredit le code à plusieurs endroits.**
  - Où : `docs/business-rules.md`. La règle « Creating a school user does not need a role-escalation
    check. The removed canAssignRole » contredit « Assigning SUPER_ADMIN is reserved to a super admin
    (canAssignRole) ». La doc exige un super-admin pour lier une famille, alors que le code utilise
    `requireSchoolAdmin` (`user-actions.ts:220-238`). Elle cite `selfDeactivation` alors que le code
    renvoie `cannotTargetSelf`, et la clé i18n `selfDeactivation` n'est jamais utilisée.
  - Scénario : un contributeur qui suit la doc réintroduit `canAssignRole` ou restreint la liaison de
    famille, ce qui casse un comportement voulu.
  - Correction : aligner la section sur le code, supprimer la clé morte et retirer la phrase sur
    `canAssignRole`.

- **Un enseignant ou un parent sans famille reçoit un 404 sur les pages scopées.**
  - Où : `app/[locale]/(dashboard)/_lib/auth-helper.ts:56-75`.
  - Scénario : un parent invité mais pas encore lié à sa famille ouvre un lien d'élève et obtient
    « page introuvable » sans explication.
  - Correction : afficher un état vide expliquant que le compte attend son rattachement à une famille.

- **Couverture de test partielle des gardes.**
  - Où : `app/[locale]/(dashboard)/_lib/__tests__/auth-helper.test.ts` ne teste que `requireTeacher`.
  - Scénario : une régression de `requireSchoolScope`, par exemple un parent sans famille qui
    retomberait sur un filtre vide, passerait la CI.
  - Correction : ajouter des tests unitaires pour `requireSchoolAdmin`, `requireSchoolScope` et
    `requirePlatformAdmin`.

### W9. Multi-école, sélecteur, liens profonds, tenant guard

#### Critique

Aucun.

#### Majeur

- **AttendanceSession et AttendanceEntry ne sont pas couverts par le tenant guard.**
  - Où : `src/lib/tenant-guard.ts:23-48` (liste `TENANT_SCOPED_MODELS` ; le commentaire annonce 24
    modèles) ; les deux modèles portent un `schoolId` (`prisma/schema.prisma:615`, `:642`). La liste
    de `docs/business-rules.md` les omet aussi.
  - Scénario : une future requête de présence qui oublie son filtre `schoolId` renvoie les appels
    d'autres écoles sans que le guard lève d'erreur. Aujourd'hui, le scope n'est posé qu'à la main
    dans `app/[locale]/(dashboard)/_lib/attendance-actions.ts:72-73, 214-219, 233-238, 251-252,
    267-268`.
  - Correction : ajouter les deux modèles au guard, à la doc et à `school-isolation.test.ts`.

#### Mineur

- **Les erreurs de bascule d'école sont génériques.**
  - Où : `src/features/dashboard/school-switcher.tsx:65-68` (`toast.error(t('error'))`) ;
    `app/[locale]/(dashboard)/_components/school-switch-prompt.tsx` ignore le code `switchDisabled`
    ou `notFound`.
  - Scénario : la plateforme désactive la bascule et un membre multi-école clique sur une autre
    école. Il lit « Une erreur est survenue » au lieu de « Changement d'école désactivé ».
  - Correction : mapper chaque code renvoyé par `switchSchoolAction` vers une clé i18n dédiée.

- **Le message d'erreur du prompt de bascule n'est pas annoncé aux lecteurs d'écran.**
  - Où : `app/[locale]/(dashboard)/_components/school-switch-prompt.tsx`.
  - Scénario : un utilisateur de lecteur d'écran n'est pas informé de l'échec de la bascule.
  - Correction : ajouter `role="alert"` sur le message d'erreur.

- **Drapeau éteint : un membre multi-école est bloqué sur sa première appartenance.**
  - Où : `src/lib/school-context.ts:59-68`.
  - Scénario : un parent inscrit dans deux écoles ne peut pas consulter la seconde tant que
    `school_switch_enabled` est éteint, et aucun message ne l'en informe. Le comportement est voulu,
    mais il n'est pas signalé.
  - Correction : afficher dans le sélecteur les autres écoles désactivées, avec une infobulle
    « bascule désactivée ».

- **Le détail d'un élève expose les autres familles de l'enfant (à vérifier).**
  - Où : `app/[locale]/(dashboard)/dashboard/students/[id]/_lib/student-detail.ts` inclut toutes les
    familles de la personne, avec leurs membres et leurs téléphones.
  - Scénario : l'enfant de parents séparés appartient à F1 et F2 ; le parent de F1 voit les
    téléphones des membres de F2. Ce comportement est peut-être voulu.
  - Correction : pour un parent, restreindre l'inclusion à la famille de son scope, ou documenter
    l'exception.

- **Les requêtes brutes échappent au guard par construction.**
  - Où : `src/lib/tenant-guard.ts` n'intercepte ni `$queryRaw` ni `$executeRaw`. Les deux usages
    actuels sont sûrs.
  - Scénario : une future requête brute qui lit des données scopées ne serait pas contrôlée.
  - Correction : ajouter une règle (lint ou revue) qui réserve `$queryRaw` à `db-unscoped.ts` et aux
    gateways listés.

### W10. Gestion des utilisateurs et impersonation

#### Critique

- **Pendant une impersonation, aucune action sensible n'est bloquée.**
  - Où : `impersonatedBy` n'est lu que par la bannière et par le plugin (`src/lib/impersonation.ts`).
    Chemins exposés : enregistrement d'une passkey dans `src/actions/passkey-actions.ts:43-120`,
    suppression du compte dans `src/actions/profile-actions.ts:46-60`, clé MCP dans
    `app/[locale]/(dashboard)/dashboard/settings/_lib/mcp-api-key-actions.ts` (à vérifier).
  - Scénario : un super-admin emprunte le compte d'un admin d'école et enregistre sa propre passkey
    sur ce compte. La session d'une heure ne limite plus rien : il peut se reconnecter en tant que la
    cible à volonté, sans trace. Il peut aussi supprimer le compte cible sans passer par
    `checkDeletion` ni par la confirmation par email.
  - Correction : ajouter une garde `forbidWhileImpersonating()` sur les mutations d'identité
    (passkey, adresse, mot de passe, suppression, clés API, sessions).

- **L'impersonation ne laisse aucune trace persistante.**
  - Où : `src/lib/impersonation.ts:32-84` (début) ; `src/lib/impersonation.ts:110` supprime la session
    empruntée à l'arrêt, seule ligne qui portait `impersonatedBy`.
  - Scénario : après une plainte d'un parent, l'école ne peut pas établir quel super-admin a agi en
    son nom, quand, ni ce qu'il a modifié.
  - Correction : écrire une ligne `ImpersonationLog` (acteur, cible, début, fin, IP) au démarrage et à
    l'arrêt, dans la même transaction que la session.

#### Majeur

- **L'invariant « au moins un super-admin actif » n'est pas atomique.**
  - Où : `src/use-cases/users/change-platform-level.ts:16-20` et `src/use-cases/users/set-user-active.ts:15-19`
    comptent via `countActiveSuperAdmins`, puis écrivent via `src/gateways/user-gateway.ts:181-195`,
    hors transaction.
  - Scénario : deux super-admins se retirent mutuellement le niveau plateforme ou se désactivent au
    même instant. Chacun lit un compte de 2, les deux écritures passent, et la plateforme n'a plus
    aucun super-admin. Le seul recours est alors une intervention en base.
  - Correction : faire le comptage et l'écriture dans une transaction Serializable avec relance,
    comme `changeMembershipRole`, et ajouter un test de concurrence.

- **L'inscription publique est probablement ouverte (à vérifier par un POST).**
  - Où : `src/lib/auth.ts:12-14` (`emailAndPassword.enabled: true` sans `disableSignUp`,
    `requireEmailVerification: false`) ; Google sans `disableImplicitSignUp` et `accountLinking`
    avec `allowDifferentEmails: true` (`src/lib/auth.ts:91-96`). La doc affirme au contraire
    « There is no public sign-up ».
  - Scénario : un tiers envoie un POST sur `/api/auth/sign-up/email` avec l'adresse d'un parent
    invité. Quand le parent accepte l'invitation, il reçoit `emailAlreadyUsed`
    (`app/[locale]/invite/[token]/_lib/accept-invitation-action.ts:38-39`) et reste bloqué.
  - Correction : passer `disableSignUp: true`, garder la création de compte pour l'API serveur et
    l'invitation, et activer `disableImplicitSignUp` pour Google.

- **`updateUserAction` permet de prendre le contrôle d'un pair super-admin.**
  - Où : `app/[locale]/(dashboard)/_lib/user-actions.ts:100-139`. L'action n'a ni refus
    `cannotTargetSelf` ni protection des pairs. `findManaged(payload.id)` est appelé avant la
    validation, donc une entrée null lève une exception.
  - Scénario : un super-admin remplace l'adresse d'un autre super-admin par la sienne, puis déclenche
    `resetUserPasswordAction` (l.195-213). Il prend le compte, alors que `checkImpersonation`
    interdit justement de cibler un super-admin. Il peut aussi changer sa propre adresse sans la
    confirmation du flux `changeEmail`.
  - Correction : appliquer à la mise à jour les règles de `checkImpersonation` (pas de cible
    super-admin, pas soi-même), et valider l'entrée avant toute lecture.

- **Un super-admin sans appartenance ne peut être géré depuis aucune interface.**
  - Où : `app/[locale]/(dashboard)/dashboard/super-admins/page.tsx` est en lecture seule ; la page
    `users/page.tsx:31` ne liste que les appartenances de l'école active.
  - Scénario : un super-admin quitte l'équipe. Personne ne peut le rétrograder, le désactiver ni
    révoquer ses sessions sans passer par la base.
  - Correction : brancher `UserPlatformActions` (niveau, désactivation, sessions) sur les lignes de
    la page super-admins.

- **`createUserAction` n'est pas atomique et c'est l'admin qui fixe le mot de passe.**
  - Où : `app/[locale]/(dashboard)/_lib/user-actions.ts:29-60`. L'action enchaîne `signUpEmail`,
    `user.update` et `createMembership` sans transaction. Elle renvoie `validation_error` (au lieu de
    `validationError`) et un `error` générique si l'adresse existe déjà.
  - Scénario : la création de l'appartenance échoue. Le compte reste orphelin, sans école, et un
    nouvel essai renvoie « error » à cause de l'adresse déjà prise. Par ailleurs, l'admin connaît le
    mot de passe du parent, ce qui contredit « Passwords are never set by an administrator ».
  - Correction : remplacer la création directe par l'invitation (lien de définition du mot de
    passe), ou compenser par la suppression du compte si l'appartenance échoue ; renvoyer
    `emailAlreadyUsed` avec un lien vers « ajouter un membre existant ».

- **Lier une famille à un non-membre provoque une erreur 500.**
  - Où : `src/use-cases/users/link-user-family.ts:8-23` cherche la cible globalement via
    `findManaged`, sans contrôle d'appartenance à l'école active ; la FK composite
    UserFamily→SchoolMember rejette alors l'écriture par une erreur Prisma non interceptée.
  - Scénario : un admin d'école A soumet l'identifiant d'un utilisateur de l'école B. Aucune donnée
    ne fuit, mais l'action lève une erreur 500 et journalise une exception.
  - Correction : vérifier l'appartenance avant l'écriture et renvoyer `notFound`.

- **Les actions plateforme irréversibles ou puissantes n'ont pas de confirmation.**
  - Où : `app/[locale]/(dashboard)/dashboard/users/_components/user-platform-actions.tsx:52-70`
    (case super-admin appliquée immédiatement), `:91-98` (révocation des sessions), `:99-107`
    (désactivation) et `:79-82` ; `impersonate-user-button.tsx` (impersonation).
  - Scénario : un clic involontaire sur la case accorde le niveau super-admin, donc l'accès à toutes
    les écoles, sans étape de confirmation.
  - Correction : ouvrir un AlertDialog qui nomme la cible et la conséquence, sur le modèle du
    dialogue de suppression.

#### Mineur

- **L'arrêt d'impersonation échoue après l'expiration d'une heure (à vérifier).**
  - Où : `src/lib/impersonation.ts:85-116`.
  - Scénario : la session empruntée expire. « Arrêter » renvoie UNAUTHORIZED ; l'admin est déconnecté
    au lieu de retrouver sa session.
  - Correction : restaurer la session admin à partir du cookie signé même quand la session empruntée
    a expiré.

- **La bannière d'impersonation n'indique pas l'expiration et n'est pas accessible.**
  - Où : `src/features/dashboard/impersonation-banner.tsx`.
  - Scénario : l'admin ne sait pas quand la session empruntée se termine, et un lecteur d'écran
    n'annonce pas la bannière.
  - Correction : afficher l'heure d'expiration, ajouter `role="status"` et `aria-hidden` sur l'icône.

- **Le « dernier login » est faux.**
  - Où : `app/[locale]/(dashboard)/dashboard/users/page.tsx:63-72` (`session.groupBy` sur `createdAt`).
  - Scénario : une impersonation apparaît comme une connexion de la cible, et un utilisateur
    déconnecté semble ne s'être jamais connecté.
  - Correction : stocker `lastLoginAt` sur User dans un hook de connexion, en excluant les sessions
    d'impersonation.

- **Bouton d'invitation incohérent sur une école vide.**
  - Où : `app/[locale]/(dashboard)/dashboard/users/page.tsx:95` cache le bouton si `rows.length === 0`,
    alors que l'état vide de `users-table.tsx:138-148` propose d'inviter.
  - Scénario : une nouvelle école voit un appel à l'action sans le bouton correspondant dans l'en-tête.
  - Correction : toujours afficher le bouton, ou relier l'état vide au dialogue d'invitation.

- **Le détail d'un utilisateur expose ses sessions globales à un admin d'école.**
  - Où : `app/[locale]/(dashboard)/_lib/user-actions.ts:73-80` ; `src/gateways/user-gateway.ts:98-176`
    renvoie IP, user agents, passkeys et comptes, tous hors du scope de l'école.
  - Scénario : l'admin de l'école A voit les IP d'un parent aussi inscrit à l'école B, y compris
    celles de son activité dans B.
  - Correction : réserver sessions et passkeys à `requirePlatformAdmin`.

- **Pas de contrôle sur soi-même pour la révocation des sessions.**
  - Où : `app/[locale]/(dashboard)/_lib/user-actions.ts:183-191`.
  - Scénario : un super-admin révoque ses propres sessions et se déconnecte de tous ses appareils.
  - Correction : refuser `cannotTargetSelf`, ou exclure la session courante.

- **Les chemins sensibles manquent de tests.**
  - Où : aucun test pour les endpoints du plugin d'impersonation, les actions de niveau plateforme, de
    désactivation ou de liaison de famille, ni pour la vérification du dernier admin
    (`school-member-gateway.ts:72-123`) ; `user-actions.test.ts` ne couvre que la création et
    l'adresse.
  - Scénario : la suppression de la vérification `checkImpersonation` sur un super-admin passerait
    la CI.
  - Correction : ajouter des tests d'action pour chaque refus de `src/domain/user.ts` et un test
    d'intégration du dernier admin.

## 3. Top 5 des actions prioritaires

1. **Encadrer l'impersonation.** Journaliser chaque début et chaque fin d'impersonation, et bloquer
   pendant la session empruntée les mutations d'identité : passkey, adresse, mot de passe,
   suppression, clés MCP et sessions (`src/lib/impersonation.ts`, `passkey-actions.ts`,
   `profile-actions.ts`).
2. **Rendre atomique l'invariant du dernier super-admin.** Faire le comptage et l'écriture dans une
   transaction Serializable (`change-platform-level.ts`, `set-user-active.ts`, `user-gateway.ts:181-195`)
   et ajouter un test de concurrence.
3. **Fermer l'inscription publique.** Passer `disableSignUp: true`, activer `disableImplicitSignUp`
   pour Google (`src/lib/auth.ts:12-14`, `:91-96`), puis vérifier par un POST sur
   `/api/auth/sign-up/email`.
4. **Protéger les super-admins dans la gestion des utilisateurs.** Appliquer les refus « soi-même »
   et « cible super-admin » à `updateUserAction`, confirmer l'octroi du niveau super-admin, et
   ajouter les actions de gestion à `/dashboard/super-admins`.
5. **Compléter le scope.** Ajouter AttendanceSession et AttendanceEntry au tenant guard et au test
   d'isolation, intégrer TEACHER au changement de rôle, puis aligner `docs/business-rules.md` sur le
   code.
