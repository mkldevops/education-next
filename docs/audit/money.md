# Audit — groupe `money` (workflows 1 à 5)

Périmètre : paiement manuel et remboursements, paiement en ligne Stripe, cycle de vie d'une
inscription, activation des paiements par école (`payments_enabled`), plans. Code lu de bout en
bout (composant → action → use-case → domaine → gateway/Prisma). Les 47 fichiers de test du
périmètre passent (`vitest run src/use-cases/{payments,enrollments,plans} src/domain
app/api/stripe …` : 478 tests OK).

Chemins abrégés : `_lib/` = `app/[locale]/(dashboard)/_lib/`, `dash/` =
`app/[locale]/(dashboard)/dashboard/`.

## 1. Synthèse

| # | Workflow | Solide | Simple | UX | UI | Verdict |
|---|---|---|---|---|---|---|
| 1 | Paiement manuel, solde, remboursements | 2/5 | 3/5 | 2/5 | 3/5 | Répartition juste, mais pas de verrou (double saisie = trop-perçu) et aucun remboursement ni aucune correction possibles depuis l'UI |
| 2 | Paiement en ligne Stripe | 2/5 | 4/5 | 3/5 | 3/5 | Idempotence soignée côté événement, mais un paiement Stripe encaissé peut rester sans ligne `Payment` (sessions multiples ou solde modifié entre-temps) |
| 3 | Cycle de vie d'une inscription | 3/5 | 3/5 | 2/5 | 3/5 | Création solide (verrou + transaction), mais réaffectation hors période, capacité non sérialisée et annulation sans confirmation |
| 4 | Activation des paiements par école | 4/5 | 4/5 | 3/5 | 4/5 | Garde bien placée dans chaque use-case ; quelques clés d'erreur manquantes et un lien « Payer » qui mène à une impasse |
| 5 | Plans / tarifs | 3/5 | 4/5 | 2/5 | 3/5 | Règles métier respectées, mais un nom en double fait planter la page et l'archivage part en un clic |

## 2. Constats par workflow

### Workflow 1 — Paiement manuel, solde famille, remboursements

**Critique**

- **C1.1 : double enregistrement concurrent, trop-perçu silencieux.**
  `src/use-cases/payments/record-payment.ts:21-37` lit les soldes (`findPayableByFamily`) **hors
  transaction**, puis écrit via `paymentGateway.createInTransaction`
  (`src/gateways/payment-gateway.ts:29`), une transaction « tableau » sans relecture ni verrou.
  Scénario : solde famille 720 €. Deux administrateurs (ou deux onglets, ou un double envoi après
  un timeout réseau) enregistrent 720 € en même temps. Les deux lisent 720 et passent la garde
  `overpayment`, ce qui écrit 1 440 € de lignes `Payment`. `remainingBalance` étant borné à 0
  (`family-balance.ts:60`), rien n'affiche le trop-perçu. La même course existe entre le
  paiement manuel et le webhook Stripe (voir C2.1).
  *Correction :* dans une transaction interactive, poser `acquireAdvisoryLock(tx,
  'payment:{schoolId}:{familyId}')`, relire les soldes, répartir puis écrire. Le webhook doit
  prendre le même verrou.

**Majeur**

- **M1.1 : les remboursements, documentés, sont inaccessibles depuis l'UI.** La règle métier
  prévoit « a negative amount is a refund » (`docs/business-rules.md`, *Refunds*), mais :
  (a) le champ montant impose `min="0.01"` (`dash/payments/_components/record-payment-dialog.tsx:132`),
  (b) le bouton « Enregistrer un paiement » est désactivé dès que le solde vaut 0
  (`dash/families/[id]/_components/hero-banner.tsx:59`, `canRecordPayment={remainingBalance > 0}`),
  alors que c'est justement le cas d'une famille à rembourser. `refundExceedsPaid` a une
  traduction qu'aucun parcours ne peut atteindre.
  *Correction :* ajouter une action « Rembourser » distincte (montant positif saisi, négatif
  envoyé), accessible dès que `totalPaid > 0`, avec une confirmation.
- **M1.2 : aucune correction possible d'un paiement erroné.** Aucune action ne désactive ni
  n'annule une ligne `Payment` (`payment-gateway.ts` n'expose que `create*`), et le remboursement
  est bloqué (M1.1). Scénario : un admin saisit 1 800 € au lieu de 180 € sur une famille qui en
  doit 1 800. L'erreur devient définitive et seul un accès base permet de la corriger.
  *Correction :* ajouter « annuler ce paiement », qui désactive toutes les lignes du groupe
  (`groupFamilyPayments`) avec une confirmation, ou débloquer le remboursement.
- **M1.3 : remboursement limité aux inscriptions ouvertes.** `distributeRefund`
  (`src/domain/payment.ts:82-99`) ne reçoit que les inscriptions `PENDING`/`ACTIVE`
  (`record-payment.ts:21`). Scénario : famille avec une seule inscription `COMPLETED` payée
  180 €. Un remboursement de 50 € renvoie `noPayableEnrollments`, alors que la règle dit
  « refunding more than the family **ever** paid → refundExceedsPaid ».
  *Correction :* pour un montant négatif, répartir sur les inscriptions portant des paiements
  actifs, quel que soit leur statut, ou documenter la restriction.
- **M1.4 : aucune confirmation avant d'enregistrer de l'argent.** Une saisie irréversible
  (voir M1.2) part au premier clic (`record-payment-dialog.tsx:89-103`), sans récapitulatif
  famille, montant et répartition.
  *Correction :* afficher avant l'envoi un récapitulatif avec la ventilation calculée, ou au
  minimum rappeler le solde restant après paiement.

**Mineur**

- **m1.1 : date par défaut en UTC.** `defaultValue={new Date().toISOString().split('T')[0]}`
  (`record-payment-dialog.tsx:219`). Entre 00:00 et 02:00, heure de Paris, la date pré-remplie
  est celle de la veille. Aucune borne `max` : une date future passe, puis disparaît du
  graphique (règle « never runs past the current month »).
  *Correction :* calculer la date locale et ajouter `max` = aujourd'hui.
- **m1.2 : focus clavier invisible sur le mode de paiement.** Les boutons radio sont en
  `sr-only` et le `<label>` n'a aucun style `focus-within`
  (`record-payment-dialog.tsx:173-189`). Au clavier, on ne voit pas quel mode a le focus.
  *Correction :* ajouter `has-[:focus-visible]:ring-2` (ou `focus-within`) sur le label.
- **m1.3 : branche morte du sélecteur de famille.** Le seul appelant passe une seule famille
  (`dash/families/[id]/page.tsx:157-163`), donc la branche `<Select>` de
  `record-payment-dialog.tsx:112-121` et `showTrigger = true` sont du code mort. Si elle était
  réactivée, la première famille serait présélectionnée sans option vide, donc un risque de
  paiement sur la mauvaise famille.
  *Correction :* supprimer la branche, ou ajouter une option vide obligatoire.
- **m1.4 : `/dashboard/payments` charge tout l'historique.** `dash/payments/page.tsx:48-64` lit
  toutes les lignes `Payment` de l'école sans pagination, avec `family` et `person` complets.
  Le coût grandit avec l'historique, contrairement aux statistiques, agrégées en base.
  *Correction :* restreindre la projection (`select`) et filtrer par période côté base.
- **m1.5 : le bouton désactivé ne s'explique que par `title`.** Déjà listé dans *Known gaps*
  (`action-menu.tsx:50-51`), non corrigé.
- **m1.6 : aucun test d'action pour `recordPaymentAction`**, aucun test de concurrence, et aucun
  test de remboursement au niveau du use-case (le domaine en a :
  `src/domain/__tests__/payment.test.ts`).

### Workflow 2 — Paiement en ligne Stripe

**Critique**

- **C2.1 : un paiement Stripe capturé peut rester sans aucune ligne `Payment`.**
  `complete-checkout-session.ts:40-42` recalcule le solde **au moment du webhook** et renvoie
  `overpayment` si le montant de la transaction dépasse ce qui reste dû. La route répond alors
  422 (`app/api/stripe/webhook/route.ts:39`). Stripe rejoue pendant trois jours, avec le même
  refus, et l'argent reste encaissé chez Stripe sans trace locale (transaction `PENDING`). Deux
  scénarios concrets :
  1. Le parent clique « Payer 720 € », revient en arrière et reclique, ou un second parent de
     la même famille paie. `createCheckoutSession` (`create-checkout-session.ts:23-35`) ouvre
     une nouvelle session à chaque appel, sans vérifier qu'une transaction `PENDING` existe
     déjà. Les deux sessions sont payées, la première est enregistrée et la seconde échoue en
     `overpayment`.
  2. Le parent ouvre le checkout, puis l'admin enregistre au guichet un chèque de 100 €. Le
     webhook arrive avec 720 € pour 620 € restants, donc `overpayment`.

  *Correction :* au webhook, ne jamais refuser un paiement capturé. Répartir jusqu'au solde et
  enregistrer l'excédent comme crédit ou trop-perçu (ou le rembourser via l'API Stripe), puis
  répondre 200. À la création, réutiliser ou expirer (`sessions.expire`) la session `PENDING`
  de la famille.

**Majeur**

- **M2.1 : webhook non sérialisé avec les autres écritures.** Le contrôle
  `transaction.status === 'SUCCEEDED'` et la lecture du solde (`complete-checkout-session.ts:32-41`)
  se font hors transaction, et l'`update` final (`:72-79`) ne porte pas `status: 'PENDING'` dans
  son `where`. Seul l'unique sur `providerEventId` protège, donc un même événement. Deux
  événements distincts pour la même session (`completed` + `async_payment_succeeded`, ou un
  rejeu manuel depuis le tableau de bord Stripe, qui crée un nouvel id) pourraient écrire deux
  fois. C'est peu probable, mais aucun garde ne l'empêche.
  *Correction :* dans la transaction, faire un `updateMany({ where: { id, status: 'PENDING' } })`
  et abandonner si `count === 0`, avec le verrou famille de C1.1.
- **M2.2 : `notPaid` et `notFound` renvoient 422, d'où des rejeux inutiles.** Un
  `checkout.session.completed` avec `payment_status: 'unpaid'` (paiement asynchrone, par
  exemple SEPA) est normal. Y répondre 422 fait rejouer Stripe pendant trois jours pour un
  événement que le code ne traitera jamais (`route.ts:35-39`). Même chose pour une session
  d'un autre environnement partageant le compte Stripe.
  *Correction :* répondre 200 (ignoré) pour `notPaid`/`notFound`, et garder le 4xx/5xx pour
  les erreurs réellement réessayables.
- **M2.3 : aucune transaction `PENDING` n'est jamais clôturée.** Les événements
  `checkout.session.expired` et `async_payment_failed` ne sont pas traités (`route.ts:22-27`).
  Chaque checkout abandonné laisse une ligne `PENDING`, et `countFootprint`
  (`payment-gateway.ts:76-83`) les annonce dans la confirmation de coupure des paiements comme
  « transactions en attente », un chiffre qui ne fait que grossir.
  *Correction :* passer la transaction en `FAILED`/`EXPIRED` sur ces deux événements.

**Mineur**

- **m2.1 : libellé Stripe figé en français.** `product_data.name: 'Frais de scolarité'`
  (`create-checkout-session.ts:58`) ignore `input.locale` : un parent anglophone lit du
  français sur la page Stripe. *Correction :* passer un libellé traduit.
- **m2.2 : URL de retour par défaut sur localhost.** `NEXT_PUBLIC_APP_URL` absent en production
  fait retomber sur `http://localhost:8550` (`_lib/online-payment-actions.ts:25`), et le parent
  est renvoyé vers localhost après paiement. *Correction :* renvoyer `notConfigured` si la
  variable manque hors développement.
- **m2.3 : erreurs réduites à un message générique.** `paymentsDisabled`, `providerError`,
  `unauthorized` et `invalidInput` donnent tous « Impossible de démarrer le paiement »
  (`online-payment-button.tsx:29-31`), un mapping codé en dur au lieu de `toastActionError`.
  *Correction :* ajouter un bloc `errors` et passer par `t.has`.
- **m2.4 : tests.** Aucun test pour `overpayment` ou `currencyMismatch` au webhook, pour deux
  sessions concurrentes, ni pour `createOnlinePaymentAction` (refus admin, parent sans famille).

### Workflow 3 — Cycle de vie d'une inscription

**Critique**

Aucun.

**Majeur**

- **M3.1 : la réaffectation traverse les périodes et contourne la règle « une inscription par
  élève et par période ».** `reassignClass` (`src/use-cases/enrollments/reassign-class.ts:22-33`)
  ne compare pas la période de la nouvelle classe à celle de l'inscription, ne prend pas
  `lockStudentInPeriod` et ne cherche pas de doublon. La page détail propose toutes les classes
  actives de l'école, toutes périodes confondues et sans nom de période
  (`dash/enrollments/[id]/page.tsx:108-113`). Scénario : l'élève a E1 (2025-26, classe A) et E2
  (2026-27, classe C). L'admin réaffecte E1 vers la classe D de 2026-27, ce qui donne deux
  inscriptions ouvertes sur 2026-27, facturées deux fois dans le solde famille.
  *Correction :* refuser `periodMismatch` si `classPeriod.periodId` diffère de la période de
  l'affectation courante, et filtrer les options sur cette période.
- **M3.2 : capacité non sérialisée entre élèves différents.** Le verrou de
  `create-enrollment.ts:76-81` porte sur (école, élève, période), pas sur la classe. Sous READ
  COMMITTED (défaut Postgres, aucun niveau d'isolation passé à `db.$transaction`), deux
  créations simultanées pour deux élèves dans une classe à 19/20 comptent chacune 19 et passent
  toutes les deux, ce qui donne 21/20. La règle écrite « two concurrent enrollments cannot both
  pass the check » est donc fausse. `reassignClass` compte même hors transaction
  (`reassign-class.ts:25-33`).
  *Correction :* ajouter `acquireAdvisoryLock(tx, 'class:{classPeriodId}')` avant le comptage
  dans les trois chemins (création, élève inscrit, réaffectation dans une transaction).
- **M3.3 : deux définitions de la capacité.** La création compte les inscriptions
  `PENDING`/`ACTIVE`/`COMPLETED` à affectation ouverte (`create-enrollment.ts:106-113`), la
  réaffectation seulement `PENDING`/`ACTIVE` (`class-period-gateway.ts:96-106`), et
  `completeEnrollment` ne ferme pas l'affectation (`complete-enrollment.ts:19`). Scénario :
  classe de 20 avec 20 inscriptions terminées. La création renvoie `classFull`, mais la
  réaffectation accepte un 21e élève.
  *Correction :* une seule fonction de comptage partagée, avec la règle documentée.
- **M3.4 : annuler et terminer partent en un clic, sans confirmation.**
  `dash/enrollments/_components/enrollment-actions.tsx:64-90` appelle directement
  `cancelEnrollmentAction` et `completeEnrollmentAction`. Or `CANCELLED` et `COMPLETED` sont
  terminaux (`src/domain/enrollment.ts:8-13`). Un clic de trop sur « Annuler », placé à côté
  de « Activer », est irréversible. *Correction :* passer par un `ConfirmDialog` qui nomme
  l'élève et rappelle le caractère définitif.
- **M3.5 : annulation non atomique, et course avec un paiement.** `cancel-enrollment.ts:22-25`
  contrôle les paiements, ferme l'affectation, puis change le statut, en trois requêtes hors
  transaction. Scénario : un paiement est enregistré entre le contrôle et l'`update`, et
  l'inscription passe `CANCELLED` avec un paiement, précisément l'état que #307 interdit. Si
  l'`update` échoue, l'inscription reste ouverte sans classe.
  *Correction :* une transaction avec un `update` conditionnel (`where: { status: current,
  payments: { none: { isActive: true } } }` via `updateMany`). Même motif pour
  `activate`/`complete` et pour `reassignClass` (fermer + créer).

**Mineur**

- **m3.1 : `ensureUnpriced` en concurrence.** Deux premières inscriptions simultanées pendant
  une coupure trouvent chacune « pas de formule réservée » et la créent
  (`plan-gateway.ts:47-56`). L'index unique partiel `(schoolId, name) where isActive` lève
  `P2002`, non intercepté dans `create-enrollment.ts:142-145`, d'où un 500 pour l'une des deux.
  *Correction :* `upsert`, ou intercepter `P2002` et relire.
- **m3.2 : `totalAmount` ignoré en silence pendant une coupure.** `create-enrollment.ts:37`
  refuse `planId` et `discount`, mais un `totalAmount` explicite est simplement ignoré.
  *Correction :* le refuser aussi (`paymentsDisabled`), par cohérence avec la règle « refusé,
  pas ignoré ».
- **m3.3 : la remise reprice sur le tarif courant sans prévenir.** `apply-discount.ts:23-27`
  recalcule à partir de `plan.amount` actuel (règle documentée). Si le tarif a changé depuis
  l'inscription, le total bouge alors que l'admin n'a touché qu'à la remise. Le dialogue
  (`apply-discount-dialog.tsx:66-77`) n'affiche ni le tarif ni le total résultant.
  *Correction :* afficher « tarif actuel X € » et le nouveau total avant validation.
- **m3.4 : les options de réaffectation ne disent pas la période.**
  `dash/enrollments/[id]/page.tsx:111` ne sélectionne que `name` : deux classes « CP-A » de
  périodes différentes sont indiscernables (aggrave M3.1).
- **m3.5 : `'...'` comme état de chargement** (`enrollment-actions.tsx:75,78,85,88`,
  `create-enrollment-dialog.tsx:231`). Rien n'est annoncé aux lecteurs d'écran et le texte
  n'est pas traduit. *Correction :* spinner avec `aria-busy` et libellé traduit.

### Workflow 4 — Activation des paiements par école (`payments_enabled`)

**Critique**

Aucun.

**Majeur**

- **M4.1 : clés d'erreur `paymentsDisabled` absentes, message générique.** Les use-cases
  renvoient bien `paymentsDisabled`, mais le bloc `errors` manque dans
  `dashboard.pages.payments.record` (fr/en), `plans.create` et `plans.edit`. Scénario : l'admin
  garde `/dashboard/plans` ouvert, un autre admin coupe les paiements, et « Créer » affiche
  « Erreur » au lieu de la raison. Cela contredit *Surfacing a rule in the UI*.
  *Correction :* ajouter `paymentsDisabled` (et `unpricedPlan`, voir M5.2) dans les deux
  locales.

**Mineur**

- **m4.1 : bouton « Payer » visible sur la fiche élève malgré la coupure.**
  `dash/students/[id]/page.tsx:173` affiche le lien `?action=addPayment` dès que
  `payableRemaining > 0`, sans tester `paymentsEnabled`. Une inscription tarifée avant la
  coupure garde un reste dû, et le lien mène à la fiche famille où `RecordPaymentDialog` n'est
  pas rendu (`families/[id]/page.tsx:156`) : une impasse. *Correction :* conditionner le lien
  à `paymentsEnabled`.
- **m4.2 : le comptage de la confirmation de coupure est gonflé** par les transactions `PENDING`
  jamais clôturées (voir M2.3).
- **m4.3 : `revalidatePath` sans préfixe de locale.** Les chemins sans préfixe
  (`'/dashboard/payments'`, `_lib/payment-actions.ts:15-16`, `plan-actions.ts:18`, …) ne
  correspondent pas aux routes réelles `/[locale]/dashboard/...`. L'impact est faible, les pages
  étant dynamiques (`connection()`), et les dialogues appellent `router.refresh()`. **À
  vérifier** sur `CreatePlanDialog`, qui ne rafraîchit pas explicitement
  (`create-plan-dialog.tsx:44-49`).

Points solides : garde lue dans chaque use-case avant toute écriture (`record-payment.ts:16`,
`create-checkout-session.ts:18`, `apply-discount.ts:15`, `set-enrollment-plan.ts:27`, plans) ;
absence de ligne lue comme activé ; webhook volontairement hors drapeau ; menus filtrés ; pages
en `notFound()`.

### Workflow 5 — Plans / tarifs

**Critique**

Aucun.

**Majeur**

- **M5.1 : un nom de plan en double fait planter la page.** L'index unique partiel
  `@@unique([schoolId, name], where: { isActive: true })` (`prisma/schema.prisma:744`) lève
  `P2002`. Ni `create-plan.ts:18` ni `update-plan.ts:26` ne l'interceptent, et `useDialogForm`
  (`src/features/forms/use-dialog-form.ts:25-37`) n'a pas de `try/catch`. Scénario : créer
  « Mensuel » alors qu'il existe fait remonter l'exception jusqu'à la frontière d'erreur, sans
  message utile. Aucun test ne couvre ce cas.
  *Correction :* contrôler le nom (ou intercepter `P2002`) et renvoyer `nameTaken`, traduit en
  fr et en en.
- **M5.2 : archivage sans confirmation et sans retour arrière.** Le bouton destructif
  « Archiver » (`dash/plans/_components/edit-plan-dialog.tsx:93-102`) appelle directement
  `deactivatePlanAction`, et aucune UI ne permet de désarchiver. Les codes `paymentsDisabled`
  et `unpricedPlan` n'ont pas de traduction (voir M4.1). *Correction :* un `ConfirmDialog`,
  les clés d'erreur, et éventuellement une vue « archivés » avec restauration.

**Mineur**

- **m5.1 : montant sans contrôle de précision ni de borne.** `amount: z.number().positive()`
  (`src/use-cases/plans/schemas.ts:6,13`). 12,345 est arrondi en base par `Decimal(10,2)`,
  alors que les inscriptions utilisent `isCurrencyAmount`. Au-delà de 99 999 999,99, un
  débordement Postgres donne un 500. *Correction :* `.refine(isCurrencyAmount).max(…)`.
- **m5.2 : nom composé d'espaces accepté.** `z.string().min(1)` sans `.trim()` : « ␣␣ » crée
  un plan au nom invisible. *Correction :* `.trim().min(1)`.
- **m5.3 : compteur « Inscriptions » ambigu.** `_count.enrollments` (`dash/plans/page.tsx:37-40,67`)
  compte aussi les inscriptions annulées et terminées, alors que le verrou d'archivage
  s'appuie sur les ouvertes (`openByPlan`). L'admin voit « 12 » mais peut archiver.
  *Correction :* afficher le nombre d'inscriptions ouvertes, ou les deux.
- **m5.4 : changement de tarif sans avertissement.** Le dialogue ne précise pas que les
  inscriptions existantes gardent leur total, mais qu'une remise future les repricera
  (m3.3).
- **m5.5 : course entre archivage et inscription.** Le comptage des inscriptions ouvertes et la
  désactivation (`deactivate-plan.ts:22-25`) sont séparés. Une inscription créée entre les
  deux se retrouve sur un plan archivé. Faible probabilité.

## 3. Top 5 des actions prioritaires

1. **Ne jamais perdre un paiement Stripe capturé (C2.1, M2.1–M2.3).** Au webhook, enregistrer
   l'excédent au lieu de répondre 422 ; une seule session `PENDING` par famille ; `update`
   conditionnel ; traiter `expired`/`async_payment_failed` ; répondre 200 à `notPaid`.
2. **Sérialiser toute écriture d'argent par famille (C1.1).** Verrou consultatif
   `payment:{school}:{family}`, puis relecture des soldes dans la même transaction, pour
   `recordPayment`, `completeCheckoutSession` et les commits MCP de paiement.
3. **Rendre les erreurs de saisie réparables (M1.1, M1.2, M1.4).** Action « Rembourser »
   accessible à solde nul, « Annuler ce paiement » par groupe, récapitulatif avant
   enregistrement.
4. **Verrouiller le cycle d'inscription (M3.1, M3.2, M3.3, M3.5).** Refus de réaffectation
   hors période, verrou par classe pour la capacité, une seule définition du comptage,
   transitions en `updateMany` conditionnel dans une transaction.
5. **Confirmations et erreurs traduites sur les gestes irréversibles (M3.4, M5.1, M5.2,
   M4.1).** `ConfirmDialog` pour annuler, terminer et archiver ; `nameTaken` pour les plans ;
   clés `paymentsDisabled`/`unpricedPlan` en fr et en en.
