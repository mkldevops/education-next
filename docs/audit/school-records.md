# Audit — groupe `school-records` (workflows 13, 14, 15)

Périmètre : familles / personnes / élèves (dont suppression définitive d'une famille), périodes /
niveaux / classes, promotion de fin d'année. Chaque workflow est tracé page → action → use case →
domaine → Prisma. Lecture seule ; aucun test lancé. Les points non confirmés par lecture du code sont
marqués « à vérifier ».

Chemins abrégés : `(dashboard)/` = `app/[locale]/(dashboard)/`, `dashboard/` =
`app/[locale]/(dashboard)/dashboard/`.

## 1. Synthèse

| Workflow | Solide | Simple | UX | UI | Verdict |
|---|---|---|---|---|---|
| 13 — Familles, personnes, élèves | 2/5 | 3/5 | 3/5 | 3/5 | Écriture inter-écoles possible via l'ordre du spread, suppression définitive cassée dès qu'un appel a eu lieu. |
| 14 — Périodes, niveaux, classes | 3/5 | 3/5 | 3/5 | 3/5 | Structure saine (cycles, pointeurs nettoyés), mais chevauchement et capacité divergent de la règle et plusieurs P2002 non gérés. |
| 15 — Promotion de fin d'année | 2/5 | 3/5 | 3/5 | 3/5 | Bon parcours aperçu → confirmation → rapport, mais classe source erronée possible et exécution non idempotente. |

## 2. Constats par workflow

### Workflow 13 — Familles, personnes, élèves

#### Critique

**C13-1 — Écriture inter-écoles (IDOR) par ordre du spread.**
- `(dashboard)/_lib/family-actions.ts:44` : `updateFamily({ schoolId, id, ...data })`.
- `(dashboard)/_lib/student-actions.ts:56` : `updateStudent({ schoolId, id, ...data })`.
- Les schémas Zod acceptent `schoolId` (`src/features/families/schemas.ts:42-50`,
  `src/features/students/schemas.ts:41-46`), et `src/lib/tenant-guard.ts` ne vérifie que la
  présence d'un `schoolId`, pas son égalité avec celui de la session.
- Scénario : un admin de l'école A appelle
  `updateFamilyAction(x, { schoolId: '<B>', id: '<famille de B>', name: '…' })`. Le spread écrase
  `schoolId` et `id`, et la famille de l'école B est modifiée. Même chose pour un élève.
- Le correctif existe déjà dans le même dossier : `(dashboard)/_lib/class-period-actions.ts:18-20`
  documente ce bug et place `schoolId` après le spread.
- Correctif : placer `schoolId` et `id` après `...data` (ou les omettre du schéma d'entrée), et
  ajouter un test qui injecte un `schoolId` étranger.

**C13-2 — La suppression définitive d'une famille plante dès qu'un élève a été pointé.**
- `src/gateways/family-gateway.ts:177-223` (`deleteWithRelated`) ne supprime pas les
  `AttendanceEntry`.
- `AttendanceEntry.student` est en `onDelete: Restrict` (`prisma/schema.prisma:656`, migration
  `20260916190000_add_attendance` ligne 44).
- Scénario : l'admin supprime une famille dont un enfant a eu un appel. `tx.student.deleteMany`
  lève P2003. L'erreur n'est interceptée ni par `deleteFamilyAction` ni par `useDialogForm`
  (`src/features/forms/use-dialog-form.ts:25-35`), donc l'utilisateur tombe sur l'error boundary.
- `countDeletionImpact` ne compte pas les présences non plus : le dialogue annonce un impact
  incomplet. Le test `src/gateways/__tests__/family-cascade-delete.test.ts` n'a pas de cas
  « présence ».
- Correctif : supprimer les `AttendanceEntry` des élèves dans la transaction, les compter dans
  l'impact, et couvrir ce cas par un test d'intégration.

#### Majeur

**M13-1 — Une famille archivée est inaccessible et ne peut pas être restaurée.**
- La liste filtre sur `isActive` (`dashboard/families/page.tsx:52-53`), et `resolveFamily`
  (`dashboard/families/[id]/_lib/family-detail.ts:14-22`) lit via `db` soft-delete, ce qui donne
  une 404 pour une famille archivée.
- Scénario : l'admin archive une famille par erreur. Il ne peut ni la retrouver, ni la restaurer,
  ni la supprimer définitivement, alors que la règle dit que les deux états sont supprimables.
  Aucune action de restauration n'existe (familles, élèves, niveaux, périodes).
- Correctif : ajouter un filtre « archivées » lu via `dbArchived`, avec des actions restaurer et
  supprimer.

**M13-2 — L'archivage d'une famille ne masque pas ses membres, contrairement au texte du dialogue.**
- Le dialogue annonce « masquera la famille et ses membres ». Or `familyGateway.deactivate`
  (`src/gateways/family-gateway.ts:117-121`) n'archive que la ligne `Family`.
- Scénario : après archivage, les enfants restent listés dans `dashboard/students/page.tsx:40-55`.
  L'include imbriqué renvoie la famille archivée, et le lien vers cette famille mène à une 404.
- Correctif : soit archiver les élèves et personnes dans la même transaction, soit corriger le
  texte et masquer le lien quand la famille est archivée.

**M13-3 — `createStudent` n'est pas transactionnel.**
- `src/use-cases/students/create-student.ts:28-34` crée la personne, puis l'élève, puis le lien
  `FamilyPerson`, en trois écritures séparées.
- Scénario : l'écriture du lien échoue (famille archivée entre-temps, FK composite). Il reste une
  personne et un élève orphelins, invisibles dans la famille. `createEnrolledStudent`, lui, est
  transactionnel.
- Correctif : envelopper les trois écritures dans `db.$transaction`.

**M13-4 — Course sur la dernière place lors d'un ajout d'élève inscrit.**
- `src/use-cases/students/create-enrolled-student.ts:85-87` affirme que deux ajouts concurrents ne
  peuvent pas passer tous les deux. Pourtant le comptage (lignes 88-96) s'exécute en READ
  COMMITTED, sans verrou sur la classe.
- Scénario : deux admins ajoutent chacun un élève sur la dernière place au même moment. Les deux
  comptages voient 19/20, et la classe finit à 21/20.
- Correctif : prendre un verrou consultatif par `classPeriodId` avant le comptage (comme
  `lockStudentInPeriod`), ou corriger le commentaire et documenter la limite.

#### Mineur

**m13-1 — `addPhoneAction` ne vérifie pas la personne.**
- `(dashboard)/_lib/family-actions.ts:102-115`.
- Scénario : avec un `personId` inconnu, la FK composite lève P2003, non interceptée. La clé
  `addPhone.notFound` n'est jamais produite. Une personne archivée peut aussi recevoir un numéro.
- Correctif : charger la personne active de l'école avant l'insertion et renvoyer `'notFound'`.

**m13-2 — `linkUserToFamily` ne valide pas l'utilisateur et plante sur un doublon.**
- `src/use-cases/families/link-user-to-family.ts` et `src/gateways/family-gateway.ts:304-311`.
- Scénario : un `userId` qui n'est pas membre de l'école est accepté. Un lien déjà existant lève
  P2002, non interceptée.
- Correctif : vérifier l'appartenance à l'école et mapper P2002 vers `'alreadyLinked'`.

**m13-3 — Le dialogue de suppression définitive est incomplet.**
- `dashboard/families/_components/delete-family-dialog.tsx` : la saisie du nom, la liste d'impact
  et le bouton désactivé tant que le nom ne correspond pas sont bien faits.
- Manques : les présences ne sont pas comptées (voir C13-2), et l'état en cours affiche `'...'`
  sans libellé lisible par un lecteur d'écran.
- Correctif : ajouter le compteur de présences et un libellé « Suppression… » avec `aria-busy`.

**m13-4 — L'enfant est lié avec `relationType: 'OTHER'`.**
- `src/use-cases/students/create-student.ts:34`.
- Scénario : un élève créé depuis la fiche famille apparaît comme « Autre » et non comme enfant
  dans les listes de membres.
- Correctif : utiliser la valeur « enfant » de l'énum, si elle existe (à vérifier dans
  `schema.prisma`).

**m13-5 — Tests de suppression faibles.**
- `src/use-cases/families/__tests__/delete-family.test.ts` ne fait que mocker le gateway.
- `family-cascade-delete.test.ts` est ignoré sans base (`describe.skipIf`), donc la CI peut ne
  jamais l'exécuter (à vérifier dans la configuration CI).
- Correctif : ajouter un cas « présence » et s'assurer que la CI fournit une base à ce test.

**UX/UI à vérifier** : la longueur du formulaire de création de famille
(`create-family-dialog.tsx`, 170 lignes) et du dialogue de création d'élève
(`create-student-dialog.tsx`, 285 lignes), ainsi que leur rendu mobile, n'ont pas été relus en
détail.

### Workflow 14 — Périodes, niveaux, classes

#### Majeur

**M14-1 — Le chevauchement de périodes utilise des bornes fermées, contrairement à la règle.**
- `src/gateways/period-gateway.ts:26-35` compare avec `lte` / `gte`. `docs/business-rules.md`
  définit des intervalles semi-ouverts.
- La fonction pure `src/domain/period.ts:29-43` (`checkOverlap`) respecte la règle, mais elle n'est
  utilisée que par les tests : c'est du code mort.
- Scénario : la période A finit le 2026-07-01T00:00 et la période B commence le 2026-07-01T00:00.
  La création de B est refusée à tort avec `overlappingPeriod`.
- Correctif : passer à `lt` / `gt` dans le gateway, ou déléguer à `checkOverlap`, et garder un seul
  propriétaire de la règle.

**M14-2 — Un nom de période en double fait planter l'action.**
- L'index unique partiel `Period(schoolId, name) WHERE isActive` existe (`prisma/schema.prisma`,
  modèle `Period`). Pourtant `src/use-cases/periods/create-period.ts:20` et
  `update-period.ts:28` n'interceptent pas P2002.
- Scénario : l'admin crée deux fois « 2026-2027 » avec des dates qui ne se chevauchent pas. Il
  obtient une erreur serveur au lieu d'un message « nom déjà pris ».
- Le nom n'est pas non plus nettoyé par `.trim()` (`src/features/periods/schemas.ts:5`), donc
  « 2026-2027 » et « 2026-2027 » suivi d'un espace coexistent.
- Correctif : mapper P2002 vers `'nameTaken'` (avec sa clé fr/en) et appliquer `.trim()` au nom.

**M14-3 — Le contrôle de réduction de capacité ne compte pas comme la règle d'occupation.**
- `src/gateways/class-period-gateway.ts:96-106` (`countEnrolled`) utilise
  `OPEN_ENROLLMENT_STATUSES` (PENDING et ACTIVE). La règle d'occupation et `checkCapacity` comptent
  aussi COMPLETED.
- Scénario : une classe a une capacité de 20 et 20 élèves, dont 5 COMPLETED. Baisser la capacité à
  15 est accepté, puis la classe apparaît pleine à 20/15.
- Correctif : utiliser un seul ensemble de statuts d'occupation, partagé par les deux chemins.

#### Mineur

**m14-1 — `setNextLevel` n'est pas atomique.**
- `src/use-cases/levels/set-next-level.ts:23-38` : la vérification `alreadyLinked` et la mise à
  jour sont séparées.
- Scénario : deux admins pointent deux niveaux vers le même successeur en même temps. La contrainte
  `@@unique([nextLevelId, schoolId])` lève P2002, non interceptée. La détection de cycle
  (`src/domain/level.ts`) est correcte.
- Correctif : intercepter P2002 et renvoyer `'alreadyLinked'`.

**m14-2 — Le dialogue d'édition de niveau enchaîne deux actions et supprime sans confirmation.**
- `dashboard/levels/_components/edit-level-dialog.tsx:93-106` appelle le renommage puis le
  chaînage, hors transaction. Si le second échoue, le nom est déjà changé et le dialogue reste
  ouvert sans l'indiquer.
- `edit-level-dialog.tsx:109-116` archive le niveau dès le clic, sans confirmation. Le libellé dit
  « Supprimer », alors que l'action archive.
- `levelGateway.deactivate` (`src/gateways/level-gateway.ts:59-69`) nettoie bien les pointeurs
  entrants, mais l'UI n'avertit pas que la progression du niveau précédent est rompue.
- Correctif : ajouter une confirmation « Archiver » qui nomme le niveau prédécesseur touché, et
  signaler un succès partiel.

**m14-3 — Des codes d'erreur de classe ne sont pas traduits.**
- `src/use-cases/class-periods/create-class-period.ts:23,26` renvoie `levelNotFound` et
  `periodNotFound`. Ces clés n'existent pas dans `classes.create.errors` (`messages/fr.json`,
  `en.json`), donc l'utilisateur voit l'erreur générique.
- La clé `levels.generateClass.errors.duplicateName` est morte : aucun code ne la produit.
- Correctif : ajouter les clés manquantes et supprimer la clé morte.

**m14-4 — Changer le niveau d'une classe déjà remplie ne déclenche aucun avertissement.**
- `src/use-cases/class-periods/update-class-period.ts:24-34`.
- Scénario : changer CP en CE1 sur une classe qui a des élèves déplace silencieusement toute la
  classe de niveau, ce qui fausse la promotion suivante. Le comportement côté UI est à vérifier.
- Correctif : refuser le changement de niveau quand la classe a des inscriptions ouvertes, ou
  demander une confirmation explicite.

**m14-5 — Les actions désactivées ne s'expliquent que par `title` (accessibilité).**
- `dashboard/periods/_components/period-row-actions.tsx` (vers les lignes 83-100) et
  `edit-level-dialog.tsx:157-158`.
- Scénario : un utilisateur au clavier ou avec un lecteur d'écran ne sait pas pourquoi
  « Supprimer » est grisé. C'est le même écart que celui listé dans « Known gaps ».
- Correctif : afficher la raison en texte visible ou via `aria-describedby`.

**m14-6 — Noms de niveaux non nettoyés côté serveur.**
- `src/features/levels/schemas.ts:5,17` n'applique pas `.trim()`. Le dialogue le fait, mais pas
  les autres appelants (MCP par exemple).
- Correctif : ajouter `.trim()` dans le schéma.

### Workflow 15 — Promotion de fin d'année

#### Majeur

**M15-1 — La promotion peut partir d'une affectation de classe terminée et promouvoir un élève
archivé.**
- `src/gateways/enrollment-gateway.ts:257-290` (`findCompletedByPeriod`) filtre `classAssignments`
  par période, mais ni par `endAt: null` ni avec un `orderBy`.
- `src/use-cases/enrollments/promote-students.ts:69,142` prend ensuite `classAssignments[0]`.
- `reassign-class.ts:29-30` ferme l'ancienne affectation et en crée une nouvelle, donc
  l'historique est conservé.
- Scénario : un élève passé de CP à CE1 en cours d'année peut être promu depuis CP, donc vers CE1
  au lieu de CE2.
- La relation `student` imbriquée n'est pas filtrée non plus, donc un élève archivé est promu.
- Correctif : filtrer `endAt: null`, ajouter `orderBy: { startAt: 'desc' }` et
  `student: { isActive: true }`.

**M15-2 — L'exécution n'est ni idempotente ni sûre en concurrence.**
- `src/use-cases/enrollments/promote-students.ts:60-64` lit `alreadyPromoted` une seule fois,
  avant la boucle.
- La transaction par élève (lignes 202-247) n'appelle pas `lockStudentInPeriod`, ne revérifie pas
  qu'une inscription existe déjà dans la période cible, et ne recompte pas la capacité.
- Scénario : un double clic, ou deux admins qui lancent la promotion en même temps. Chaque élève
  reçoit deux inscriptions PENDING dans la période cible, et les classes dépassent leur capacité.
- Correctif : dans chaque transaction, appeler `lockStudentInPeriod`, revérifier l'inscription
  existante, puis recompter la capacité.

#### Mineur

**m15-1 — La formule de la période source est recopiée sans contrôle.**
- `src/use-cases/enrollments/promote-students.ts:217-220` copie `planId` et `totalAmount`, même si
  la formule est archivée ou si son prix a changé.
- Scénario : la nouvelle année est facturée à l'ancien tarif, ou rattachée à une formule archivée.
  L'impact avec `payments_enabled` est à vérifier.
- Correctif : résoudre une formule active pour la période cible, ou laisser la formule vide pour
  qu'elle soit choisie à la validation.

**m15-2 — Règle métier dupliquée dans du code mort.**
- `src/domain/promotion.ts` (`isEligibleForPromotion`) n'est utilisé que par
  `src/domain/__tests__/promotion.test.ts`, alors que `docs/business-rules.md` le désigne comme
  propriétaire de la règle. Le use case réimplémente l'éligibilité.
- Correctif : faire appeler la fonction du domaine par le use case, ou la supprimer et mettre la
  doc à jour.

**m15-3 — La revalidation après promotion est trop étroite.**
- `(dashboard)/_lib/enrollment-actions.ts:92-98` ne revalide que `/dashboard/enrollments`.
- Scénario : après une promotion, les effectifs des pages classes et périodes restent périmés
  jusqu'à la prochaine navigation dynamique (à vérifier selon le cache de ces pages).
- Correctif : revalider aussi `/dashboard/classes`, `/dashboard/periods` et `/dashboard/students`.

**m15-4 — Dialogue de promotion : rapport peu lisible et aperçu trop opaque.**
- Fichier : `dashboard/periods/_components/promote-period-dialog.tsx`. Le parcours
  aperçu → confirmation → rapport est bien fait, avec un try/catch.
- Ligne 184 : le rapport affiche l'UUID brut `{studentId}` pour les erreurs. La répartition des
  motifs d'exclusion est perdue.
- L'aperçu ne liste pas les élèves concernés, et n'indique pas que les inscriptions créées sont
  PENDING et doivent être validées.
- Le bouton de confirmation reste actif quand 0 élève serait promu.
- Correctif : afficher le nom de l'élève et le détail des motifs, mentionner l'état PENDING, et
  désactiver la confirmation quand il n'y a rien à promouvoir.

**m15-5 — La cible de promotion n'est filtrée que dans l'UI.**
- `dashboard/periods/page.tsx` ne propose que les périodes postérieures (`startAt >`), mais le
  serveur ne vérifie pas cet ordre.
- Scénario : un appel direct à l'action (ou via MCP) promeut vers une période antérieure.
- Correctif : refuser côté use case une période cible qui ne commence pas après la source.

**m15-6 — Des cas ne sont pas testés.**
- `promote-students.test.ts` couvre l'éligibilité, la parité aperçu/exécution et une transaction
  par élève.
- Il ne couvre ni la réaffectation en cours d'année (M15-1) ni la double exécution (M15-2).
- Correctif : ajouter ces deux cas.

## 3. Top 5 des actions prioritaires

1. **Fermer l'IDOR inter-écoles** : placer `schoolId` et `id` après `...data` dans
   `family-actions.ts:44` et `student-actions.ts:56`, retirer `schoolId` des schémas d'entrée, et
   ajouter un test qui injecte un `schoolId` étranger (C13-1).
2. **Réparer la suppression définitive** : supprimer les `AttendanceEntry` dans `deleteWithRelated`,
   les compter dans l'impact, et ajouter le cas au test d'intégration (C13-2).
3. **Fiabiliser la promotion** : filtrer `endAt: null` avec un `orderBy`, exclure les élèves
   archivés, et utiliser `lockStudentInPeriod` avec une revérification dans chaque transaction
   (M15-1, M15-2).
4. **Aligner les règles de période** : chevauchement semi-ouvert via `checkOverlap`, P2002 mappé vers
   `nameTaken`, et noms nettoyés par `.trim()` (M14-1, M14-2).
5. **Unifier l'occupation des classes** : un seul ensemble de statuts (COMPLETED compris) pour
   `countEnrolled` et `checkCapacity`, plus un verrou par classe dans les ajouts et la promotion
   (M14-3, M13-4).
