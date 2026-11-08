# Audit — groupe `auth` (workflows 6, 7, 12)

Périmètre :

- **W6** : connexion par email, Google ou passkey, et mot de passe oublié / réinitialisation.
- **W7** : invitations (inviter, renvoyer, révoquer, accepter).
- **W12** : profil et compte (email, mot de passe, passkeys, sessions, suppression).

Méthode : chaque workflow est tracé page → composant client → server action ou route → use case → Prisma.
Les défauts de Better Auth 1.7.2 ont été vérifiés dans `node_modules/better-auth/dist`.
Tout point non vérifié est marqué « à vérifier ».

## 1. Synthèse

| Workflow              | Solide | Simple | UX  | UI  | Verdict                                                                                                                                       |
| --------------------- | ------ | ------ | --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 6 — Connexion / reset | 2/5    | 3/5    | 3/5 | 3/5 | L'inscription publique est restée ouverte et la réinitialisation ne coupe pas les sessions existantes, ce qui permet la prise de compte.      |
| 7 — Invitations       | 3/5    | 3/5    | 2/5 | 2/5 | L'acceptation est solide, mais une invitation liée à une famille ne vérifie pas l'email, et les liens d'invitation mènent à des impasses.     |
| 12 — Profil / compte  | 2/5    | 3/5    | 3/5 | 3/5 | La suppression du compte est possible sans réauthentification ni garde, et le changement de mot de passe laisse les autres sessions ouvertes. |

## 2. Constats par workflow

### W6 — Connexion (email, Google, passkey) et mot de passe oublié

#### Critique

**C1. L'inscription reste publique malgré « invitation seule » : pré-création de compte puis prise de compte**

- **Où** :
  - `src/lib/auth.ts:12-31` : `emailAndPassword` sans `disableSignUp`, avec `requireEmailVerification: false` (L14).
  - `src/lib/auth.ts:77-82` : Google sans `disableImplicitSignUp`.
  - `src/lib/auth.ts:91-96` : `accountLinking` actif.
  - `app/api/auth/[...all]/route.ts:13-31` : seules les routes Google sont filtrées, donc `POST /api/auth/sign-up/email` passe.
  - `src/lib/auth-client.ts:9-10` affirme à tort que l'invitation est le seul chemin de création de compte.
- **Scénario** :
  1. L'attaquant appelle `POST /api/auth/sign-up/email` avec `victime@x.fr`. Le compte est créé et `autoSignIn` lui ouvre une session de 7 jours.
  2. Un admin invite `victime@x.fr`. Comme le compte existe, la page `invite/[token]` affiche « rejoindre l'école ».
  3. La victime ne connaît pas le mot de passe. Elle le réinitialise, ou se connecte avec Google.
  4. Dans les deux cas, la session de l'attaquant survit :
     - `revokeSessionsOnPasswordReset` vaut false par défaut.
     - Google avec `emailVerified: true` est lié implicitement au compte existant (`better-auth/dist/oauth2/link-account.mjs:83`), et le mot de passe de l'attaquant reste valide.
  5. La victime rejoint l'école. L'attaquant voit alors les enfants et les paiements de la famille.
- **Effets secondaires** :
  - L'inscription d'un email existant répond 422 `USER_ALREADY_EXISTS`, ce qui révèle l'existence des comptes.
  - Des comptes orphelins s'accumulent.
- **Correction** : mettre `emailAndPassword.disableSignUp: true` et Google `disableImplicitSignUp: true`, ajouter `revokeSessionsOnPasswordReset: true`, et faire créer le compte d'invitation par un chemin serveur non exposé.
  - « à vérifier » : `auth.api.signUpEmail`, utilisé par `accept-invitation-action.ts`, respecte aussi `disableSignUp`. Si c'est le cas, créer l'utilisateur via l'adapter ou un hook `before` qui refuse `/sign-up/email` sur une requête HTTP.

#### Majeur

**M1. Boucle silencieuse pour un utilisateur connecté sans école**

- **Où** :
  - `src/lib/school-context.ts:95-96` renvoie null quand l'utilisateur n'a aucune adhésion.
  - `app/[locale]/(dashboard)/layout.tsx:35-36` redirige alors vers /login.
  - `app/[locale]/(auth)/login/page.tsx:31-34` ne redirige vers /dashboard que si un contexte d'école existe.
  - `src/features/auth/login-form.tsx` pousse toujours vers /dashboard après la connexion.
- **Scénario** : un compte créé via C1, ou un parent retiré de sa seule école, se connecte. Il fait login → /dashboard → /login sans aucun message, à l'infini.
- **Correction** : rediriger vers une page « aucun accès à une école » qui propose la déconnexion.

**M2. Rate limiting Better Auth probablement mutualisé derrière un proxy** (« à vérifier » selon le déploiement)

- **Où** :
  - `src/lib/auth.ts:97-101` : aucune option `rateLimit` ni `advanced.ipAddress.trustedProxies`.
  - `better-auth/dist/api/rate-limiter/index.mjs:232-260` : l'IP vient de `x-forwarded-for`, qui n'est accepté que s'il contient une seule valeur. Sinon tous les clients tombent dans un seul compteur `no-trusted-ip` par chemin.
- **Scénario** : derrière Coolify/Traefik plus un CDN, l'en-tête contient plusieurs IP. Trois tentatives de `sign-in/email` en 10 s depuis n'importe où bloquent la connexion de tout le monde.
- **Autre point** : le stockage est en mémoire, donc propre à chaque instance.
- **Correction** : configurer `advanced.ipAddress.trustedProxies` (ou `ipAddressHeaders`) et un `rateLimit.storage` partagé (`database`).

**M3. Les options d'authentification passkey sont une action publique sans limite**

- **Où** : `src/actions/passkey-actions.ts:124-137`. `getPasskeyAuthenticationOptions` est un server action appelable sans session. Chaque appel fait un upsert dans `Verification`, et aucune purge n'a été trouvée (« purge à vérifier »). La limite de 10/min ne couvre que `app/api/passkey/authenticate/route.ts:25`.
- **Scénario** : une boucle d'appels non authentifiés au server action remplit la table `Verification` sans limite.
- **Correction** : appliquer `src/lib/rate-limit.ts` à l'action (ou la déplacer dans la route limitée) et purger les challenges expirés.

#### Mineur

- **m1. Toute erreur de connexion apparaît comme « Email ou mot de passe incorrect », y compris un 429.**
  - Où : `src/features/auth/login-form.tsx:39`.
  - Scénario : un utilisateur bloqué par le rate limit croit s'être trompé de mot de passe, réessaie et prolonge le blocage.
  - Correction : ajouter un message dédié quand `error.status === 429`.
- **m2. Les erreurs ne sont pas annoncées aux lecteurs d'écran.**
  - Où : `login-form.tsx:100`, `forgot-password-form.tsx`, `reset-password-form.tsx`. Pas de `role="alert"`, et le libellé de chargement est `'...'`.
  - Correction : ajouter `role="alert"` et un libellé de chargement traduit.
- **m3. Un lien de reset expiré ou invalide donne une erreur générique.**
  - Où : `reset-password-form.tsx:64-67`.
  - Scénario : l'utilisateur ouvre le lien après 1 h. Il voit « erreur » sans savoir qu'il doit redemander un lien.
  - Correction : mapper `INVALID_TOKEN` vers un message traduit avec un lien vers `/forgot-password`.
- **m4. La page de reset ne redirige pas un utilisateur déjà connecté**, contrairement à forgot-password.
  - Où : `reset-password/page.tsx`.
  - Correction : aligner son comportement sur celui de forgot-password.
- **m5. Après la connexion, l'utilisateur n'est pas ramené à la page demandée.**
  - Où : `login-form.tsx:55` (Google) et la redirection email, toutes deux fixées sur `/dashboard`.
  - Correction : accepter un `callbackURL` validé comme chemin relatif.
- **m6. Clés i18n mortes** : `auth.login.noAccount` et `auth.login.register`.
  - Correction : les supprimer des deux locales.
- **m7. Tests manquants.**
  - Rien ne couvre forgot/reset.
  - `login-form` ne teste que Google et les drapeaux.
  - Correction : tester la cartographie des erreurs et le flux de reset.

### W7 — Invitations

#### Majeur

**M4. Une invitation avec famille mais sans personne contourne la vérification de l'email**

- **Où** :
  - `app/[locale]/(dashboard)/_lib/invitation-actions.ts:61-69` : la correspondance email ↔ `FamilyPerson` n'est vérifiée que si `familyId` ET `personId` sont fournis.
  - `invite-user-dialog.tsx:72` envoie `familyId` sans `personId`.
  - La règle métier de `docs/business-rules.md` (section Invitations) dit « Either both are supplied or neither ».
- **Scénario** : l'admin tape `jean.dupont@gmial.com` et choisit la famille Dupont. Le propriétaire de cette adresse erronée accepte et obtient `UserFamily`, donc l'accès aux enfants, aux inscriptions et aux paiements.
- **Correction** : refuser `familyId` sans `personId` dans le schéma Zod, et faire choisir la personne dans le dialogue.

**M5. « Renvoyer » invalide l'ancien lien même quand l'envoi échoue**

- **Où** : `invitation-actions.ts:129-142`. Le token est changé et `expiresAt` mis à jour avant l'envoi.
- **Scénario** : le serveur SMTP est en panne. L'admin clique « renvoyer » et obtient `emailError`, mais le lien déjà reçu est mort et aucun nouveau n'est parti.
- **Correction** : envoyer d'abord avec le nouveau token, puis ne persister la rotation qu'en cas de succès. Une autre option est de garder l'ancien token jusqu'au succès.

**M6. Impasses dans la page d'invitation pour un compte existant**

- **Où** :
  - `join-school-form.tsx:57-64` : « Se connecter » fait `router.push('/login')` sans retour vers l'invitation.
  - Quand l'utilisateur est connecté avec un autre compte, `/login` redirige vers /dashboard, et aucune déconnexion n'est proposée.
- **Scénario 1** : l'invité se connecte puis atterrit sur la boucle M1 (aucune école encore), sans revenir à `/invite/<token>`.
- **Scénario 2** : l'utilisateur est connecté sur le compte familial au lieu du sien. Il ne peut ni changer de compte ni accepter.
- **Correction** : passer `callbackURL=/invite/<token>` à /login et afficher « Se déconnecter et continuer » quand l'email diffère.

**M7. Page d'invitation codée en dur en français**

- **Où** : `app/[locale]/invite/[token]/page.tsx:17-19` (metadata « Créer votre compte »), `:30-39` (« Lien déjà utilisé ») et `:41-50` (« Lien expiré »).
- **Scénario** : un invité en `/en/invite/…` voit un titre et des erreurs en français. Cela viole `.agents/rules/next-intl.md`.
- **Correction** : déplacer ces textes dans `messages/{fr,en}.json` et utiliser `getTranslations({ locale, namespace })`.

#### Mineur

- **m8. Un email archivé mène à une erreur générique sans issue.**
  - Où : `invite/[token]/page.tsx:54-58`, puis `accept-invitation-action.ts:43-76`. `findAccountByEmail` passe par le filtre `isActive`.
  - Scénario : un utilisateur archivé est réinvité. La page affiche le formulaire d'inscription, puis la contrainte unique échoue avec `error`.
  - Correction : détecter le compte inactif et renvoyer un statut dédié (réactivation par un admin).
- **m9. Le compte est créé hors transaction et une session orpheline est créée.**
  - Où : `accept-invitation-action.ts:43-76`. `signUpEmail` s'exécute hors transaction avec une suppression compensatoire, et sans headers, donc la ligne de session créée n'est jamais utilisée.
  - Correction : documenter la compensation, supprimer la session créée ou passer `autoSignIn: false` (« à vérifier »).
- **m10. Validation incomplète à l'acceptation.**
  - Où : `accept-invitation-action.ts:10-14`. Le nom n'a ni `trim` ni `max`, et le mot de passe n'a pas de `max(128)`.
  - Scénario : un mot de passe de 200 caractères donne un `error` générique au lieu d'un message de validation.
  - Correction : aligner le schéma sur les limites de Better Auth (8–128).
- **m11. Des invitations en double peuvent coexister**, sans dédoublonnage des invitations actives pour le même couple email + école.
  - Où : `invitation-actions.ts:83-113`.
  - Correction : refuser ou réutiliser l'invitation active existante.
- **m12. Sur `emailError`, l'invitation reste en base mais la liste n'est pas rafraîchie.**
  - Où : `invitation-actions.ts:97-113`. `revalidatePath` est sauté.
  - Correction : revalider dans tous les cas où la ligne a été créée.
- **m13. La révocation n'a pas de confirmation.**
  - Où : `invitation-actions-cell.tsx:44-52`. Un clic supprime l'invitation.
  - Correction : ajouter un dialogue de confirmation.
- **m14. Une famille d'une autre école lève une erreur brute.**
  - Où : `invitation-actions.ts`. Un `familyId` d'une autre école échoue sur la clé étrangère composite.
  - Correction : vérifier la famille dans l'école et renvoyer `familyNotFound`.
- **m15. La documentation métier ne mentionne pas le rôle TEACHER.**
  - Où : `docs/business-rules.md` (Invitations) dit « only ADMIN or PARENT », alors que `invitation-actions.ts:17` accepte `TEACHER` et que la section Teacher access le décrit.
  - Correction : mettre à jour la règle.
- **m16. Les fallbacks d'URL locale sont incohérents.**
  - Où : `invitation-email.ts:26` utilise `localhost:8550`, alors que `auth-client` et `passkey-actions.ts:17` utilisent `localhost:3000`.
  - Correction : utiliser une seule constante d'URL d'application.
- **m17. Le sélecteur d'enseignant n'a pas d'état vide.**
  - Où : `invite-user-dialog.tsx:129-141`. S'il n'y a aucun enseignant libre, la liste est vide sans explication.
  - Correction : afficher un message et un lien vers la création d'un enseignant.
- **m18. Tests manquants** : ni renvoi, ni révocation, ni cas « `familyId` seul ».
  - Correction : les ajouter à `invitation-actions.test.ts`.

### W12 — Profil et compte

#### Majeur

**M8. Suppression de son propre compte sans réauthentification ni garde**

- **Où** :
  - `src/actions/profile-actions.ts:46-60`.
  - `src/use-cases/commands/delete-profile.ts:15-33` : le comptage des blocages puis la suppression ne sont pas dans une transaction.
  - `account-section.tsx:232-252` : la confirmation est un simple second clic, sans saisie.
  - Le chemin admin (tiroir) protège `lastSuperAdmin`, pas ce chemin-ci.
- **Scénario 1** : une session volée ou un poste laissé ouvert permet de supprimer le compte en deux clics.
- **Scénario 2** : le dernier super admin, ou le seul ADMIN d'une école, se supprime, et l'école n'a plus d'administrateur.
- **Correction** : exiger le mot de passe ou une passkey récente, appliquer les gardes `lastSuperAdmin` et « dernier admin d'école », et exécuter le tout dans une transaction.

**M9. Le changement d'email d'un compte non vérifié est confirmé depuis la nouvelle adresse**

- **Où** :
  - `src/actions/profile-actions.ts:122-137`.
  - `better-auth/dist/api/routes/update-user.mjs:455-515` : si `emailVerified !== true`, `sendChangeEmailConfirmation` (envoyé à l'ancienne adresse) est sauté, et la vérification part vers la nouvelle adresse.
  - Cela contredit `docs/business-rules.md` (section change-email : confirmation envoyée à l'adresse actuelle).
- **Scénario** : tous les comptes créés par invitation ou par l'admin ont `emailVerified: false`. Quelqu'un avec la session change l'email vers sa propre adresse, confirme depuis celle-ci et prend le contrôle du compte.
- **Correction** : marquer `emailVerified: true` à l'acceptation d'invitation (le lien prouve la possession de l'adresse), ou refuser `changeEmail` tant que l'email n'est pas vérifié.

**M10. Changer son mot de passe ne coupe pas les autres sessions, et toutes les erreurs se ressemblent**

- **Où** : `src/actions/profile-actions.ts:74-84`. `revokeOtherSessions` n'est pas passé, et toute erreur est convertie en `invalidCurrentPassword`.
- **Scénario 1** : l'utilisateur change son mot de passe après une fuite, mais la session de l'attaquant reste valide.
- **Scénario 2** : un compte Google sans mot de passe, ou un mot de passe de plus de 128 caractères, affiche « mot de passe actuel incorrect ».
- **Correction** : passer `revokeOtherSessions: true` et distinguer `noPassword`, `validationError` et `rateLimited`.

**M11. La mise à jour du profil n'est pas validée**

- **Où** : `src/actions/profile-actions.ts:30-44`. Il n'y a pas de Zod.
- **Scénario** : `image` accepte n'importe quelle chaîne, par exemple l'URL d'un pixel de suivi externe affiché aux autres utilisateurs. `name` n'a pas de limite de longueur. `bio` est accepté mais jamais enregistré (code mort).
- **Correction** : ajouter un schéma Zod (`name` trim 1–100, `image` limitée au domaine S3 ou à des chemins relatifs) et retirer `bio`.

#### Mineur

- **m19. Les tokens de toutes les sessions sont envoyés au navigateur.**
  - Où : `dashboard/settings/page.tsx:47` sélectionne `token`, et `:64-71` le sérialise vers le client ; `revokeSessionAction` (`profile-actions.ts:139-149`) prend un token brut.
  - Scénario : un XSS ou une extension lit dans le payload RSC les tokens des autres appareils, qui sont directement rejouables.
  - Correction : n'exposer que `id` et révoquer par `id` côté serveur, en vérifiant que la session appartient à l'utilisateur.
- **m20. Plusieurs actions destructrices n'ont pas de confirmation.**
  - Où : `passkey-section.tsx:95-110` (suppression de passkey) et la révocation de session dans `sessions-section.tsx`.
  - Correction : ajouter une confirmation.
  - Il manque aussi « déconnecter toutes les autres sessions ».
- **m21. Une erreur de liaison Google s'affiche aussi dans la zone de danger.**
  - Où : `account-section.tsx:154` et `:225-229`. L'état `error` est partagé, donc `linkFailed` apparaît dans les deux cartes. En plus, `t(\`errors.${error}\`)`est appelé sans`t.has`.
  - Correction : séparer les états et utiliser `t.has` avec un repli.
- **m22. Libellés codés en dur.**
  - Où : `sessions-section.tsx:25-34`, avec `'Unknown'`, `'Mobile'` et `'Desktop'`.
  - Correction : les traduire.
- **m23. Les erreurs de passkey sont génériques.**
  - Où : `passkey-section.tsx:69-86`. `signInDisabled`, `challengeExpired` et `verificationFailed` donnent toutes `t('error')`.
  - Correction : ajouter un message par cas.
- **m24. Un profil sans nom ne peut pas être supprimé.**
  - Où : `prisma-profile-gateway.ts:30`. `findByUserId` renvoie null quand `name` est vide, ce qui donne `profileNotFound`.
  - Correction : ne pas conditionner l'existence du profil au nom.
- **m25. Le challenge passkey n'est pas consommé de façon atomique.**
  - Où : `passkey-actions.ts:139-190`. Le challenge est lu puis supprimé en fin de traitement, ce qui permet un rejeu concurrent (« à vérifier » : l'exposition comme action appelable, la fonction étant exportée d'un fichier `'use server'` mais absente de `src/actions/index.ts`).
  - Correction : utiliser un `delete` conditionnel en tête.
- **m26. Le nom de passkey n'est pas validé.**
  - Où : `passkey-actions.ts:43` et `:74-115`, sans limite de longueur.
  - Correction : ajouter un schéma Zod.
- **m27. Tests manquants** : rien ne couvre `profile-actions` (changement d'email, de mot de passe, sessions), et `delete-profile` n'a pas de cas « dernier admin ».

## 3. Top 5 des actions prioritaires

1. **Fermer l'inscription publique** (C1) : `disableSignUp`, Google `disableImplicitSignUp` et `revokeSessionsOnPasswordReset: true`, avec un test qui vérifie que `/api/auth/sign-up/email` répond 4xx.
2. **Imposer la correspondance email ↔ personne pour toute invitation liée à une famille** (M4) : schéma, dialogue et test.
3. **Sécuriser les opérations sensibles du compte** (M8, M9, M10) : réauthentification et garde du dernier admin pour la suppression, `emailVerified` à l'acceptation ou refus de `changeEmail`, et `revokeOtherSessions` au changement de mot de passe.
4. **Configurer le rate limiting en production** (M2, M3) : `trustedProxies`, stockage en base, limite sur `getPasskeyAuthenticationOptions` et purge de `Verification`.
5. **Supprimer les impasses du parcours d'invitation et de connexion** (M1, M5, M6, M7) : page « aucune école », `callbackURL` vers l'invitation, renvoi transactionnel et textes traduits.
