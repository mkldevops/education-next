# Feature Specification: Paiements activables par école

**Feature Branch**: `003-paiements-activables-par-ecole`
**Created**: 2026-09-15
**Status**: Draft
**Input**: « Il faudrait que les paiements soient une feature activable, car certaines structures ne
veulent pas gérer les paiements sur la plateforme, mais seulement les inscriptions. »

## Problem

Les paiements sont inconditionnels. Toute école reçoit la page **Encaissements**, l'onglet
**Paiements** de la fiche famille, le bouton de paiement en ligne Stripe, les indicateurs monétaires
du tableau de bord, le catalogue de formules tarifaires, et les outils MCP d'encaissement. Une
structure qui n'encaisse pas sur la plateforme — espèces tenues par l'association, prélèvements dans
un autre logiciel, gratuité — ne peut aujourd'hui que subir ces surfaces :

- l'entrée **Encaissements** de la barre latérale est offerte à tout membre du personnel, sans
  condition de rôle, et **Formules tarifaires** à tout `ADMIN` ;
- la carte « Reste à encaisser » du tableau de bord annonce en permanence un montant qui ne
  correspond à aucune créance réelle ;
- la bannière de la fiche famille affiche un solde restant dû, donc une dette, à des parents à qui
  l'école ne réclame rien sur la plateforme ;
- la création d'une inscription **exige** de choisir une formule tarifaire (`planId` est obligatoire
  en base), donc d'inventer un tarif pour une école qui ne tarife pas ici ;
- un agent MCP se voit offrir `preview_record_payment` et `commit_record_payment` sur une école qui
  n'encaisse pas.

L'infrastructure de drapeaux existe déjà à deux niveaux et aucun des deux ne couvre ce besoin :
`PlatformSetting` pour les réglages d'instance (`school_switch_enabled`, `google_sign_in_enabled`,
`passkey_sign_in_enabled`, `mcp_enabled`), et `Config` pour les réglages d'école, dont un précédent
exact : `teacher_expenses_enabled`, un booléen par école consulté par le use-case
`createTeacherExpense` qui refuse avec `notConfigured` quand il n'est pas armé.

## Desired outcome

Un drapeau **par école** ferme toute la gestion de l'argent. Deux états seulement :

| État      | Ce que voit et fait l'école                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activé    | Le comportement actuel, sans aucun changement observable.                                                                                                                  |
| Désactivé | L'inscription devient purement administrative : élève, classe, période, statut. Aucune surface d'encaissement, aucun champ monétaire, aucun choix de formule, aucun solde. |

Trois propriétés tiennent l'ensemble :

1. **Réversible sans perte.** Désactiver ne supprime, n'archive et ne modifie aucune donnée
   existante. Réactiver rend visible exactement ce qui était là.
2. **Aucune école existante n'est affectée.** L'absence de réglage vaut _activé_, comme pour les
   drapeaux plateforme déjà en place.
3. **Aucun euro perdu par une bascule.** Un encaissement engagé chez le fournisseur avant la
   désactivation aboutit quand même en base.

## User stories

### User Story 1 — Une école ferme les encaissements (Priority: P1)

Un `ADMIN` d'une structure qui ne gère pas l'argent sur la plateforme coupe la fonction depuis la
configuration de son école, et les surfaces d'encaissement disparaissent pour toute l'école.

**Why this priority**: c'est la demande. Sans elle, rien d'autre n'a de sujet.

**Independent Test**: basculer le réglage sur une école de démonstration, recharger le tableau de
bord, constater la disparition de l'entrée de barre latérale, de la page, de l'onglet et des
indicateurs monétaires — et leur présence intacte sur une seconde école de la même instance.

**Acceptance Scenarios**

1. **Given** une école dont les paiements sont activés et qui porte des paiements enregistrés,
   **When** l'`ADMIN` désactive les paiements et confirme l'avertissement,
   **Then** le réglage est persisté sur cette école seule, et aucune ligne `Payment`,
   `PaymentTransaction` ou `Plan` n'est supprimée ni archivée.
2. **Given** les paiements désactivés, **When** un `ADMIN` ouvre `/dashboard/payments` ou
   `/dashboard/plans` par URL directe, **Then** la plateforme répond « introuvable », comme pour
   toute surface hors de sa portée.
3. **Given** les paiements désactivés, **When** un appelant rejoue l'action d'enregistrement d'un
   paiement ou de création d'une session de paiement en ligne, **Then** l'action refuse avec le
   discriminant `paymentsDisabled` sans écrire.
4. **Given** deux écoles sur la même instance, l'une avec paiements et l'autre sans, **When** un
   super-admin passe de l'une à l'autre, **Then** les surfaces d'encaissement suivent l'école
   active.

### User Story 2 — Inscrire sans parler d'argent (Priority: P1)

Dans une école sans paiements, inscrire un élève ne demande ni formule, ni remise, et n'affiche
aucun montant.

**Why this priority**: l'école veut « seulement les inscriptions ». Un formulaire qui exige un tarif
rend le drapeau cosmétique.

**Independent Test**: créer une inscription avec les paiements coupés et vérifier qu'aucun champ
monétaire n'est présenté, que l'inscription est créée, et que sa fiche n'affiche aucun montant.

**Acceptance Scenarios**

1. **Given** les paiements désactivés, **When** un `ADMIN` ouvre le formulaire de création
   d'inscription, **Then** le sélecteur de formule et le champ de remise sont absents, et les autres
   champs sont inchangés.
2. **Given** les paiements désactivés, **When** l'inscription est créée, **Then** elle est valide,
   rattachée à la formule réservée « sans tarif » de son école, avec `totalAmount = 0` et
   `discount = 0`.
3. **Given** les paiements désactivés, **When** un appelant soumet malgré tout une formule explicite
   ou une remise non nulle, **Then** l'action refuse avec `paymentsDisabled`.
4. **Given** les paiements désactivés, **When** un `ADMIN` consulte la liste et la fiche d'une
   inscription, **Then** ni colonne formule, ni montant, ni remise, ni progression de paiement n'y
   figurent.
5. **Given** les paiements désactivés, **When** un `ADMIN` ouvre la fiche d'une famille,
   **Then** la bannière n'annonce aucun solde, le résumé financier et l'onglet **Paiements** sont
   absents, et la liste des familles n'affiche plus de colonne de règlement.

### User Story 3 — Un parent d'une école sans paiements (Priority: P2)

Un parent ne voit jamais de dette, de bouton de règlement, ni d'historique dans une école qui
n'encaisse pas ici.

**Why this priority**: c'est la surface visible par le plus grand nombre, et la plus dommageable si
elle mentait.

**Independent Test**: se connecter en tant que parent d'une école sans paiements et parcourir
tableau de bord puis fiche famille.

**Acceptance Scenarios**

1. **Given** les paiements désactivés, **When** un `PARENT` ouvre son tableau de bord, **Then** la
   carte de solde et le bouton de paiement en ligne sont absents.
2. **Given** les paiements désactivés et une famille portant des paiements passés, **When** le
   `PARENT` ouvre sa fiche famille, **Then** aucun historique de paiement n'est rendu, y compris par
   URL portant l'onglet en paramètre.
3. **Given** les paiements désactivés, **When** un `PARENT` déclenche la création d'une session de
   paiement en ligne hors interface, **Then** elle est refusée avec `paymentsDisabled` et aucune
   ligne `PaymentTransaction` n'est créée.

### User Story 4 — Réactiver, puis tarifer ce qui ne l'était pas (Priority: P2)

Une école qui change d'avis retrouve ses surfaces, et peut tarifer les inscriptions créées pendant
la coupure.

**Why this priority**: sans chemin de réparation, le drapeau crée un état que l'interface ne sait
pas corriger. L'invariant « aucun état atteignable par la bascule n'est irréparable depuis
l'interface » impose ce récit.

**Independent Test**: inscrire pendant la coupure, réactiver, tarifer l'inscription depuis
l'interface, constater un solde famille cohérent.

**Acceptance Scenarios**

1. **Given** une école réactivée, **When** un `ADMIN` ouvre les surfaces d'encaissement, **Then**
   l'intégralité des paiements et formules antérieurs à la coupure est de nouveau visible et
   inchangée.
2. **Given** une école réactivée portant des inscriptions créées pendant la coupure, **When** un
   `ADMIN` ouvre la liste des inscriptions, **Then** ces inscriptions sont identifiées comme sans
   tarif, distinctement d'une formule à 0 € que l'école aurait créée elle-même.
3. **Given** une inscription sans tarif, **When** un `ADMIN` lui affecte une formule, **Then**
   `totalAmount` est recalculé sur le prix courant de cette formule moins la remise, et le solde de
   la famille intègre le nouveau montant.
4. **Given** une inscription sans tarif déjà réglée à 0 par nature, **When** on lui affecte une
   formule dont le total passerait sous le montant déjà payé, **Then** l'opération est refusée avec
   le même discriminant que le chemin MCP équivalent (`totalBelowPaid`).

### User Story 5 — Un agent MCP sur une école sans paiements (Priority: P3)

Un agent connecté à une école sans paiements ne se voit offrir aucun outil d'argent.

**Why this priority**: le MCP est une frontière appelable au même titre que l'interface ; un outil
resté déclaré serait une porte ouverte, et une description d'outil trompeuse conduit l'agent à
promettre un encaissement impossible.

**Independent Test**: lister les outils avec une clé d'une école sans paiements.

**Acceptance Scenarios**

1. **Given** les paiements désactivés, **When** un agent liste les outils, **Then** `list_plans`,
   `preview_record_payment`, `commit_record_payment`, `preview_update_enrollment` et
   `commit_update_enrollment` sont absents de la liste.
2. **Given** les paiements désactivés, **When** un agent appelle malgré tout l'un de ces outils par
   son nom, **Then** l'appel est refusé sans écriture ni brouillon.
3. **Given** les paiements désactivés, **When** un agent prépare une inscription de famille,
   **Then** le libellé de formule n'est plus requis, un bloc de paiement joint à la demande est
   refusé, et l'aperçu n'annonce aucun montant.
4. **Given** un brouillon d'encaissement préparé avant la désactivation, **When** l'agent l'engage
   après la coupure, **Then** l'engagement est refusé.

### Edge Cases

- **Session Stripe ouverte avant la coupure.** Le client paie chez Stripe, puis l'école désactive
  les paiements, puis le webhook arrive : le webhook aboutit et écrit les `Payment`. L'argent est
  déjà capturé chez le fournisseur ; refuser laisserait un encaissement réel sans trace.
- **Chèque non encaissé au moment de la coupure.** Rien ne le relance et rien ne l'efface : il
  réapparaît tel quel à la réactivation.
- **Formule réservée et archivage.** La formule « sans tarif » ne peut pas être archivée tant
  qu'une inscription y est rattachée, par la règle `planInUse` existante, et n'est de toute façon
  jamais proposée à l'archivage.
- **Aucune formule dans l'école au moment de la réactivation.** La liste des inscriptions sans tarif
  reste correcte ; l'affectation d'une formule est simplement indisponible jusqu'à ce qu'une formule
  existe.
- **Réglage illisible.** Une valeur qui n'exprime aucun refus vaut activé : un réglage corrompu ne
  doit pas retirer silencieusement une fonction en place.
- **Bascule concurrente.** Deux `ADMIN` qui basculent en même temps : le dernier écrit gagne, sans
  état intermédiaire observable, le réglage n'ayant aucune contrainte d'unicité métier à préserver.
- **Désactivation d'une école portant un historique.** Autorisée, mais l'interface doit nommer ce
  qui devient invisible avant de l'accepter.

## Behaviour and acceptance criteria

### Le réglage

- **FR-001** Le système MUST porter un réglage booléen `payments_enabled` **par école**, dans la
  table de configuration d'école, éditable par un `ADMIN` de cette école et par un super-admin.
  _Vérification_ : test du gateway de configuration ; écriture depuis l'interface puis relecture.
- **FR-002** L'absence de réglage MUST valoir **activé**, et toute valeur n'exprimant pas un refus
  MUST valoir activé. Aucune migration de données n'est requise : les écoles existantes conservent
  leurs paiements sans qu'aucune ligne ne soit semée.
  _Vérification_ : test unitaire de la fonction de lecture sur `null`, `'false'`, `'0'`, `'off'`,
  `'no'`, casse indifférente, et valeur inattendue.
- **FR-003** Le réglage MUST figurer parmi les réglages créés avec une nouvelle école, **à `true`**,
  et MUST apparaître dans la configuration d'une école antérieure grâce au repli déjà en place pour
  les réglages connus manquants. Aucune migration, aucun remplissage rétroactif et aucune valeur par
  défaut MUST NOT écrire `false` sur une école existante : la valeur par défaut `false` de
  `teacher_expenses_enabled` appartient à un opt-in et MUST NOT être reprise ici. Les paiements
  fonctionnent aujourd'hui partout ; seule une désactivation explicite par un administrateur peut
  les couper.
  _Vérification_ : création d'école en test, la ligne vaut `true` ; rendu de la page de
  configuration sur une école sans la ligne ; relecture du drapeau sur une base pré-existante après
  déploiement, qui répond activé.
- **FR-004** La lecture MUST être mémoïsée pour la durée d'un rendu, plusieurs surfaces la
  consultant dans une même requête.
  _Vérification_ : compteur d'appels au gateway sur un rendu qui consulte le drapeau plusieurs fois.
- **FR-005** La bascule vers _désactivé_ MUST exiger une confirmation explicite nommant ce qui
  devient invisible lorsque l'école porte au moins un paiement actif ou une transaction en attente.
  La bascule vers _activé_, et la désactivation d'une école sans historique, restent un clic.
  _Vérification_ : test du composant de bascule, cas avec et sans historique.
- **FR-006** La lecture du réglage MUST être scopée par école, donc satisfaire le garde tenant.
  _Vérification_ : la suite qui rejoue les lectures du tableau de bord sous le garde en mode `throw`.

### Refus côté serveur

- **FR-007** Le refus MUST appartenir à la couche use-case, qui répond par un discriminant
  `paymentsDisabled`, et non aux seules pages : l'interface reflète le verdict, elle ne le produit
  pas.
  _Vérification_ : tests unitaires des use-cases concernés avec un gateway de configuration injecté,
  sur le modèle du test de `createTeacherExpense`.
- **FR-008** Les frontières suivantes MUST refuser quand les paiements sont désactivés :
  enregistrement d'un paiement, création d'une session de paiement en ligne, application d'une
  remise, création et modification d'une formule tarifaire, archivage d'une formule, affectation
  d'une formule à une inscription.
  _Vérification_ : un test par frontière asservissant le discriminant et l'absence d'écriture.
- **FR-009** Le webhook du fournisseur de paiement MUST NOT consulter le drapeau, et MUST aboutir
  même si l'école a désactivé les paiements entre-temps.
  _Vérification_ : test de la route webhook, drapeau coupé, transaction en attente préexistante, les
  lignes `Payment` sont créées.
- **FR-010** Les pages `/dashboard/payments` et `/dashboard/plans` MUST répondre « introuvable »
  quand les paiements sont désactivés, et non afficher un écran vide.
  _Vérification_ : rendu de page en test, et parcours navigateur par URL directe.

### Surfaces masquées

- **FR-011** Les entrées **Encaissements** et **Formules tarifaires** de la barre latérale MUST
  disparaître pour tout rôle qui les voit aujourd'hui — personnel et super-admin — quand les
  paiements sont désactivés, la résolution des entrées recevant l'état du drapeau au même titre que
  le rôle. La branche parent, qui n'offre déjà ni l'une ni l'autre, reste inchangée.
  _Vérification_ : test unitaire de la résolution des entrées, cas activé et désactivé, par rôle.
- **FR-012** Les indicateurs monétaires du tableau de bord — carte « Reste à encaisser » côté
  administration, carte de solde et bouton de paiement en ligne côté parent, colonne de progression
  de règlement des inscriptions récentes, statistiques d'encaissement — MUST être absents du rendu.
  _Vérification_ : rendu de la page de tableau de bord en test, pour un `ADMIN` et pour un `PARENT`.
- **FR-013** Sur la fiche famille, l'onglet **Paiements**, le résumé financier, le solde de la
  bannière et le bouton de paiement en ligne MUST être absents, y compris lorsque l'onglet est
  demandé par la requête.
  _Vérification_ : rendu de la page avec et sans le paramètre d'onglet.
- **FR-014** Sur la liste des familles, la colonne de règlement MUST être absente.
  _Vérification_ : rendu de la page en test.
- **FR-015** Sur la liste, la fiche et le tiroir d'inscription, les colonnes et champs formule,
  montant total, remise et progression de règlement MUST être absents.
  _Vérification_ : rendu des trois surfaces en test.
- **FR-016** Aucune clé de traduction MUST rester orpheline et aucun composant MUST devenir mort :
  les deux locales restent alignées et l'analyse de code inutilisé reste verte.
  _Vérification_ : `pnpm knip` et comparaison des jeux de clés `fr` / `en`.

### Inscription sans argent

- **FR-017** Quand les paiements sont désactivés, la création d'une inscription MUST résoudre
  côté serveur une **formule réservée « sans tarif »** propre à l'école, de montant nul, et écrire
  `totalAmount = 0` et `discount = 0`. Le schéma d'entrée rend la formule optionnelle ; une formule
  explicite ou une remise non nulle est refusée.
  _Vérification_ : test du use-case de création, les trois cas.
- **FR-018** La formule réservée MUST être créée à la demande, à la première inscription posée
  pendant une coupure, et non à la création de l'école : une école qui ne désactive jamais les
  paiements n'en porte jamais la ligne.
  _Vérification_ : test du use-case, création d'école sans la ligne puis apparition à la première
  inscription.
- **FR-019** La formule réservée MUST être identifiée par un nom technique stable, traduit à
  l'affichage, et MUST NOT être proposée dans le catalogue des formules ni dans les sélecteurs de
  formule.
  _Vérification_ : test du use-case de liste des formules ; rendu du sélecteur après réactivation.
- **FR-020** Après réactivation, les inscriptions rattachées à la formule réservée MUST être
  signalées comme sans tarif dans la liste des inscriptions, et un `ADMIN` MUST pouvoir leur
  affecter une formule depuis l'interface, `totalAmount` étant recalculé sur le prix courant de la
  formule moins la remise.
  _Vérification_ : test du nouveau use-case d'affectation, dont le cas `totalBelowPaid` ; parcours
  navigateur de réactivation puis tarification.

### Accès machine

- **FR-021** L'état du drapeau MUST être résolu dans la portée MCP, aux côtés de l'école et du
  rôle, de sorte que la construction du serveur reste synchrone et que la décision soit prise une
  fois par requête.
  _Vérification_ : test de la résolution de portée.
- **FR-022** Les outils d'argent MUST NOT être déclarés quand les paiements sont désactivés :
  `list_plans`, `preview_record_payment`, `commit_record_payment`, `preview_update_enrollment`,
  `commit_update_enrollment`.
  _Vérification_ : test de la liste des outils, portée avec et sans paiements.
- **FR-023** `preview_enroll_family` MUST accepter une demande sans libellé de formule quand les
  paiements sont désactivés, MUST refuser un bloc de paiement joint, et son aperçu MUST NOT annoncer
  de montant.
  _Vérification_ : tests du use-case d'aperçu, les trois cas.
- **FR-024** L'engagement d'un brouillon d'argent préparé avant la coupure MUST être refusé après
  la coupure.
  _Vérification_ : test du use-case d'engagement, brouillon préexistant et drapeau coupé.

### Documentation

- **FR-025** `docs/business-rules.md` MUST recevoir, dans le même changement, la règle du drapeau :
  sa clé, sa sémantique d'absence, la liste des frontières qui le consultent, et la raison pour
  laquelle le webhook ne le consulte pas.
  _Vérification_ : revue du changement.

### Key Entities

- **Réglage d'école** : ligne de configuration `payments_enabled`, booléenne, unique par école parmi
  les lignes actives. Aucune colonne ni table nouvelle.
- **Formule réservée « sans tarif »** : ligne de formule tarifaire d'une école, de montant nul, nom
  technique stable, non catalogable, créée à la demande. Existe pour satisfaire l'obligation de
  formule portée par l'inscription.
- **Inscription** : inchangée en base. Pendant une coupure, elle porte la formule réservée et des
  montants nuls.

## Technical and architectural decisions

**Réglage d'école, pas réglage de plateforme.** Le besoin est « certaines structures » : la décision
est propre au locataire. La table de configuration d'école porte déjà un précédent booléen
(`teacher_expenses_enabled`), est scopée par le garde tenant, et est éditable par un `ADMIN`
d'école. Un réglage de plateforme aurait imposé un super-admin pour une décision commerciale
d'école et aurait rendu le comportement uniforme sur toute l'instance.

**L'absence vaut activé.** La sémantique est celle des drapeaux existants : la migration ne sème
rien, donc toute école déjà en service garde ses paiements, et un réglage illisible ne retire jamais
une fonction en place. Conséquence : aucune migration de schéma ni de données pour cette feature.
C'est l'inverse de `teacher_expenses_enabled`, qui est un opt-in parce qu'il ouvre une fonction que
personne n'avait ; ici on ferme une fonction que tout le monde a.

**Formule réservée plutôt que formule facultative en base.** `Enrollment.planId` est obligatoire et
référencé par une clé étrangère composite, et `plan.name` est lu par la liste, la fiche, le tiroir,
la promotion et quatre use-cases MCP. Rendre la référence facultative propagerait un cas nul dans
toutes ces lectures pour un état transitoire. Une ligne réservée de montant nul garde toutes les
lectures intactes, rend les soldes et statistiques naturellement vides, et laisse une trace
explicite des inscriptions à tarifer après réactivation. Le coût assumé est un nom technique traduit
à l'affichage et une exclusion du catalogue.

**Le use-case est l'autorité du refus.** Chaque frontière appelable consulte le drapeau et répond
`paymentsDisabled` ; les pages et composants ne font que refléter ce verdict. Une garde posée
uniquement dans l'interface laisserait chaque action serveur ouverte, comme l'a montré le
durcissement des drapeaux d'authentification, où l'action et la route sont gardées en plus du rendu.

**Le webhook du fournisseur est hors drapeau.** Une transaction ne peut exister que si la session a
été ouverte pendant que les paiements étaient actifs. À l'arrivée du webhook, l'argent est capturé
chez le fournisseur : refuser produirait un encaissement réel sans écriture, c'est-à-dire une perte
comptable causée par un réglage d'affichage. L'idempotence existante suffit à cadrer le reste.

**Le drapeau MCP est résolu dans la portée.** La portée MCP est déjà résolue de façon asynchrone et
porte l'école ; la construction du serveur est synchrone. Y adjoindre l'état du drapeau évite une
lecture par outil et fait de la non-déclaration — et non un refus à l'appel — le mécanisme premier :
un outil absent ne trompe pas l'agent.

**Invariants**

1. Une bascule ne supprime, n'archive ni ne modifie aucune donnée métier.
2. Aucun état atteignable par une bascule n'est irréparable depuis l'interface.
3. Le drapeau d'une école ne conditionne jamais une surface d'une autre école, ni une surface
   plateforme.
4. Aucune bascule ne peut faire perdre un encaissement déjà engagé chez le fournisseur.

## Verification strategy

Les seams retenus sont les frontières publiques déjà observables ; aucune n'est créée pour le test.

| Seam                                                                 | Nature               | Ce qu'il prouve                                                                  |
| -------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| Fonction de lecture du drapeau                                       | unitaire pur         | FR-002 : la sémantique d'absence et de valeur inattendue.                        |
| Gateway de configuration d'école                                     | unitaire             | FR-001 : écriture et relecture scopées par école.                                |
| Résolution des entrées de barre latérale                             | unitaire pur         | FR-011 : disparition par rôle et par état.                                       |
| Use-cases d'argent, gateway injecté                                  | unitaire             | FR-007, FR-008, FR-017, FR-020, FR-024 : discriminant et absence d'écriture.     |
| Route webhook du fournisseur                                         | test de route        | FR-009 : l'encaissement aboutit drapeau coupé.                                   |
| Harnais de rendu du tableau de bord sous garde tenant                | rendu réel en base   | FR-006, FR-010, FR-012 à FR-015 : les surfaces masquées et les lectures scopées. |
| Liste des outils MCP par portée                                      | unitaire             | FR-021 à FR-023 : outils non déclarés.                                           |
| Composant de bascule                                                 | rendu                | FR-005 : confirmation, optimisme et retour arrière.                              |
| `pnpm knip` et alignement des locales                                | outillage du dépôt   | FR-016 : ni code ni clé orphelins.                                               |
| Parcours navigateur, consigné dans les scénarios d'assurance qualité | manuel reproductible | Les récits 1 à 4 de bout en bout, dont la réactivation puis la tarification.     |

Chaque critère ci-dessus nomme son chemin d'observation ; aucun ne repose sur une inspection du
code source. La séquence de vérification du dépôt (`lint`, `type-check`, `test`, `knip`, `build`)
reste la porte de sortie : le typage énumère les appelants oubliés là où une signature gagne l'état
du drapeau.

## Out of scope

- **Identifiants de paiement par école.** Le fournisseur reste configuré par variables
  d'environnement au niveau de l'instance ; ce drapeau n'ouvre pas la voie à un compte marchand par
  école.
- **Suppression ou purge des données de paiement** à la désactivation. Rien n'est effacé, et aucune
  fonction d'effacement n'est ajoutée.
- **Désactivation partielle** : garder les espèces et couper le paiement en ligne, ou couper par
  période. Deux états seulement.
- **Interrupteur plateforme** coupant les paiements de toutes les écoles.
- **Tarification automatique** des inscriptions créées pendant une coupure au moment de la
  réactivation : le drapeau ne devine pas un tarif.
- **Gratuité comme notion métier** (exonération, bourse, tarif solidaire). Une école qui gère
  l'argent et veut un tarif nul crée elle-même une formule à 0 €.
- **Factures, reçus ou relances** destinés aux parents.
- **Modification de `teacher_expenses_enabled`** ou des drapeaux plateforme existants, hors le
  renommage du composant de bascule rendu nécessaire par son nouvel usage d'école.
- **Rôle dédié** à la gestion de l'argent. La fonction est coupée pour toute l'école ou pour
  personne ; elle ne devient pas une permission.

## Open questions

1. **Libellé de la formule réservée.** Le nom technique est stable et non affiché ; reste à arrêter
   le libellé traduit présenté après réactivation, et son rendu dans la liste des inscriptions —
   étiquette neutre ou marqueur d'action à mener. Proposition : un marqueur d'action, la
   tarification étant un travail à faire et non un état durable.
2. **Réactivation avec des inscriptions sans tarif.** Proposition retenue : ne pas la bloquer. Les
   bloquer imposerait de tarifer avant de voir les surfaces qui servent à tarifer.
3. **Sort des transactions en attente à la désactivation.** Elles restent en attente et expirent
   selon le fournisseur. À confirmer : faut-il les signaler dans la confirmation de désactivation au
   même titre que les paiements existants ? Proposition : oui, la confirmation les compte déjà.
