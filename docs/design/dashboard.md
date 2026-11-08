# Dashboard admin / enseignant — revue design

Revue lecture seule du code (pas de session navigateur). Abréviations de chemins :

- `D/` = `app/[locale]/(dashboard)/`
- `DD/` = `app/[locale]/(dashboard)/dashboard/`
- `F/` = `src/features/dashboard/`
- `U/` = `src/components/ui/`

Références visuelles : Mobbin (liens en section 3).

## 1. Verdict

Base fonctionnelle solide (App Router, ⌘K, drawer, autosave de l'appel), mais l'habillage crie au lieu de guider.
La couleur primaire — brandable par école, donc arbitraire — inonde la nav active, les en-têtes de tableaux, le hero et les avatars.
Le shell n'a pas de titre de page, de fil d'Ariane ni d'action principale ; la home affiche des métriques de vitrine, pas « ce qu'il faut faire aujourd'hui ».
Les listes sont 100 % client (état hors URL, pas de filtres, pas d'actions groupées), et l'appel sur mobile coûte ~50 taps pour 25 élèves.
Direction : chrome neutre + accent, file d'actions du jour, tables pilotées par l'URL, appel en liste « présent par défaut ».

| Axe                            | Note /5 | Justification courte                                                                                            |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------- |
| Navigation                     | 2.5     | 2 groupes fourre-tout, icônes dupliquées, ⌘K sans navigation clavier, pas de home enseignant                    |
| Densité / lisibilité           | 2.5     | Gradients partout, 3 implémentations de KPI, rayons incohérents, montants non tabulaires                        |
| Tableaux                       | 2       | Tout client, état en `useState`, pas de filtres/bulk/sticky, en-tête gradient                                   |
| Formulaires                    | 3       | Dialogues pilotés par `?action=` (bien), mais ConfirmDialog anglais et fermeture sur échec, pas de sheet mobile |
| États (vide/chargement/erreur) | 2.5     | `EmptyState` existe mais sous-utilisé, fallback « Loading... » anglais, `error.tsx` correct                     |
| Mobile                         | 2       | Débordement du hero, pas de recherche, tables `min-w-[600px]`, appel en carrousel                               |

## 2. Problèmes prioritaires (classés)

1. **La couleur de l'école envahit le chrome.**
   - Preuve :
     - `F/sidebar-nav-item.tsx:72` (item actif `bg-gradient-to-br from-primary to-primary-hover text-white shadow-lg shadow-primary/25`) ;
     - `U/rich-data-table/rich-data-table.tsx:158` et `U/data-table/data-table.tsx:38` (en-têtes `bg-gradient-to-br from-primary`) ;
     - `DD/page.tsx:209` (hero gradient) ;
     - `F/sidebar-brand.tsx:35` et `F/sidebar-user-menu.tsx:49` (avatars gradient).
   - `--color-primary` vaut `var(--theme-primary, #3c6e71)` dans `src/styles/globals.css`, et chaque école peut le changer.
   - Impact : une école en rouge vif ou jaune rend toute l'app illisible. Rien n'a de hiérarchie puisque tout est accentué, et le rendu fait « template » plutôt que premium.

2. **La home ne répond pas à « que dois-je faire maintenant ? ».**
   - Preuve :
     - `DD/page.tsx:215-225` n'offre qu'une seule action rapide (nouvelle famille) ;
     - les KPI inline ne sont pas cliquables ;
     - le « reste à payer » est dupliqué entre `DD/page.tsx:229-246` et `DD/_components/school-insights.tsx:57-62` ;
     - aucun bloc « aujourd'hui » : cours du jour, appels non faits, chèques non encaissés, inscriptions à activer.
   - Impact : l'admin doit fouiller quatre pages pour trouver son travail du jour.

3. **La tendance élèves est fausse.**
   - Preuve : `DD/page.tsx:82-100` reconstruit l'historique à rebours depuis `createdAt` et ignore les désactivations.
   - Impact : le seul graphique de la home ment. C'est un risque de confiance.

4. **Débordement horizontal sur mobile dès la home.**
   - Preuve :
     - `DD/page.tsx:209` pose `-mx-6 -mt-16` alors que `D/layout.tsx:116` ne met que `p-4` sous `sm` ;
     - `DD/page.tsx:199-205` ajoute `-mt-14` sur la grille de stats.
   - Impact : scroll horizontal à 375 px, soit la première impression d'un enseignant sur téléphone.

5. **Les tables sont 100 % client et leur état est volatil.**
   - Preuve :
     - `U/rich-data-table/rich-data-table.tsx:71-78` : tri, recherche et pagination en `useState` ;
     - chargement intégral côté serveur dans `DD/families/page.tsx:52-93`, `DD/payments/page.tsx:48-64` et `DD/enrollments/page.tsx:101-127` (includes profonds, `family: true`) ;
     - sélection du drawer en state dans `DD/enrollments/_components/enrollments-table.tsx:39-40,128-131`, alors que la page `/enrollments/[id]` existe aussi.
   - Impact : retour arrière = filtres perdus, impossible de partager « familles avec solde », et la charge grossit avec l'école.

6. **Pas de filtres métier, pas d'actions groupées, montants mal alignés.**
   - Preuve :
     - le filtre de statut est un `Select` natif (`DD/enrollments/_components/enrollments-table.tsx:43,144-156`) ;
     - aucun filtre moyen de paiement ni « non encaissé » dans `DD/payments/_components/payments-table.tsx`, et le KPI « non encaissé » n'est pas cliquable (`DD/payments/_components/payments-overview.tsx:83-89`) ;
     - la table n'a ni sélection ni barre bulk (`U/rich-data-table/rich-data-table.tsx`) ;
     - les montants ne sont ni alignés à droite ni en `tabular-nums` (`DD/families/_components/families-data-table.tsx`, `payments-table.tsx`).
   - Impact : les relances de solde et le rapprochement des chèques se font ligne à ligne.

7. **L'appel mobile est trop lent.**
   - Preuve :
     - carrousel d'un élève à la fois (`DD/my-classes/[id]/attendance/_components/attendance-panel.tsx:111,241-248,454-517`) ;
     - un tap de statut enregistre sans avancer (`:467-473`) ;
     - « tous présents » est un lien souligné, désactivé si des modifications sont en cours (`:420-447`) ;
     - revue obligatoire avant validation (`:519-531`).
   - Impact : environ 2 taps par élève, soit ~50 taps pour 25 élèves en début de cours, debout, sur téléphone.

8. **Le shell n'a pas d'en-tête de page.**
   - Preuve :
     - `F/header-client.tsx:33-56` ne contient que le hamburger, le `PeriodSelector` et la recherche (`hidden sm:flex`, `:47`) ;
     - le raccourci « ⌘K » est codé en dur (`:56`) ;
     - chaque page répète Breadcrumbs + h1 + bouton (`DD/families/page.tsx:130-139`) ;
     - le « record payment » est absent de `DD/payments/page.tsx:103`.
   - Impact : les actions principales sont introuvables selon la page, la recherche est invisible sur mobile et l'indication est fausse sous Windows.

9. **La palette ⌘K est cassée au clavier et pauvre.**
   - Preuve :
     - les résultats sont des `<button>`, pas des `Command.Item` (`F/search-modal.tsx:166,192`), donc les flèches ne marchent pas ;
     - l'overlay est fait main, sans focus trap (`:115`) ;
     - la recherche porte uniquement sur élèves et familles, et l'état vide est blanc.
   - Impact : la fonctionnalité « pro » par excellence déçoit, et c'est un défaut d'accessibilité.

10. **La période globale filtre silencieusement toutes les pages.**
    - Preuve :
      - `<select>` natif (`F/period-selector.tsx:34`) ;
      - l'indice « entre deux années » est masqué sur mobile (`:48`).
    - Impact : l'utilisateur ne sait pas pourquoi des données « disparaissent ».

11. **Navigation mal structurée.**
    - Preuve :
      - icônes dupliquées dans `F/sidebar-items.ts` : ClipboardList pour inscriptions (`:37`) et présences (`:39`), CalendarDays pour planning (`:49`) et périodes (`:56`) ;
      - `configItems` (`:55-71`) mélange structure, admin et plateforme ;
      - la nav enseignant (`:131-141`) n'a pas de home, et `DD/page.tsx:49-51` redirige ;
      - le toggle de repli est enfoui dans le menu utilisateur (`F/sidebar-user-menu.tsx:99-114`).
    - Impact : balayage lent, et les super-admins et admins voient la même soupe.

12. **Primitives incohérentes et non localisées.**
    - Preuve :
      - trois KPI cards : inline dans `DD/page.tsx`, `DD/payments/_components/payments-overview.tsx:175` et `DD/families/[id]/_components/kpi-card.tsx` ;
      - rayons disparates : `rounded` (`U/card.tsx`), `rounded-3xl` (`student-attendance-card.tsx` ~`:145`), `rounded-xl` et `rounded-lg` (planning) ;
      - devise codée en dur `'EUR'` (`DD/_components/school-insights.tsx:22`, `payments-overview.tsx:35`) ;
      - chaînes anglaises : `'Cancel'` (`U/confirm-dialog.tsx:32`), `'...'` (`:62`), « Loading... » (`D/layout.tsx:117`), `'User'` (`DD/page.tsx:106`) ;
      - le ConfirmDialog se ferme même si `onConfirm` échoue (`U/confirm-dialog.tsx:41-44`).
    - Impact : l'UI a l'air assemblée et non conçue, les francophones voient de l'anglais, et un échec de suppression semble réussi.

13. **Le planning n'est pas un calendrier.**
    - Preuve :
      - des cartes par jour de semaine, uniquement les jours avec créneaux (`DD/planning/_components/schedule-grid.tsx:46-49`) ;
      - les actions admin sont dupliquées dans chaque carte (`:105-129`).
    - Impact : chevauchements et conflits enseignant/salle invisibles, et pas de repère « maintenant ».

14. **États vides et chargement génériques.**
    - Preuve :
      - `U/empty-state.tsx` est utilisé sur 5 écrans seulement, et les tables affichent un texte en cellule (`U/rich-data-table/rich-data-table.tsx:197`, `U/data-table/data-table.tsx:31-32`) ;
      - l'état vide des inscriptions récentes est un simple `<p>` (`DD/page.tsx:311-337`) ;
      - le fallback de la sidebar est `bg-white w-64` (`D/layout.tsx:101`).
    - Impact : une école neuve voit des pages mortes, sans « prochaine étape ».

## 3. Direction cible

### Shell

Principes :

- Chrome neutre : sidebar `bg-alabaster-950` sans bordure forte.
- Item actif = fond neutre subtil, texte fort et une barre de 2 px ou une pastille en primaire. Aucun gradient ni ombre colorée.
- Le primaire n'apparaît que sur le CTA principal, les focus rings et les liens.

Sidebar :

- Groupes explicites :
  - **Aujourd'hui** : Accueil, Présences, Planning.
  - **Scolarité** : Familles, Élèves, Inscriptions, Classes.
  - **Finances** : Paiements.
  - **Paramètres de l'école** : Périodes, Niveaux, Enseignants, Formules, Utilisateurs, Configuration.
  - **Plateforme** (super-admin uniquement) : Écoles, Super-admins.
- Chaque item a une icône unique et un compteur optionnel (« 3 appels à faire », « 5 à encaisser »).
- Le toggle de repli passe à côté du switcher d'école, raccourci `[`.
- Le switcher d'école en tête de sidebar affiche logo, nom et rôle, avec une recherche au-delà de 5 écoles. La bascule se fait sans overlay plein écran (spinner inline).

Header de page unifié (slot) :

- Contenu : fil d'Ariane + titre + actions primaire et secondaire + chip de période.
- La période devient une chip visible, « 2025-2026 ▾ », qui sert aussi de rappel de filtre.
- Recherche : icône sur mobile ; raccourci affiché selon l'OS (⌘K / Ctrl K).

Palette ⌘K :

- Groupes « Récents », « Aller à » (toutes les routes de la nav), « Actions » (nouvelle famille, enregistrer un paiement, faire l'appel) et « Élèves / Familles ».
- Tous les résultats sont des `Command.Item`, et le focus trap vient du primitive dialog.

Mobile :

- Barre d'onglets basse, 4 entrées : Accueil, Présences, Recherche, Menu.
- L'enseignant atterrit sur « Mes cours du jour ».

Références Mobbin :

- Groupes, compteurs et chrome neutre : [Plain sidebar](https://mobbin.com/screens/52c56353-10cb-4e3e-a4f8-62bd60f6496a).
- Groupes repliables et sous-niveaux : [Klaviyo](https://mobbin.com/screens/3a4c26aa-9f6c-4190-9917-0fd7a405b426).
- Rail d'icônes et sections nommées : [Canny](https://mobbin.com/screens/77ba2100-7588-4fb6-8dc1-6c3020ae3bbc).
- Palette : [v0 command palette](https://mobbin.com/screens/5f353fc3-d9ce-4d1c-be9b-cc1b4ad07578) (actions puis navigation), [Basecamp](https://mobbin.com/screens/0e720226-cddb-4ae2-876b-ff1d14a04638) (récemment visités), [Mintlify](https://mobbin.com/screens/7c7ad31f-9dfe-4be7-83d7-6002fe31d4d0) (pied de page clavier).

```
┌──────────────────────┬──────────────────────────────────────────────────────────────┐
│ [logo] École Al-Nour▾│ Familles / Famille Benali            [2025-26 ▾] [⌘K] [+ ▾]  │
│ ─────────────────── │──────────────────────────────────────────────────────────────│
│ AUJOURD'HUI          │ Famille Benali                     [Paiement] [Inscrire] […]  │
│ ▎Accueil             │ Solde 240,00 €  ·  3 enfants  ·  2 inscriptions actives      │
│  Présences        3  │ Aperçu | Enfants | Paiements | Activité                      │
│  Planning            │                                                              │
│ SCOLARITÉ            │  … contenu …                                                 │
│  Familles            │                                                              │
│  Élèves              │                                                              │
│  Inscriptions     5  │                                                              │
│  Classes             │                                                              │
│ FINANCES             │                                                              │
│  Paiements        2  │                                                              │
│ PARAMÈTRES ▸         │                                                              │
│ ─────────────────── │                                                              │
│ (FB) Fahari · Admin ▾│                                                              │
└──────────────────────┴──────────────────────────────────────────────────────────────┘
Mobile : header [≡] Titre [🔍]   ·   bottom bar : Accueil | Présences | Recherche | Menu
```

### Home

Structure :

- Plus de hero gradient. Un salut sobre avec la date et la période.
- Bloc 1, **À faire aujourd'hui** : une file d'actions cliquables qui mènent chacune à une liste pré-filtrée par l'URL.
  - Appels non faits.
  - Inscriptions en attente d'activation.
  - Chèques non encaissés.
  - Familles avec solde échu.
- Bloc 2, **Cours du jour** : une timeline avec l'état de l'appel.
- Bloc 3 : 4 KPI compacts, sur une seule primitive `StatCard` cliquable. Chiffre en `tabular-nums`, delta vs période précédente, pas de tuile d'icône colorée.
- Bloc 4 : encaissements mensuels et remplissage des classes, repliés sous le pli.
- Supprimer la tendance élèves tant qu'elle n'est pas calculée sur des données historisées.

Enseignant : même page, variante « Mes cours du jour » + « Appels à faire ». La redirection de `DD/page.tsx:49-51` disparaît.

Références Mobbin :

- [Shopify home](https://mobbin.com/screens/a14400bb-6617-4890-af09-01c012c69998) : chips « Fulfill orders 4 / Capture payments 1 », exactement le modèle de la file d'actions.
- [HoneyBook home](https://mobbin.com/screens/db20d057-61a0-4a8d-ba52-49bda519a6b8) : 3 compteurs, « Create new » et calendrier.
- [Buffer home](https://mobbin.com/screens/29f01d44-ab0e-4391-a7e9-6b344506e465) : blocs « Up next » avec état vide propre.
- [Shopify Orders](https://mobbin.com/screens/62d10f3a-1af9-4731-9d70-fca27b387369) : bande de KPI compacte au-dessus d'une table.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Bonjour Fahari            mardi 24 sept. · Période 2025-2026    [+ Nouveau]│
├────────────────────────────────────────────────────────────────────────────┤
│ À FAIRE AUJOURD'HUI                                                        │
│ [● 3 appels non faits →] [● 5 inscriptions à activer →]                    │
│ [● 2 chèques à encaisser →] [● 12 familles avec solde →]                   │
├───────────────────────────────────────┬────────────────────────────────────┤
│ COURS DU JOUR                         │ Élèves      Encaissé   Reste   Taux│
│ 09:00 CP-A  · M. Karim   ✓ appel fait │ 184 +6      12 480 €  3 210 €  79 %│
│ 10:30 CE1   · Mme Sara   ○ à faire  → │ (StatCard cliquables, tabular-nums)│
│ 14:00 CM2   · M. Idriss  ○ à venir    │                                    │
├───────────────────────────────────────┴────────────────────────────────────┤
│ Encaissements mensuels (bar)          │ Remplissage des classes (barres)   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Listes

- **État dans l'URL** : `?q=&status=&sort=&page=`, lu par le Server Component, avec pagination et filtres côté Prisma. `RichDataTable` devient contrôlé.
- **Vues en onglets avec compteurs** au-dessus de la table :
  - Inscriptions : Toutes · En attente · Actives · Annulées.
  - Paiements : Tous · Non encaissés · Espèces · Chèque.
  - Familles : Toutes · Avec solde · Sans inscription.
- **Filtres en chips** ajoutables (« Classe est CP-A ✕ »).
- **Table** :
  - en-tête neutre (`bg-alabaster-950`, texte `text-graphite-600`, `text-xs font-medium`) et sticky ;
  - `aria-sort` sur les colonnes triables ;
  - lien sur la cellule nom plutôt qu'un `role="button"` sur `<tr>` ;
  - montants alignés à droite en `tabular-nums` ;
  - statuts en « dot + libellé » neutre plutôt qu'en pastilles saturées.
- **Sélection + barre d'actions flottante** : relancer les soldes, exporter CSV, marquer encaissé.
- **Mobile < md** : rendu en liste de cartes (nom, statut, montant), jamais `min-w-[600px]`.
- **Drawer de détail** : ouvert via `?selected=id` pour rester partageable, ou suppression du doublon avec `/enrollments/[id]`.
- Références :
  - [Shopify Orders filtre](https://mobbin.com/screens/9a5dbafc-fc4a-4bfb-9ae4-98b1a61ed95d) (chip « Payment status is Paid » et vues sauvegardées) ;
  - [Calendly Contacts](https://mobbin.com/screens/a633760b-536f-4387-af06-8056089fa6cc) (vues en pills, builder « Where … is … ») ;
  - [Delphi Audience](https://mobbin.com/screens/4faf4fee-bfbd-4ff5-b811-a0f8655c8138) (chips de filtre minimales) ;
  - [Copilot Money](https://mobbin.com/screens/4fe85a1d-bced-4d80-90c3-22eaa58a8ac6) (montants alignés, groupés par jour, panneau de détail) ;
  - [Midday](https://mobbin.com/screens/6ead266a-00ac-4779-ab2f-772183755698) (onglets « All / Review (1) »).

### Détails et formulaires

- **Page de détail** (famille) :
  - en-tête compact : nom, méta en ligne (solde, enfants, inscriptions), actions à droite, puis onglets ;
  - le hero-banner (`DD/families/[id]/_components/hero-banner.tsx`) reste en neutre, sans fond coloré ;
  - le pattern `?action=addPayment` (`DD/families/[id]/page.tsx` ~`:143-200`) est bon : le généraliser.
- **Règle dialogue / sheet / page** :
  - dialogue pour une saisie de 5 champs ou moins (paiement, archivage) ;
  - sheet latérale pour éditer une entité en gardant la liste visible ;
  - page pour un flux multi-étapes (inscription d'une famille).
  - Sur mobile, dialogue et sheet deviennent une bottom sheet (`U/dialog.tsx`, `U/drawer.tsx`).
- **Validation et toasts** :
  - erreurs sous le champ, focus sur le premier champ invalide ;
  - toasts sonner en bas à droite, sans `richColors` ;
  - action « Voir » dans le toast après création (36 `toast.success` à harmoniser via `src/lib/toast.ts`).
- **Destructif** :
  - ConfirmDialog localisé, bouton en rouge sobre ;
  - la modale reste ouverte et affiche l'erreur si l'action échoue ;
  - pour une suppression définitive, saisie du nom (déjà un impact calculé dans `DeleteFamilyDialog`).
- Références :
  - [Customer.io person](https://mobbin.com/screens/98aef2de-372a-4571-84fc-3635864db07d) (méta d'en-tête et onglets) ;
  - [Klaviyo profile](https://mobbin.com/screens/7a9377d8-6bc4-4746-bcde-a55418e9f376) (colonne détails et timeline d'événements) ;
  - [HoneyBook financials](https://mobbin.com/screens/55c66ffc-b64d-4121-a611-87ea0485505d) (échéancier « payé X sur Y » et menu « Mark as paid ») ;
  - [Shopify store credit](https://mobbin.com/screens/b64af623-aff3-439a-b5eb-d4a9a6c1617e) (solde en tête, transactions dessous).

### Présences

- **Remplacer le carrousel par une liste d'appel** :
  - tous les élèves sont « présent » par défaut ;
  - une ligne = avatar, nom et un segmented `P · A · R` de 44 px minimum ;
  - un tap sur A ou R suffit pour une exception.
- **Réduire les taps** :
  - bouton primaire collant en bas, « Valider l'appel (23 P · 2 A) » ;
  - la revue devient un récapitulatif dans ce bouton, pas une étape.
- **Filtres** : recherche et filtre « Non marqués » en haut ; compteurs en onglets plutôt qu'en pills.
- **À conserver** : l'autosave debounce (`attendance-panel.tsx:222-232`) et le garde `beforeunload`.
- **À corriger** :
  - libellés ICU au lieu de `.replace('{current}')` (`:294-296,407-409`) ;
  - date en chevrons « ‹ Aujourd'hui › » plutôt que le formulaire natif (`:307-354`).
- **Vue admin** (`DD/attendance/page.tsx`) : bonne base (filtres dans l'URL). Ajouter un résumé en tête, « 3 cours sans appel ».
- Références :
  - [Sweatpals check-in](https://mobbin.com/screens/a12748ab-e2c1-407b-8625-8b1ba6f1db0b) (onglets « All 4 · Not checked-in 3 · Checked-in 1 », coche par ligne) ;
  - [Luma guest list](https://mobbin.com/screens/9dd54074-60d0-4ca4-8723-fc41ad08b5ef) (onglets à compteurs, CTA bas) ;
  - [Meetup attendees](https://mobbin.com/screens/3dda809f-fb8e-42b8-a42d-7f40e9741f87) (recherche en bas, accessible au pouce).

### Planning

- **Vue semaine sur axe horaire** : colonnes lundi à samedi, lignes de 30 min, blocs colorés par niveau (palette catégorielle neutre, pas le primaire), ligne « maintenant », bouton « Aujourd'hui ».
- **Filtres** : chips enseignant, classe, salle ; conflits signalés sur le bloc.
- **Actions** : clic sur un bloc → popover (faire l'appel, modifier, supprimer), au lieu des 3 boutons dans chaque carte (`schedule-grid.tsx:105-129`).
- **Mobile** : vue jour en liste chronologique, qui est aussi la vue « Mes cours » de l'enseignant.
- Références :
  - [Klaviyo calendar](https://mobbin.com/screens/6b3dd16e-7760-46c9-9f32-6d6852777fa0) (semaine, filtres en chips, bascule List/Calendar) ;
  - [Sweatpals schedule](https://mobbin.com/screens/c2e1c5aa-eab9-4bc9-9b3e-c8ed15aa96dd) (indicateur maintenant, filtres Types/Providers) ;
  - [HoneyBook calendar](https://mobbin.com/screens/7c7c3a75-5fa2-4636-adc8-2787bd42812c) (légende catégorielle latérale).

### États

- **`EmptyState`** partout, en trois variantes :
  - « premier usage » : explication + CTA ;
  - « aucun résultat » : bouton « Effacer les filtres » ;
  - « rien à faire » : état positif, ex. « Tous les appels sont faits ».
- **Skeletons** calqués sur la mise en page cible, et le fallback du layout traduit.
- Références :
  - [Plain empty table](https://mobbin.com/screens/895f2118-fbd3-4ef7-8c09-c474432fee9c) (vide dans le cadre de la table, en-têtes conservés) ;
  - [Sweatpals empty](https://mobbin.com/screens/665f9f3d-e87b-4db3-83d7-9c904496d0f5) (titre, explication, CTA).

## 4. Plan

### Quick wins (≤ 1 jour chacun)

| #   | Changement                                                                                                   | Fichiers                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Item actif neutre + barre d'accent, sans gradient ni ombre                                                   | `src/features/dashboard/sidebar-nav-item.tsx`                                                                                                                                                                             |
| Q2  | En-têtes de tables neutres et sticky, `aria-sort`, lien sur la cellule nom                                   | `src/components/ui/rich-data-table/rich-data-table.tsx`, `src/components/ui/data-table/data-table.tsx`                                                                                                                    |
| Q3  | Supprimer le hero gradient et les marges négatives (corrige le débordement mobile)                           | `app/[locale]/(dashboard)/dashboard/page.tsx`, `app/[locale]/(dashboard)/dashboard/loading.tsx`                                                                                                                           |
| Q4  | Retirer la tendance élèves trompeuse, ou la libeller « inscriptions créées »                                 | `app/[locale]/(dashboard)/dashboard/page.tsx`, `app/[locale]/(dashboard)/dashboard/_components/student-trend-card.tsx`                                                                                                    |
| Q5  | Localiser `Cancel`, `...`, `Loading...`, `User` ; garder le ConfirmDialog ouvert en cas d'échec              | `src/components/ui/confirm-dialog.tsx`, `app/[locale]/(dashboard)/layout.tsx`, `app/[locale]/(dashboard)/dashboard/page.tsx`, `messages/*`                                                                                |
| Q6  | ⌘K : `Command.Item`, groupes « Aller à » et « Actions », raccourci selon l'OS, icône de recherche sur mobile | `src/features/dashboard/search-modal.tsx`, `src/features/dashboard/header-client.tsx`                                                                                                                                     |
| Q7  | Icônes uniques et regroupement de la nav (Aujourd'hui / Scolarité / Finances / Paramètres / Plateforme)      | `src/features/dashboard/sidebar-items.ts`, `src/features/dashboard/sidebar.tsx`                                                                                                                                           |
| Q8  | Montants en `tabular-nums` alignés à droite ; devise tirée de la config école                                | `app/[locale]/(dashboard)/dashboard/families/_components/families-data-table.tsx`, `.../payments/_components/payments-table.tsx`, `.../_components/school-insights.tsx`, `.../payments/_components/payments-overview.tsx` |
| Q9  | CTA « Enregistrer un paiement » sur la page Paiements                                                        | `app/[locale]/(dashboard)/dashboard/payments/page.tsx`                                                                                                                                                                    |
| Q10 | Appel : « Tout le monde présent » en bouton, avance auto après un tap, libellés ICU                          | `app/[locale]/(dashboard)/dashboard/my-classes/[id]/attendance/_components/attendance-panel.tsx`                                                                                                                          |
| Q11 | `EmptyState` dans les tables et la home                                                                      | `src/components/ui/rich-data-table/rich-data-table.tsx`, `src/components/ui/data-table/data-table.tsx`, `app/[locale]/(dashboard)/dashboard/page.tsx`                                                                     |

### Structurel (1 à 2 semaines)

| #   | Changement                                                                                                                  | Fichiers                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Slot `PageHeader` (fil d'Ariane, titre, actions, chip de période) dans le header ; supprimer le motif répété dans les pages | `src/features/dashboard/header-client.tsx`, `src/features/dashboard/period-selector.tsx`, `src/components/ui/breadcrumbs.tsx`, nouvelle `src/components/ui/page-header.tsx`, toutes les `app/[locale]/(dashboard)/dashboard/*/page.tsx` |
| S2  | Tables pilotées par l'URL et paginées côté serveur ; selects Prisma allégés                                                 | `src/components/ui/rich-data-table/rich-data-table.tsx`, `.../families/page.tsx`, `.../payments/page.tsx`, `.../enrollments/page.tsx`, `.../students/page.tsx`, gateways Prisma associées                                               |
| S3  | Vues en onglets avec compteurs + chips de filtres (statut, méthode, non encaissé, avec solde)                               | `.../enrollments/_components/enrollments-table.tsx`, `.../payments/_components/payments-table.tsx`, `.../families/_components/families-data-table.tsx`                                                                                  |
| S4  | Home « À faire aujourd'hui » + « Cours du jour » ; variante enseignant ; suppression de la redirection                      | `app/[locale]/(dashboard)/dashboard/page.tsx`, `.../_components/school-insights.tsx`, `.../_components/upcoming-events-card.tsx`, `src/features/dashboard/sidebar-items.ts`                                                             |
| S5  | Primitive unique `StatCard` cliquable, qui remplace les 3 KPI                                                               | nouvelle `src/components/ui/stat-card.tsx`, `.../dashboard/page.tsx`, `.../payments/_components/payments-overview.tsx`, `.../families/[id]/_components/kpi-card.tsx`                                                                    |
| S6  | Appel en liste « présent par défaut » + CTA collant                                                                         | `.../my-classes/[id]/attendance/_components/attendance-panel.tsx`, `.../student-attendance-card.tsx`                                                                                                                                    |
| S7  | Tokens de design : `--radius-*`, surfaces, `--accent` distinct de la marque ; purge des 75 `bg-white`                       | `src/styles/globals.css`, `src/components/ui/card.tsx`, `src/components/ui/button.tsx`, `src/components/ui/status-badge.tsx`, `src/components/ui/balance-badge.tsx`, `src/components/ui/data-table/cells.tsx`                           |
| S8  | Dialogue → bottom sheet sous `md` ; focus trap sur la sidebar mobile et la palette                                          | `src/components/ui/dialog.tsx`, `src/components/ui/drawer.tsx`, `src/features/dashboard/sidebar.tsx`, `src/features/dashboard/search-modal.tsx`                                                                                         |
| S9  | Switcher d'école : logos, recherche, pas d'overlay plein écran ; repli de la sidebar sorti du menu utilisateur              | `src/features/dashboard/school-switcher.tsx`, `src/features/dashboard/sidebar-user-menu.tsx`, `src/features/dashboard/sidebar-store.ts`                                                                                                 |

### Ambitieux (trimestre)

| #   | Changement                                                                                 | Fichiers                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Planning en calendrier semaine/jour sur axe horaire, avec détection de conflits            | `.../planning/_components/schedule-grid.tsx` (remplacé), `.../planning/page.tsx`, use case de conflits dans `src/` domaine planning |
| A2  | Sélection multiple + barre d'actions groupées (relance de solde, export, marquer encaissé) | `src/components/ui/rich-data-table/rich-data-table.tsx`, actions dans `app/[locale]/(dashboard)/_lib/`                              |
| A3  | Vues sauvegardées par utilisateur (filtres nommés)                                         | `src/components/ui/rich-data-table/*`, `prisma/schema.prisma` (préférences), `src/actions/`                                         |
| A4  | Palette ⌘K complète : récents, actions contextuelles, recherche paiements et inscriptions  | `src/features/dashboard/search-modal.tsx`, route de recherche serveur                                                               |
| A5  | Mode sombre, rendu possible par les tokens S7                                              | `src/styles/globals.css`, primitives `src/components/ui/*`                                                                          |
| A6  | Navigation mobile basse + home enseignant « Mes cours du jour » en PWA                     | `app/[locale]/(dashboard)/layout.tsx`, `src/features/dashboard/*`, `.../my-classes/page.tsx`                                        |
| A7  | Historisation des effectifs pour une vraie tendance élèves                                 | `prisma/schema.prisma`, job de snapshot, `.../_components/student-trend-card.tsx`                                                   |
