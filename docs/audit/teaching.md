# Audit — groupe `teaching` (workflows 16, 17, 18)

Périmètre :

- **16** : emploi du temps et créneaux.
- **17** : présences (appel planifié ou ad hoc, « tous présents », validation, annulation).
- **18** : enseignants (accès, archivage, suppression, notes de frais).

Méthode : chaque workflow est tracé page → server action → use case → domaine/gateway → Prisma, en lecture seule.
Les constats marqués « à vérifier » n'ont pas été reproduits à l'exécution.
Les numéros de ligne correspondent à l'état du dépôt au moment de l'audit (branche `chore/dependabot`, commit `87b0585`).

## 1. Synthèse

| Workflow | Solide | Simple | UX | UI | Verdict |
|---|---|---|---|---|---|
| 16 Emploi du temps | 3/5 | 3/5 | 3/5 | 3/5 | Concurrence bien verrouillée, mais modifier ou supprimer un créneau casse l'historique (présences, enseignants archivés). |
| 17 Présences | 2/5 | 2/5 | 3/5 | 4/5 | UI soignée et accessible, mais l'appel du jour exclut les nouveaux élèves et les transitions d'annulation perdent des validations. |
| 18 Enseignants | 3/5 | 4/5 | 3/5 | 3/5 | Archivage transactionnel correct, mais on peut inviter un profil archivé et saisir des montants hors bornes Decimal. |

## 2. Constats par workflow

### 16 — Emploi du temps et créneaux

Chaîne : `dashboard/planning/page.tsx` → `_lib/class-schedule-actions.ts` → `src/use-cases/class-schedules/class-schedule-slot.ts` → `src/domain/class-schedule.ts` → `src/gateways/class-schedule-gateway.ts` → Prisma.
La base porte une contrainte `EXCLUDE GIST` (`prisma/migrations/20260916130000_enforce_class_schedule_no_overlap/migration.sql`).

Points solides :

- `requireSchoolAdmin` est appelé en tête de chaque action.
- Le schéma Zod est strict.
- Des verrous consultatifs s'ajoutent à la contrainte d'exclusion, et des tests de concurrence existent (`class-schedule-concurrency.test.ts`).
- Les messages d'erreur sont traduits en fr et en en.

#### Majeur

- **La suppression d'un créneau qui a des présences provoque une erreur 500.**
  - Où : `src/use-cases/class-schedules/class-schedule-slot.ts:132-135`, avec la FK `AttendanceSession.classScheduleSlot` en `onDelete: Restrict`.
  - Scénario : l'appel du mardi a été fait sur un créneau, puis l'admin clique « Supprimer ». `scheduleGw.delete` lève P2003 et rien ne l'intercepte. `delete-schedule-slot-dialog.tsx:13-20` n'a pas de `try/catch`, donc l'action rejette et l'utilisateur ne voit aucun message.
  - Correction : compter les sessions avant de supprimer et renvoyer `slotInUse` (clé i18n à ajouter), ou archiver le créneau au lieu de le supprimer.
- **Modifier un créneau efface le lien avec un enseignant archivé.**
  - Où : `src/gateways/class-schedule-gateway.ts:91-96`, qui fait `deleteMany` puis `createMany` avec les seuls ids soumis. Les options ne contiennent que les enseignants actifs (`planning/page.tsx:105`), et le MultiSelect ne soumet que les ids présents dans ses options (`src/components/ui/multi-select/multi-select.tsx:90,190`).
  - Scénario : un enseignant est archivé, puis l'admin corrige l'heure du créneau. La ligne `ClassScheduleSlotTeacher` de l'enseignant archivé disparaît en silence, ce qui contredit la règle « Archiving preserves history… planning rows remain » de `docs/business-rules.md`.
  - Correction : dans `update`, ne supprimer que les liens vers des enseignants actifs absents de la saisie, et conserver les liens inactifs.
- **Déplacer un créneau vers un autre jour rend ses présences passées inaccessibles.**
  - Où : `my-classes/[id]/attendance/page.tsx:46-54` filtre les créneaux sur `weekday: planningWeekday(occurredOn)`, et la l.71 renvoie `notFound()` si le `slotId` n'y figure pas. La page de suivi `dashboard/attendance/page.tsx` calcule elle aussi les occurrences attendues à partir du weekday actuel.
  - Scénario : un cours passe du mardi au jeudi. Les appels des mardis précédents renvoient 404 et disparaissent du suivi.
  - Correction : refuser le changement de weekday quand des sessions existent (il faut alors créer un nouveau créneau), ou retrouver l'historique par `occurrenceKey` sans filtrer sur le weekday.
- **Le contrôle de chevauchement des enseignants ignore la période et l'état de la classe.**
  - Où : `src/gateways/class-schedule-gateway.ts:70-80`, sans filtre sur `classPeriod.periodId` ni sur `classPeriod.isActive`.
  - Scénario : M. X enseignait le lundi de 10h à 11h en 2025-2026. Le planifier au même horaire en 2026-2027 déclenche `teacherOverlap`, qui bloque si `class_schedule_teacher_overlap_allowed=false` et affiche un faux avertissement sinon.
  - Correction : restreindre la recherche aux créneaux des classes actives de la même période.

#### Mineur

- **La modification valide contre une classe différente de celle qui est enregistrée.**
  - Où : `class-schedule-slot.ts:96-119` valide avec le `classPeriodId` soumis, alors que le gateway retire `classPeriodId` de la mise à jour (`class-schedule-gateway.ts:85`).
  - Scénario : un appel direct à l'action avec une autre classe contrôle les chevauchements et l'affectation des enseignants sur la mauvaise classe. L'UI ne le permet pas, car le select est désactivé (`schedule-slot-dialog.tsx:119,125`).
  - Correction : pour une mise à jour, relire le créneau et valider contre son `classPeriodId` enregistré.
- **La lecture du flag est incohérente.**
  - Où : `src/use-cases/class-schedules/is-class-schedule-enabled.ts:8` compare `config?.value === 'true'`, alors que la présence et les notes de frais utilisent `readsAsOptedIn`.
  - Scénario : une valeur `"TRUE"` ou `"1"` active une fonctionnalité et pas l'autre.
  - Correction : utiliser `readsAsOptedIn` partout.
- **L'éditeur de description repose sur `document.execCommand`, qui est déprécié.**
  - Où : `schedule-slot-dialog.tsx:84-88`.
  - Scénario : le gras, l'italique ou les listes deviennent imprévisibles selon le navigateur, et le collage de HTML riche n'est pas nettoyé avant la sérialisation.
  - Correction : utiliser un `textarea` Markdown avec aperçu, ou un éditeur minimal maintenu.
- **Le planning affiché à l'admin peut montrer des enseignants archivés, mais pas dans le formulaire.**
  - Où : `planning/page.tsx:80-92` ne filtre pas les enseignants, alors que `slotInclude` le fait.
  - Scénario : la grille et le formulaire d'édition ne montrent pas la même liste d'enseignants. À vérifier visuellement.
  - Correction : afficher les enseignants archivés avec un badge « archivé » dans les deux vues.

### 17 — Présences

Chaîne : `my-classes/page.tsx` / `my-classes/[id]/attendance/page.tsx` / `dashboard/attendance/page.tsx` → `_lib/attendance-actions.ts`, puis **directement** `db`. Il n'y a ni use case ni gateway. Le domaine pur (`attendance-date`, `attendance-closure`, `attendance-tracking`, `current-week-dates`) est testé.

Points solides :

- L'ouverture passe par une transaction, et P2002 est géré en concurrence (`attendance-actions.ts:130-181`).
- L'autosave sérialise les écritures par entrée et avertit par `beforeunload`.
- Les cartes utilisent `aria-pressed`, des cibles tactiles `min-h-14` et des alertes `role="alert"`.
- La validation partielle est signalée.

#### Critique

- **Un élève affecté le jour même n'apparaît pas dans l'appel du jour.**
  - Où : `attendance-actions.ts:140-147` filtre `startAt: { lte: occurredOn }`, où `occurredOn` vaut minuit UTC. Or `ClassAssignment.startAt` est un `DateTime` horodaté à la création (`create-enrollment.ts:134`, `create-enrolled-student.ts:131`, `promote-students.ts:230`, `commit-enroll-family.ts:236`, tous en `new Date()`).
  - Scénario : un élève est inscrit à 9h, et l'enseignant ouvre l'appel à 10h. L'élève est absent de la liste, et comme le roster est figé à l'ouverture, il n'existe aucun moyen de l'ajouter.
  - Correction : comparer `startAt < occurredOn + 1 jour` et ajouter une action « actualiser la liste » qui insère les affectations manquantes tant que la session est en DRAFT.
- **Rétablir une session non annulée la remet en DRAFT et perd sa validation.**
  - Où : `attendance-actions.ts:284-297`. La branche `cancelled: false` applique `status: session.statusBeforeCancellation ?? 'DRAFT'` sans vérifier que `status === 'CANCELLED'`. La lecture (l.267) et l'écriture (l.284) ont lieu hors transaction.
  - Scénario : un onglet périmé ou un double clic sur « Rétablir » (`cancel-attendance-form.tsx:52-64`, où `router.refresh` n'est pas attendu) touche une session VALIDATED. Elle repasse en DRAFT sans message, et `validatedAt` reste renseigné.
  - Correction : rendre la transition conditionnelle (`updateMany where: { status: 'CANCELLED' }` pour le rétablissement, `status: { not: 'CANCELLED' }` pour l'annulation) et renvoyer `invalidTransition` quand `count === 0`.

#### Majeur

- **Les annulations ignorent le flag `attendance_enabled` et les fermetures.**
  - Où : `setAttendanceCancellationAction` (l.260-302) et `cancelAttendanceOccurrenceAction` (l.304-361) n'appellent pas `enabled()`. La seconde ne teste pas non plus `isAttendanceClosed`.
  - Scénario : après la désactivation de la présence, un admin qui a gardé la page ouverte peut encore créer ou supprimer des sessions. C'est contraire à la règle « every server mutation refuses it ».
  - Correction : ajouter le garde `attendanceDisabled` en tête des deux actions.
- **La logique métier est entièrement dans la server action.**
  - Où : `attendance-actions.ts` (361 lignes). Roster, transitions et annulations appellent `db` directement.
  - Scénario : les règles de transition (DRAFT, VALIDATED, CANCELLED) ne sont ni centralisées ni testables sans mocker Prisma, ce qui a laissé passer le bug de rétablissement. Contraire à `.agents/rules/clean-architecture.md`.
  - Correction : extraire les use cases `open-attendance`, `update-entry` et `set-cancellation`, un `attendance-gateway` et une fonction de domaine pure pour les transitions de statut.
- **Une session annulée renvoie un 404 au lieu d'une explication.**
  - Où : `my-classes/[id]/attendance/page.tsx:93` appelle `notFound()`. La branche CANCELLED de `attendance-panel.tsx:384` est donc du code mort.
  - Scénario : l'enseignant suit un lien vers l'appel du jour que l'admin vient d'annuler et tombe sur une page 404.
  - Correction : afficher le panel en lecture seule avec le message « séance annulée » qui existe déjà.
- **Chaque tap bloque l'appel sur un réseau lent.**
  - Où : les boutons de statut sont désactivés pendant la sauvegarde (`student-attendance-card.tsx:175`), et l'appel se fait un élève à la fois, sans avance automatique (`attendance-panel.tsx`).
  - Scénario : sur une 4G faible, en classe, l'appel de 25 élèves demande environ 50 taps avec une attente après chacun, et le focus clavier se perd sur un bouton désactivé.
  - Correction : faire une mise à jour optimiste sans désactiver les boutons (la file de promesses par entrée existe déjà) et passer à l'élève suivant après le choix d'un statut.
- **Les occurrences attendues sont fausses hors période ou avant la création du créneau.**
  - Où : `dashboard/attendance/page.tsx` calcule les occurrences attendues pour n'importe quelle date à partir des créneaux actuels, sans borne `period.startAt/endAt` ni `slot.createdAt`.
  - Scénario : l'admin filtre sur une semaine de juillet ou antérieure au créneau et voit de faux « Non commencé ».
  - Correction : borner les occurrences par les dates de la période et par la date de création du créneau.

#### Mineur

- **`resolveOperableSession` renvoie `notFound` quand la présence est désactivée.**
  - Où : `attendance-actions.ts:79-80`, alors que l'ouverture renvoie `attendanceDisabled` (l.96).
  - Correction : renvoyer `attendanceDisabled` pour obtenir un message cohérent.
- **Le flag est lu par une requête brute, un motif que les règles métier disent supprimé ailleurs.**
  - Où : `attendance-actions.ts:58-64` et la page `my-classes/[id]/attendance`.
  - Correction : créer un `isAttendanceEnabled(schoolId)` en cache, comme `is-teacher-expenses-enabled.ts`.
- **Aucune borne de date.**
  - Où : `openAttendance` (l.89-181) accepte n'importe quelle date, et le sélecteur de date du panel n'a pas d'attribut `max`.
  - Scénario : un appel peut être ouvert en 2099.
  - Correction : refuser une date postérieure à aujourd'hui (fuseau de l'école) ou hors de la période de la classe.
- **La date du jour est calculée en UTC.**
  - Où : `my-classes/page.tsx:35` (`new Date().toISOString()`).
  - Scénario : une école en UTC-5 qui consulte la page à 20h voit le lendemain.
  - Correction : calculer la date locale de l'école.
- **La mise à jour d'une entrée n'actualise pas sa session.**
  - Où : `attendance-actions.ts:198-225` met à jour `updatedById` sur l'entrée mais pas sur la session.
  - Scénario : une correction après validation laisse la session sans trace de qui l'a modifiée. Il n'y a pas de rafraîchissement entre utilisateurs, et c'est la dernière écriture qui gagne.
  - Correction : mettre à jour `session.updatedById` dans la même transaction.
- **Mauvais titre pour un enseignant qui est aussi parent.**
  - Où : `dashboard/attendance/page.tsx:101` teste `context.role === 'TEACHER'`.
  - Scénario : un parent qui est aussi enseignant obtient un titre 404 alors que la page fonctionne.
  - Correction : utiliser le même critère de capacité enseignant que la page.
- **Pas de confirmation pour le rétablissement, et `attendanceClosed` n'a pas de message dans `cancel-attendance-form.tsx`.**
  - Correction : ajouter un `ConfirmDialog` pour le rétablissement et un mapping d'erreur complet.

### 18 — Enseignants

Chaîne : `dashboard/teachers/page.tsx` → `_lib/teacher-actions.ts` → `src/use-cases/teachers/*` → `src/gateways/teacher-gateway.ts` → Prisma.

Points solides :

- Toutes les actions commencent par `requireSchoolAdmin`.
- L'archivage passe par une transaction sérialisable qui délie l'utilisateur et retire le membre TEACHER seul (`teacher-gateway.ts:56-82`).
- La suppression est bloquée par toute dépendance (l.84-110).
- L'archivage et la suppression passent par un `ConfirmDialog`, et les clés `errors.*` sont alignées en fr et en en.
- L'onglet des notes de frais est masqué quand le flag est désactivé.

#### Majeur

- **On peut inviter et lier un enseignant archivé, ce qui mène à une impasse.**
  - Où : `_lib/invitation-actions.ts:71-76` ne teste pas `isActive`. `invite/[token]/_lib/link-invited-user.ts:44-49` lie avec `userId: null` sans filtrer `isActive`. Enfin, l'archivage ne révoque pas les invitations en attente (`teacher-gateway.ts:56-82`).
  - Scénario : un enseignant est invité puis archivé avant d'accepter. Il accepte ensuite l'invitation, le compte est lié au profil archivé, et `requireTeacher` (`auth-helper.ts:84-98`) renvoie `notFound()` sur chaque page.
  - Correction : refuser l'invitation et la liaison si `isActive = false`, et révoquer les invitations en attente dans la transaction d'archivage.
- **Le montant d'une note de frais n'est pas borné par rapport à `Decimal(10,2)`.**
  - Où : `src/use-cases/teachers/schemas.ts:25` (`z.number().positive()`).
  - Scénario : un montant de 1e9 déclenche un overflow Postgres et une erreur 500. Un montant de 12,345 est arrondi en silence. Un `paidAt` antérieur à `requestedAt` est accepté.
  - Correction : ajouter `.max(99_999_999.99)` et un `multipleOf(0.01)`, puis un `refine` qui impose `paidAt >= requestedAt`.
- **Aucun cycle de vie pour les notes de frais.**
  - Où : `teacher-actions.ts` n'expose que la création. `teachers/page.tsx:59-63` liste tout, sans pagination ni filtre de période.
  - Scénario : une note saisie par erreur ou payée plus tard ne peut être ni corrigée, ni supprimée, ni marquée payée. La liste grossit sans limite.
  - Correction : ajouter les actions « marquer payée » et « archiver », avec un filtre par période.

#### Mineur

- **Une note de frais peut viser un enseignant archivé.**
  - Où : `create-teacher-expense.ts` appelle `teacherGw.findById` sans tester `isActive`. L'UI ne propose que les enseignants actifs (`teachers/page.tsx:67-70`).
  - Correction : filtrer sur `isActive` dans le use case.
- **Le retrait d'accès contourne la couche use case.**
  - Où : `teacher-actions.ts`, où `revokeTeacherAccessAction` appelle le gateway directement.
  - Correction : ajouter un use case `revoke-teacher-access` avec validation et tests.
- **Pas de détection de doublon à la création.**
  - Où : `create-teacher.ts`.
  - Scénario : deux profils sont créés avec le même e-mail, ce qui rend la liaison par invitation ambiguë.
  - Correction : ajouter un contrôle d'unicité `(schoolId, email)` quand l'e-mail est renseigné.
- **Les archives sont invisibles et ne peuvent pas être restaurées.**
  - Où : `teachers/page.tsx:42` filtre sur `isActive: true`.
  - Scénario : un enseignant archivé par erreur ne peut pas être réactivé depuis l'UI. À vérifier : aucune action de restauration n'a été trouvée.
  - Correction : ajouter un filtre « archivés » et une action de restauration.
- **Aucun test pour l'archivage, la suppression et le retrait d'accès dans les use cases.** Seul le gateway est couvert, et cette couverture est à vérifier.
  - Correction : ajouter des tests qui vérifient les résultats typés (`teacherInUse`, `alreadyUnlinked`).

## 3. Top 5 des actions prioritaires

1. **Corriger le roster de l'appel** (`attendance-actions.ts:140-147`) : borner `startAt` à la fin de la journée et permettre d'actualiser la liste d'une session en DRAFT.
2. **Rendre les transitions d'annulation atomiques et conditionnelles au statut** (`attendance-actions.ts:260-361`), avec le garde `attendanceDisabled` dans les deux actions et un résultat `invalidTransition`.
3. **Protéger l'historique des créneaux** : refuser, avec un résultat typé, la suppression ou le changement de weekday d'un créneau qui a des sessions (`class-schedule-slot.ts:132-135`, `my-classes/[id]/attendance/page.tsx:46-71`), et conserver les liens vers les enseignants archivés (`class-schedule-gateway.ts:91-96`).
4. **Fermer la voie des enseignants archivés** : refuser invitation et liaison si `isActive = false`, révoquer les invitations en attente à l'archivage, et borner le montant des notes de frais à `Decimal(10,2)`.
5. **Extraire la présence en use cases et gateway**, avec les transitions de statut en domaine pur, un flag unifié (`readsAsOptedIn` en cache) et un appel mobile non bloquant (mise à jour optimiste et avance automatique).
