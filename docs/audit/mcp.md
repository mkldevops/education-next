# Audit — groupe `mcp` (workflow 11, P1)

Périmètre :
- clés d'API MCP (création, liste, révocation, détenteurs) ;
- route `app/api/mcp` ;
- outils de lecture ;
- brouillons preview → commit (`enroll_family`, `record_payment`, `update_enrollment`, `create_event`) ;
- claim et purge des brouillons ;
- UI de gestion des clés.

Méthode : lecture de code, lecture de `docs/business-rules.md` (§ Machine access) et de `docs/mcp.md`.
Les 25 fichiers de test MCP, soit 243 tests, passent. Tous sont mockés : aucun test ne s'exécute
contre une base réelle ni en concurrence. Les outils `mcp__education__*` n'ont pas été appelés.

## 1. Synthèse

| Sous-workflow | Solide | Simple | UX | UI | Verdict |
|---|---|---|---|---|---|
| Clés : cycle de vie + UI | 4 | 4 | 3 | 4 | Hachage et plafond solides. Aucune révocation administrative ; clés orphelines quand le drapeau est coupé. |
| Route `/api/mcp` + scope | 5 | 4 | 4 | — | Ordre des gardes exemplaire ; scope relu à chaque appel. |
| Outils de lecture | 4 | 5 | 3 | — | Projections étroites. `list_class_periods` mélange toutes les périodes actives. |
| `enroll_family` | 2 | 3 | 2 | — | Classes homonymes entre périodes bloquantes ; appariement des membres trop lâche ; recomptage sans verrou. |
| `record_payment` | 3 | 4 | 3 | — | Garde `staleDraft` présente mais contournable en concurrence. |
| `update_enrollment` | 3 | 4 | 3 | — | Update inconditionnel ; `__unpriced__` exposé ; `totalAmount` non documenté. |
| `create_event` | 3 | 5 | 3 | — | Simple et en brouillon. Non idempotent ; la course sur le slug sort en `internalError`. |
| Claim / purge | 4 | 3 | 4 | — | Claim conditionnel robuste. Écriture du résultat non conditionnée ; purge en mémoire. |

L'axe UI ne s'applique qu'à l'écran des clés : les outils MCP n'ont pas d'interface.

## 2. Constats par sous-workflow

### 2.1 Clés d'API : cycle de vie et UI

Points solides :
- Clé `edu_mcp_` + 32 octets aléatoires, stockée seulement sous forme de SHA-256 (index unique) avec un
  préfixe de 12 caractères (`src/lib/mcp-key-crypto.ts`).
- Plafond de 5 clés vivantes par couple (utilisateur, école), vérifié en transaction Serializable
  (`src/gateways/mcp-api-key-gateway.ts:60-83`).
- La révocation pose `revokedAt` par un `updateMany` filtré sur `id`, `userId`, `schoolId` et
  `revokedAt: null` (`:97-101`).
- Le dialogue de confirmation nomme la clé et son préfixe.
- Les traductions `settings.apiKeys` fr et en sont complètes.

**Majeur — aucune révocation ni liste administrative des clés des autres.**
- Où : `src/gateways/mcp-api-key-gateway.ts:41-48` (`listForUser`), `:97-101` (`revoke` filtré sur
  `userId`) et `app/[locale]/(dashboard)/dashboard/settings/_lib/mcp-api-key-actions.ts:36-44`.
- Scénario : la clé d'un admin fuit dans un dépôt ou un poste partagé. Cet admin est absent ou
  injoignable. Aucun autre admin, ni le super-admin, ne voit cette clé ni ne peut la révoquer. Seul un
  retrait du rôle ADMIN la coupe, ce qui retire aussi tout l'accès dashboard de la personne.
- Correctif : ajouter une liste et une révocation au niveau de l'école (admin de l'école ou
  super-admin), sans exposer le hash, avec la politique documentée dans `business-rules.md`.

**Mineur — onglet masqué quand le drapeau est coupé : impossible de révoquer.**
- Où : `app/[locale]/(dashboard)/dashboard/settings/page.tsx:98-106`.
- Scénario : pendant un incident, le super-admin coupe `mcp_enabled`. Les admins ne peuvent plus
  révoquer leurs clés. Quand le drapeau revient, les clés non expirées redeviennent valides.
- Correctif : garder l'onglet visible en lecture et révocation quand le drapeau est coupé, et ne
  bloquer que la création.

**Mineur — la liste locale n'est jamais resynchronisée.**
- Où : `app/[locale]/(dashboard)/dashboard/settings/_components/api-keys-section.tsx:41`, avec
  `useState(keys)`.
- Scénario : après un `router.refresh()` ou une révocation dans un autre onglet, la liste reste figée
  sur les props initiales.
- Correctif : dériver l'état des props, par exemple avec `key` sur la section ou un effet de resync.

**Mineur — erreur de révocation générique.**
- Où : `api-keys-section.tsx:80-82`, qui affiche `t('error')` quel que soit le code.
- Scénario : l'utilisateur révoque une clé déjà révoquée ou expirée dans un autre onglet. Le code
  `notFound` s'affiche comme « erreur », et la clé `errors.notFound` n'existe pas.
- Correctif : passer par `t.has('errors.<code>')` et ajouter `errors.notFound` en fr et en.

**Mineur — la commande d'installation met la clé dans l'historique shell et ne vise que Claude.**
- Où : `api-keys-section.tsx:46-48`.
- Scénario : la commande copiée contient la clé en clair et atterrit dans `~/.zsh_history`. Aucune
  variante n'existe pour Codex ou un autre client.
- Correctif : proposer une variante qui lit une variable d'environnement, et ajouter un bloc de
  configuration générique.

**Mineur — la carte de clé créée n'a pas de bouton pour la fermer.** Le secret reste affiché jusqu'au
rechargement de la page. Correctif : ajouter un bouton « J'ai copié la clé » qui efface le secret de
l'état.

**Mineur — non vérifié : bouton imbriqué dans `DialogTrigger`.** `revoke-api-key-dialog.tsx` pourrait
placer un bouton dans un autre bouton. `@peaklab/ui` est un alias, et je n'ai pas vérifié son rendu.

### 2.2 Route `/api/mcp` et résolution du scope

Points solides :
- Ordre des gardes (`app/api/mcp/route.ts:63-88`) : rate limit par adresse, drapeau, scope, rate limit
  par clé, puis `touch`.
- Les en-têtes d'identification (`authorization`, `x-api-key`, `cookie`, `proxy-authorization`) sont
  retirés avant le SDK (`app/api/mcp/_lib/forwarded-request.ts`). `AuthInfo` ne porte que le préfixe.
- `resolveMcpScope` (`src/use-cases/mcp/resolve-mcp-scope.ts:80-111`) relit à chaque appel :
  - la clé : révocation et expiration ;
  - l'utilisateur actif ;
  - l'école active ;
  - l'appartenance ADMIN, ou `isSuperAdmin`.

  Le rôle PARENT n'a aucune variante de scope. La révocation est donc effective immédiatement.
- L'école vient de la clé, jamais de l'entrée. Toutes les requêtes de brouillon filtrent sur
  `schoolId` et `keyId`.

**Mineur — une clé aléatoire bien formée échappe aux deux niveaux de rate limit.**
- Où : `route.ts:37-38` et `:63-82`.
- Scénario : un attaquant envoie des clés `edu_mcp_…` aléatoires bien formées. Aucune ne passe par le
  limiteur par adresse, et comme aucune ne résout de scope, le limiteur par clé ne s'applique pas
  non plus. Chaque requête coûte donc une lecture en base. Ce compromis est documenté.
- Correctif : compter aussi les échecs de résolution dans le limiteur par adresse.

**Mineur — limiteurs et purge en mémoire.**
- Où : `route.ts:37-38` et `src/use-cases/mcp/purge-expired-drafts.ts`, avec `lastPurgeAt`.
- Scénario : avec plusieurs instances, les plafonds se multiplient par le nombre d'instances et la
  purge s'exécute sur chacune. L'effet reste bénin.
- Correctif : documenter la limite, ou déplacer ces états vers la base ou Redis lors d'un passage
  multi-instance.

### 2.3 Outils de lecture

Points solides :
- Les projections sont étroites : un enseignant est exposé par son id et ses noms seulement.
- `list_plans` n'est enregistré que si les paiements sont activés, et exclut la formule UNPRICED
  (`src/gateways/mcp-read-gateway.ts:69-74`).

**Majeur — `list_class_periods` mélange toutes les périodes actives, sans indiquer la courante.**
- Où : `src/gateways/mcp-read-gateway.ts:44-65`.
- Scénario : l'agent liste « CP-A » deux fois, en 2025-2026 et en 2026-2027, sans savoir laquelle
  viser. Ce défaut alimente le constat 2.4 sur les classes.
- Correctif : filtrer sur les périodes courante et future, ou exposer un indicateur `current` et
  trier par période.

**Mineur — `describe()` expose le nom technique de formule `__unpriced__` à l'agent.**
- Où : `src/use-cases/mcp/preview-update-enrollment.ts:32`.
- Correctif : remplacer ce nom par un libellé neutre, ou par `null`.

### 2.4 `preview_enroll_family` / `commit_enroll_family`

**Critique — l'inscription est bloquée quand un nom de classe existe dans plusieurs périodes, et peut
viser la mauvaise année.**
- Où :
  - `src/use-cases/mcp/preview-enroll-family.ts:132-146` : `matchByName` sur `listClassPeriods(schoolId)`,
    toutes périodes actives confondues ;
  - `src/use-cases/mcp/schemas.ts:55` : seul `className` existe, sans id ni période ;
  - `prisma/seed.ts:138-177` : « CP-A » et « CE1-A » existent dans les deux périodes actives.
- Scénarios :
  - La fiche indique « CP-A ». La résolution renvoie `ambiguousClass`, et aucun champ d'entrée ne
    permet de lever l'ambiguïté. L'inscription par MCP devient impossible pour toutes les classes
    reconduites d'une année sur l'autre, ce qui est le cas normal.
  - À l'inverse, un libellé qui n'existe plus que dans la période passée est retenu sans avertissement.
    L'élève est alors inscrit dans l'année écoulée.
- Correctif : accepter un `classPeriodId`, ou un libellé de période, et restreindre par défaut la
  résolution aux périodes courante et future.

**Majeur — deux commits simultanés passent tous les deux le recomptage de capacité.**
- Où : `src/use-cases/mcp/commit-enroll-family.ts:94-125`. Le `db.$transaction` y tourne par défaut en
  READ COMMITTED, sans verrou.
- Contexte : le dashboard verrouille l'élève dans la période via `lockStudentInPeriod`
  (`src/use-cases/enrollments/create-enrollment.ts:73-116`), mais pas la classe.
- Scénario : il reste 1 place. Deux brouillons distincts, venant de deux clés ou d'un agent qui
  parallélise, sont engagés dans la même fenêtre. Chaque transaction compte N−1 et insère : la classe
  finit à N+1. `business-rules.md` promet exactement l'inverse (« two drafts … would both land »).
- Correctif : exécuter le corps via `inSerializableTransaction`, ou prendre `SELECT … FOR UPDATE` sur
  les lignes `ClassPeriod` visées, et ajouter un test d'intégration concurrent.

**Majeur — l'appariement d'un membre de famille existante est trop lâche.**
- Où : `preview-enroll-family.ts:56-60` et `:98-120`, `src/gateways/family-gateway.ts:246-275`, avec
  `relationType: { not: 'PARENT' }` à la ligne 253.
- Scénarios :
  - La fiche indique « Ali Dupont ». Aucun membre ne correspond exactement, donc le repli par
    sous-chaîne retient « Alice Dupont ». Si Alice est déjà inscrite, le preview renvoie
    `duplicateEnrollment` et le nouvel enfant ne peut pas être inscrit. Sinon, Alice est inscrite à la
    place d'Ali.
  - Un grand-parent ou un tuteur (`GRANDPARENT`, `TUTOR`, `OTHER`) homonyme de l'enfant peut être
    apparié, puis devenir `Student`. La règle « a parent never becomes a student » est contournée par
    les relations autres que PARENT.
- Correctif :
  - n'accepter que l'égalité exacte après normalisation, et renvoyer un blocker `ambiguousMember`
    listant les candidats ;
  - restreindre aux relations d'enfant, ou aux personnes qui ont déjà un `Student`.

**Mineur — le preview et le commit ne comptent pas la capacité de la même façon.**
- Où : `src/gateways/class-period-gateway.ts:96-106` compte PENDING et ACTIVE ; `commit-enroll-family.ts:116`
  compte PENDING, ACTIVE et COMPLETED.
- Scénario : une classe contient des inscriptions COMPLETED. Le preview annonce qu'il reste une place,
  puis le commit refuse avec `classFull`. Le preview a menti.
- Correctif : aligner les deux sur un seul prédicat partagé, celui du dashboard.

**Mineur — le commit ne revérifie pas la formule.**
- Où : `commit-enroll-family.ts:224`, avec `planId: plan.id` repris tel quel du brouillon.
- Scénario : la formule est archivée entre le preview et le commit. L'inscription est créée sur une
  formule archivée, avec l'ancien montant.
- Correctif : relire la formule active dans la transaction et renvoyer `staleDraft` si elle a changé.

**Mineur — un élève archivé passe le preview mais échoue toujours au commit.**
- Où : `family-gateway.ts:246-275`, dont le `select` de `student` ne filtre pas `isActive` ; le commit
  refuse à `commit-enroll-family.ts:155`.
- Scénario : le preview est affiché « OK », mais le commit renvoie toujours `notFound`, qui ne se
  corrige pas.
- Correctif : filtrer ou bloquer dès le preview avec un blocker explicite.

**Mineur — la remise n'est pas validée comme un montant.**
- Où : `schemas.ts:95` et `:131`, avec `z.number().min(0)` sans `isCurrencyAmount`.
- Scénario : une remise de `10.005` est acceptée.
- Correctif : ajouter `.refine(isCurrencyAmount)`, comme pour `totalAmount`.

**Mineur — refus trompeurs.**
- Avec les paiements coupés, une formule réservée non tarifée combinée à une remise renvoie
  `discountExceedsPlan` au lieu de `paymentsDisabled` (`preview-enroll-family.ts:194-200`).
- Avec les paiements activés, un `planName` manquant renvoie un `validationError` opaque
  (`preview-enroll-family.ts:70`), alors qu'un blocker `planRequired` guiderait l'agent.

### 2.5 `preview_record_payment` / `commit_record_payment`

Points solides :
- `paymentsDisabled` est vérifié avant le claim (`commit-record-payment.ts:35`).
- Les soldes sont recalculés, et un `staleDraft` est renvoyé si la ventilation a changé (`:46-64`).

**Majeur — deux paiements concurrents sur le même solde passent tous les deux.**
- Où : `src/use-cases/mcp/commit-record-payment.ts:46-64`, en READ COMMITTED et sans verrou.
- Scénario : il reste 100 € à payer. Deux brouillons de 100 € sont engagés en même temps. Chaque
  transaction lit 100 € restants et crée son paiement : 200 € sont encaissés et la famille se retrouve
  en trop-perçu. Le même mécanisme vaut pour le dashboard avec le MCP.
- Correctif : verrouiller la ligne `Family` avec `FOR UPDATE`, ou passer par `inSerializableTransaction`.

**Mineur — la recherche de famille ne privilégie pas la correspondance exacte.**
- Où : `src/use-cases/mcp/preview-record-payment.ts:31-42` et `family-gateway.ts:276-282`, avec
  `contains`, insensible à la casse, et `take: 10`.
- Scénario : pour « Diallo », les familles « Diallo » et « Diallo-Ba » ressortent en `ambiguousFamily`
  alors qu'une correspondance exacte existe.
- Correctif : appliquer la même préférence d'égalité que `matchByName`.

**Mineur — un montant négatif (remboursement) est accepté sans règle dédiée.**
- Où : `schemas.ts:62`, qui n'exige qu'un montant non nul.
- Correctif : documenter le remboursement dans `business-rules.md`, ou l'interdire côté MCP.

**Mineur — le commit ne revérifie pas que la famille est toujours active.** Le paiement peut viser une
famille archivée entre le preview et le commit. Correctif : relire `Family` avec `isActive` dans la
transaction.

### 2.6 `preview_update_enrollment` / `commit_update_enrollment`

**Mineur — la mise à jour du commit est inconditionnelle.**
- Où : `src/use-cases/mcp/commit-update-enrollment.ts:49-75`.
- Scénario : un paiement est saisi au dashboard entre la comparaison avant/après et l'`update`. Le
  nouveau total peut alors passer sous le montant déjà payé, ce que `totalBelowPaid` devait empêcher.
- Correctif : écrire un `updateMany` conditionné par `updatedAt` ou par les valeurs lues, ou utiliser
  une transaction Serializable.

**Mineur — l'entrée `totalAmount` n'est pas documentée.**
- Où : l'entrée est acceptée par `schemas.ts:132`, mais absente de la description de l'outil
  (`src/mcp/server.ts:247-252`) et de `docs/mcp.md`.
- Correctif : documenter l'entrée, ou la retirer.

**Mineur — recherche d'inscription par sous-chaîne.** `findOpenForMcp`
(`src/gateways/enrollment-gateway.ts:173-201`) fait un `contains` sur le prénom et le nom, avec
`take: 10`. La correspondance exacte n'est pas privilégiée, ce qui produit des `ambiguousEnrollment`
évitables.

### 2.7 `create_event`

Points solides :
- L'événement naît en `DRAFT`.
- Il délègue au use-case `createEvent` du dashboard, sans duplication.

**Mineur — l'outil n'est pas idempotent.**
- Où : `src/use-cases/mcp/create-event.ts` et la description de l'outil dans `src/mcp/server.ts`.
- Scénario : une coupure réseau survient après l'écriture, et l'agent rejoue l'appel. Il reçoit
  `slugTaken`, et la description de l'outil lui dit de renommer : l'événement est créé en double.
- Correctif : renvoyer l'événement existant quand un appel identique rejoue, ou passer lui aussi par un
  brouillon avec claim.

**Mineur — la course sur le slug sort en `internalError`.**
- Scénario : deux créations simultanées passent `findBySlug`, puis la contrainte unique `(schoolId,
  slug)` lève une exception, mappée en `internalError` par `guard()`.
- Correctif : intercepter l'erreur P2002 et la traduire en `slugTaken`.

**Mineur — code mort.** La branche `endsWith('Z')` de `toWallClock` est inaccessible, car le schéma
interdit tout décalage horaire. Correctif : supprimer la branche.

### 2.8 Claim et purge des brouillons

Points solides :
- Le claim est un `updateMany` conditionné par `id`, `schoolId`, `keyId`, `tool`, `checksum`, le statut
  `PENDING` et `expiresAt > now` (`src/gateways/mcp-draft-gateway.ts:51-55`).
- Un rejeu renvoie le résultat stocké, et le reclaim ne s'applique qu'après 60 s sans résultat.
- Le résultat est écrit dans la même transaction que les données.
- Le verrou est relâché en cas de refus ou d'exception.

**Mineur — l'écriture du résultat n'est pas conditionnée.**
- Où : `src/use-cases/mcp/claim-draft.ts:136`, un `updateMany` sur `{ id, schoolId }` seulement.
- Scénario : un commit lent dépasse 60 s. Un second appel reprend le brouillon et l'engage. Les deux
  transactions écrivent leurs données, et le résultat du dernier écrase l'autre. Le reclaim ne protège
  donc pas contre le double engagement.
- Correctif : conditionner l'écriture par un jeton de claim, par exemple `claimedAt` égal à la valeur
  lue, et annuler la transaction si 0 ligne est modifiée.

**Mineur — `draftNotFound` est trompeur.**
- Où : `claim-draft.ts:72`.
- Scénario : un brouillon PENDING et valide perd la course contre un `release`. L'agent reçoit
  `draftNotFound` et abandonne, alors qu'un nouvel essai aboutirait.
- Correctif : renvoyer un code réessayable, par exemple `draftBusy`.

**Majeur, à vérifier — aucune trace durable de l'origine MCP des écritures.**
- Où : les modèles `Payment` et `Enrollment` de `prisma/schema.prisma` n'ont aucun champ auteur ni
  origine (vérifié). Le résultat du brouillon n'est conservé que 7 jours après expiration, puis purgé
  (`src/lib/db-unscoped.ts:87-101`), et `McpDraft.keyId` n'a pas de clé étrangère.
- Scénario : un encaissement erroné est découvert un mois plus tard. Plus rien ne dit qu'il vient d'une
  clé MCP, ni de laquelle. Reste à vérifier : l'existence d'un journal applicatif externe.
- Correctif : ajouter `createdById` et `source` (`MCP` ou `DASHBOARD`) sur les écritures, ou un journal
  d'audit non purgé.

## 3. Top 5 des actions prioritaires

1. **Lever l'ambiguïté des classes par période.** Accepter `classPeriodId` ou un libellé de période,
   restreindre `listClassPeriods` et la résolution aux périodes courante et future, et exposer la
   période dans la lecture (`preview-enroll-family.ts:132-146`, `mcp-read-gateway.ts:44-65`).
2. **Rendre les commits sûrs en concurrence.** Utiliser `inSerializableTransaction` ou
   `SELECT … FOR UPDATE` sur `ClassPeriod` et `Family` (`commit-enroll-family.ts:94-125`,
   `commit-record-payment.ts:46-64`, `commit-update-enrollment.ts:68-75`), conditionner l'écriture du
   résultat par un jeton de claim (`claim-draft.ts:136`), et ajouter des tests d'intégration sur base
   réelle en parallèle.
3. **Durcir l'appariement des membres.** N'accepter que l'égalité exacte, limiter aux relations
   d'enfant, et renvoyer un blocker `ambiguousMember` (`preview-enroll-family.ts:56-60`,
   `family-gateway.ts:253`).
4. **Ajouter une révocation et une liste administratives des clés.** Les ouvrir à l'admin de l'école et
   au super-admin, et les garder accessibles quand `mcp_enabled` est coupé
   (`mcp-api-key-gateway.ts:41-48` et `:97-101`, `settings/page.tsx:98-106`).
5. **Tracer durablement les écritures MCP.** Ajouter l'origine et la clé sur `Payment` et `Enrollment`,
   ou un journal d'audit, puis aligner le prédicat de capacité entre preview et commit
   (`class-period-gateway.ts:96-106`).
