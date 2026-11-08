# Challenge design — synthèse

Trois revues indépendantes (code seul, références Mobbin), 2026-09-24 :

- [design-system.md](design-system.md) — tokens, typo, cohérence, accessibilité, dark mode
- [dashboard.md](dashboard.md) — shell, accueil, tableaux, formulaires, présences, planning
- [public-parent.md](public-parent.md) — landing, pages école, auth, invitation, parcours parent, Stripe

## Verdict

L'app est fonctionnelle mais datée et incohérente : palette brute sans couche sémantique, aucune police
chargée, pas de dark mode, dégradés et ombres colorées, couleur de l'école qui envahit l'interface.
Les parents et les visiteurs n'ont ni accueil ni vue dédiée. Cible : chrome neutre et calme façon
Linear / Attio, primaire en accent seulement, statuts et montants lisibles, parcours parent de première classe.

| Axe                   | Note /5 |
| --------------------- | ------- |
| Modernité             | 2       |
| Cohérence             | 1.5     |
| Accessibilité         | 2       |
| Dark mode             | 0       |
| Navigation / tableaux | 2.5 / 2 |
| Mobile                | 2       |
| Première impression   | 1.5     |
| Parcours parent       | 2       |

## Constats partagés par les trois revues

1. **Primaire brandable partout** : nav active, en-têtes de tableaux, hero, avatars
   (`sidebar-nav-item.tsx:72`, `data-table.tsx:38`, `rich-data-table.tsx:158`, `dashboard/page.tsx:209`).
   Une école jaune ou rouge rend l'app illisible.
2. **Couleurs codées en dur** : 69 à 75 `bg-white`, gris ad hoc, aucun token de surface.
3. **Inter jamais chargée** (`globals.css:75`, `layout.tsx:73`) ; e-mails en Fraunces + Karla.
4. **Overflow mobile** de l'accueil (`-mx-6 -mt-16`, `dashboard/page.tsx:209`).
5. **Chaînes non traduites** : « Cancel », « Loading... », `'User'`, « 1 Enfants ».
6. **Thème école non borné** : nuanciers qui mettent un jaune vif en survol ; aucun contrôle de contraste.

## Arbitrages

| Sujet             | Désaccord                                                                        | Décision                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Item de nav actif | Fond teinté primaire (design-system) vs fond neutre + barre primaire (dashboard) | **Fond neutre + barre 2px primaire** : le primaire est arbitraire par école, il reste un accent                                                   |
| Fraunces          | Titres de page en Fraunces (design-system)                                       | **Fraunces réservée aux surfaces publiques**, à la salutation, à l'affiche et aux e-mails. Titres du dashboard en Inter 600 : l'outil reste sobre |
| Police UI         | Inter ou Geist                                                                   | **Inter Variable** (latin-ext, lisibilité des noms), Geist Mono pour le code                                                                      |
| Thème école       | Nuancier complet vs primaire seul                                                | **Primaire seul**, déclinaisons calculées en OKLCH, refus sous 4.5:1                                                                              |

## Direction cible

- **Tokens sémantiques OKLCH** light/dark : surfaces, texte, bordures, primaire, focus, succès / attention /
  danger / info avec fond pâle. Détail : design-system.md §3.
- **Typo** : Inter Variable, graisses 400/500/600, chiffres tabulaires alignés à droite pour tout montant.
- **Forme** : rayons 6/8/10/14, ombres neutres, tokens de durée et d'easing, `prefers-reduced-motion` global.
- **Un seul système de statut** (`status-tones.ts` + `Badge`) pour paiements, inscriptions, présences.
- **Shell** : en-tête de page commun (fil d'Ariane, titre, action principale, chip de période), ⌘K réparé.
- **Accueil** : file d'actions du jour ; variantes admin, enseignant, parent.
- **Présences** : liste « tous présents », exceptions en un tap, validation collante.
- **Public** : accueil par école, login deux colonnes à l'image de l'école, invitation qui dit qui invite.

## Feuille de route

Chaque lot est une PR autonome, vérifiable visuellement.

| Lot                      | Contenu                                                                                                                                                                              | Effort      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 1. Fondations            | Inter via `next/font`, tokens sémantiques OKLCH, focus ring visible, contraste des gris et bordures, retrait des dégradés et ombres colorées, overflow mobile, chaînes non traduites | S–M         |
| 2. Cohérence             | Remplacement des couleurs codées en dur, `Badge` + `status-tones`, montants tabulaires, échelle typo et rayons                                                                       | M           |
| 3. Thème école           | Primaire seul, dérivation OKLCH, validation du contraste, appliqué partout y compris e-mails                                                                                         | M           |
| 4. Dark mode             | `next-themes`, surfaces sombres étagées, sélecteur dans le menu utilisateur                                                                                                          | S (après 2) |
| 5. Shell et accueil      | En-tête de page commun, ⌘K clavier complet, accueil « à faire » par rôle, graphique élèves corrigé ou retiré                                                                         | M–L         |
| 6. Parcours parent       | Tableau de bord parent (carte par enfant), vue présences parent, Stripe au nom de l'école + page de confirmation                                                                     | M–L         |
| 7. Public et auth        | Accueil école, login deux colonnes, invitation contextualisée, pages d'erreur, événements cliquables + QR sur l'affiche                                                              | M–L         |
| 8. Listes                | État dans l'URL, pagination serveur, onglets avec compteurs, filtres en chips, actions groupées                                                                                      | L           |
| 9. Présences et planning | Appel en liste, vue semaine sur axe horaire avec détection de conflits                                                                                                               | L           |

Ordre recommandé : 1 → 2 → 3 → 4, puis 5 à 9 selon la priorité métier (6 et 9 touchent le plus
d'utilisateurs au quotidien).

## Avancement

| Lot                 | État                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| 1. Fondations       | Livré (#379)                                                                               |
| 5. Shell et accueil | Livré (#381), y compris l'accueil parent du lot 6                                          |
| 7. Public et auth   | Login, mot de passe et invitation livrés (#380) ; accueil école et pages d'erreur restants |
| 2, 3, 4, 6, 8, 9    | À faire                                                                                    |

## Limites

Revue du code uniquement : aucun parcours authentifié dans un navigateur. Valider chaque lot par captures
avant fusion.
