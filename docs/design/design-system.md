# Design system — audit et direction cible

> Angle : système de design et identité visuelle. Jugé sur le code (pas de session navigateur).
> Références : Mobbin (Linear, Attio, Stripe, Vercel, Jobber, Fresha, Uxcel).

## 1. Verdict

L'application n'a pas de design system : elle a une palette coolors.co (`graphite`, `stormy-teal`, `alabaster`,
`yale-blue`) posée dans `@theme`, sans couche sémantique, sans mode sombre et sans police chargée. Chaque écran
recompose ses couleurs à la main (plus de 60 fichiers utilisent `red-*`/`amber-*`/`emerald-*` en dur). Les rares
effets « premium » (dégradés sur l'en-tête de tableau et la navigation active, ombre colorée) datent de 2019,
pas de 2026. La base (Tailwind v4, CVA, primitives locales, thème par école) est saine et se refond vite.

| Axe | Note | Pourquoi, en une ligne |
|---|---|---|
| Modernité | 2/5 | Rayon 4px partout, dégradés primaires, `font-bold` généreux, aucune typo chargée |
| Cohérence | 1.5/5 | Trois langages coexistent (`rounded` 4px / `rounded-xl` / `rounded-3xl`), couleurs d'état ad hoc |
| Lisibilité | 3/5 | Hiérarchie correcte, mais montants non tabulaires et gris secondaires trop pâles |
| Accessibilité | 2/5 | Anneau de focus invisible sur le bouton primaire, bordures d'input à 1,4:1, gris à 3,6:1 |
| Mode sombre | 0/5 | Inexistant : aucune variante `dark:`, 69 `bg-white` codés en dur |

## 2. Problèmes, par ordre d'impact

1. **Pas de couche de tokens sémantiques.** `src/styles/globals.css:3-77` n'expose que des gammes brutes et
   quelques alias (`primary`, `text`, `muted`, `border`). Il manque `surface`, `foreground`, `muted-foreground`,
   `ring`, `input`, `success/warning/danger/info` (fond + texte). Résultat : 69 `bg-white`, 24 `bg-red-50`,
   21 `text-red-600`, 19 `bg-amber-50`… dans 60+ fichiers (`app/**`, `src/features/**`, et même les primitives
   `src/components/ui/button/button.tsx:16`, `status-badge/status-badge.tsx:9-17`,
   `balance-badge/balance-badge.tsx:12`, `data-table/cells.tsx:1-15`). Impact : le mode sombre est impossible et
   le sens métier (payé / en retard / absent) s'exprime avec quatre verts différents (`green-*`, `emerald-*`,
   `#10b981`, `bg-green-500`).
2. **Token `success` mort, états métier sans source unique.** `--color-success` (`globals.css:68`, `#10b981`) n'est
   utilisé nulle part. Le statut paiement vit dans `status-badge.tsx:9-17` (emerald/amber/blue/red-100),
   `kpi-card.tsx:9-37` (green/amber-50), `financial-summary.tsx:58-85` (green/amber/blue-50 + pastilles
   `-500`) et `cells.tsx:1-15` (green/amber/red/blue-500/700). Impact : impossible de changer la teinte « en retard »
   d'un seul endroit ; les parents lisent des signaux incohérents d'un écran à l'autre.
3. **Aucune police réellement chargée.** `--font-sans: 'Inter', system-ui` (`globals.css:75-76`) sans `next/font`
   ni `@font-face` : sur Windows/Android, l'app s'affiche en Segoe UI / Roboto. `font-heading` n'a que 3 usages.
   Pendant ce temps, les e-mails chargent Fraunces + Karla (`src/lib/email-template.ts:140`) : deux identités.
4. **Focus clavier cassé sur le bouton principal.** `button.tsx:6` pose `focus-visible:ring-2 ring-offset-2` sans
   couleur : en Tailwind v4 l'anneau hérite de `currentColor`, donc blanc sur le bouton primaire (texte blanc),
   posé sur un offset blanc, donc invisible. `rich-data-table.tsx:208` n'indique le focus d'une ligne que par
   `bg-alabaster-900` (#f7f7f7 sur blanc, soit 1,07:1). `sidebar-nav-item.tsx:68-74` n'a aucun style de focus.
   Impact : WCAG 2.4.7 / 2.4.11 non respectés sur les actions principales.
5. **Contrastes insuffisants.** `text-graphite-700` (#868686, 3,6:1 sur blanc) : 31 usages, dont les placeholders
   (`input/input.tsx:12`) et le raccourci clavier (`header-client.tsx:56`). `text-graphite/60`
   (`payments-table.tsx:71`) : même valeur. La bordure `border-alabaster` (#d9d9d9, 1,4:1) délimite seule les
   champs (`input.tsx:11`), ce qui échoue à WCAG 1.4.11. L'en-tête de tableau (`data-table.tsx:38,45`) met
   `text-white/90` en 12px sur un dégradé qui finit à `primary/70`, environ 3:1 selon la palette d'école.
6. **Thème d'école non borné.** `theme-palettes.ts:55-65` fournit 10 nuanciers, mais `theme_primary_light`
   y sert de couleur d'accent (`midnight` : `#ffd60a`, `burgundy` : `#fff3b0`) alors que `button.tsx:13-14`
   l'utilise comme fond de survol : on obtient un survol jaune vif sur un thème marine. `text-white` est codé en dur
   sur `primary` (`button.tsx:10`), alors que l'éditeur accepte n'importe quel hex (`theme-provider.tsx:27`
   ne vérifie que le format). Impact : une école peut produire un bouton illisible.
7. **Langage visuel fragmenté.** Rayons : 227 `rounded` (4px), 8 `rounded-xl`, 3 `rounded-3xl`. La carte de
   présence (`student-attendance-card.tsx:144`) utilise `rounded-3xl` et
   `shadow-[0_18px_50px_-34px_rgba(53,53,53,0.42)]`, les dialogues `rounded-xl shadow-2xl` (`dialog.tsx:204`),
   les cartes `rounded shadow-sm` (`card.tsx:11`). 21 appels réécrivent `<Card className="rounded border …
   bg-white">` (ex. `dashboard/page.tsx:230,253,266`), ce qui annule la primitive. Les voiles de fond diffèrent
   aussi : `bg-graphite/50 backdrop-blur-sm` (`dialog.tsx:194`) contre `bg-black/50` (`sidebar.tsx:106`).
8. **Effets datés.** Dégradé primaire sur `thead` (`data-table.tsx:38`), navigation active en dégradé avec
   `shadow-lg shadow-primary/25` (`sidebar-nav-item.tsx:72`), monogrammes en dégradé (`sidebar-brand.tsx:35`,
   `school-switcher.tsx:177`), hero en dégradé avec marges négatives `-mx-6 -mt-16`
   (`dashboard/page.tsx:209`) alors que `main` n'a que `p-4` en mobile (`(dashboard)/layout.tsx:116`) : 8px de
   débordement horizontal. Linear, Attio et Stripe réservent la couleur à l'état et à l'action, jamais à la
   décoration de structure.
9. **Chiffres non tabulaires.** `tabular-nums` apparaît 16 fois, mais pas sur les montants de
   `payments-table.tsx:69` (alignés à gauche), `dashboard/page.tsx:234,257,272,284` (KPI en `text-3xl font-bold`),
   `kpi-card.tsx`, `financial-summary.tsx:61-81`, `families-data-table.tsx`. Impact : des colonnes d'euros qui
   « dansent », ce qui est rédhibitoire pour un écran de paiements.
10. **Échelle typographique et poids non gouvernés.** 45 `font-bold` et 4 `font-extrabold`, 15 tailles
    arbitraires (`text-[10px]` dans `circle-progress.tsx:68`, `enrollment-menu.tsx:84`, `student-trend-card.tsx:59` ;
    10px est illisible pour un public non technique), 42 `uppercase` avec trois `tracking` différents.
    `.display-*` (`globals.css:155-169`) monte à `text-7xl` sans usage applicatif.
11. **Nommage des gammes inversé et absurde.** `graphite-100` est le plus sombre (`globals.css:5`), à l'inverse
    de la convention Tailwind ; `white-100` vaut `#333333` (`globals.css:27`). Chaque contributeur doit deviner.
12. **Mouvement ad hoc.** Une seule chorégraphie soignée (`attendance-success-*`, `globals.css:101-153`, avec
    `prefers-reduced-motion`). Ailleurs : `transition-all` (`sidebar-nav-item.tsx:69`), 2 usages de
    `motion-reduce` en tout, pas de token de durée ou de courbe. Le fallback `Loading...` en anglais brut
    (`(dashboard)/layout.tsx:117`) tient lieu de squelette.

## 3. Direction cible

**Principe :** neutre d'abord, couleur au service du sens. La surface est quasi achromatique (légèrement froide) ;
la couleur d'école ne colore que l'action primaire, la sélection et le focus ; quatre couleurs d'état sémantiques
portent le métier (payé, partiel, en retard, info). C'est la grammaire de Stripe Transactions et d'Attio.

### Références Mobbin

- [Stripe — Transactions](https://mobbin.com/screens/80054ec0-bb9d-4438-9a66-4f7bcd8f103f) : montant en
  première colonne, gras, tabulaire ; badges d'état en fond pâle + icône ; filtres en « pills » à bordure fine ;
  onglets de segmentation avec compteur. Modèle direct pour `payments` et `families/[id]` (historique).
- [Stripe — Customers](https://mobbin.com/screens/2a858526-95c9-459a-b429-e8440cda56ff) : montants alignés à
  droite, en-tête de tableau sans fond, sur une simple bordure basse. C'est l'antithèse de `data-table.tsx:38`.
- [Attio — fiche entreprise](https://mobbin.com/screens/297adfeb-8312-496b-8acf-41839a6cf775) : fiche détaillée
  en deux colonnes (activité à gauche, propriétés à droite), libellés en `muted-foreground` 13px, icônes 14px.
  Modèle pour `families/[id]` et `students/[id]`.
- [Linear — liste (sombre)](https://mobbin.com/screens/e142df2a-3527-499c-8f81-1b715947ac0c) et
  [Linear — préférences](https://mobbin.com/screens/c968b3b2-82a5-4044-8e4a-0bec5683dec5) : mode sombre à
  surfaces étagées (fond, carte, survol) sans ombres, bordures en blanc translucide. Les préférences en lignes
  groupées (libellé, description, contrôle à droite) servent de modèle pour `dashboard/config` et `settings`.
- [Vercel — vue d'ensemble (sombre)](https://mobbin.com/screens/9b397b77-fd80-4157-9867-2ae4010133a4) et
  [clair](https://mobbin.com/screens/c3f6e8b8-e010-4773-a6a9-a9ff08d09281) : même composition dans les deux
  thèmes, cartes à rayon ~12px, bordure 1px plutôt qu'ombre, action primaire monochrome.
- [Jobber — accueil](https://mobbin.com/screens/7b64ed35-d1f3-4de9-adf5-75cc96a9f0f5) : salutation datée et
  KPI grand format lisibles par un public non technique. Remplace le hero en dégradé de `dashboard/page.tsx:209`.
- [Uxcel — liste d'assignations](https://mobbin.com/screens/b3684df1-20b6-495a-aab5-471ca8df5c78) et
  [Fresha — liste de formulaires](https://mobbin.com/screens/77260bad-dd3d-4ba6-8db8-cd9fefa57982) : statut en
  pill pâle et avatar à initiales, soit un contexte éducation et service proche du public parents.
- [ClassDojo — classe](https://mobbin.com/screens/51b729e7-a715-45e2-8625-7b679dd908d7) : action de masse
  « Tous présents / Tous absents » en barre basse collante, pertinent pour `my-classes/[id]/attendance`.
  À prendre pour l'ergonomie, pas pour le style (trop ludique pour l'administration).

### Palette (OKLCH)

Couche sémantique à exposer via `@theme inline` (noms alignés sur shadcn pour que les composants du registre
fonctionnent sans adaptation). Contrastes calculés sur `surface`.

| Token | Clair | Sombre | Usage / contraste |
|---|---|---|---|
| `--background` | `oklch(0.985 0.002 250)` | `oklch(0.16 0.005 260)` | Canevas de l'app |
| `--surface` (`card`, `popover`) | `oklch(1 0 0)` | `oklch(0.195 0.006 260)` | Cartes, tableaux, dialogues |
| `--surface-2` (`accent`, `muted`) | `oklch(0.97 0.003 250)` | `oklch(0.235 0.007 260)` | Survol, zones en retrait, `thead` |
| `--foreground` | `oklch(0.21 0.01 260)` | `oklch(0.96 0.003 260)` | Texte, environ 16:1 |
| `--muted-foreground` | `oklch(0.50 0.012 260)` | `oklch(0.71 0.01 260)` | Libellés, méta ; ≥ 5,5:1 (remplace `graphite-600/700`) |
| `--placeholder` | `oklch(0.55 0.01 260)` | `oklch(0.64 0.01 260)` | ≥ 4,5:1 |
| `--border` | `oklch(0.92 0.004 260)` | `oklch(1 0 0 / 0.08)` | Séparateurs, contours de carte |
| `--input` | `oklch(0.66 0.008 260)` | `oklch(0.49 0.01 260)` | Contour de champ, 3:1 (WCAG 1.4.11) |
| `--primary` (défaut école) | `oklch(0.47 0.075 195)` | `oklch(0.74 0.09 195)` | Teal historique, plus dense ; blanc dessus 6,8:1 |
| `--primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.18 0.03 195)` | Calculé, pas codé en dur (voir plus bas) |
| `--primary-subtle` | `oklch(from var(--primary) 0.96 0.02 h)` | `oklch(from var(--primary) 0.28 0.04 h)` | Sélection, survol ghost ; **dérivé**, plus saisi |
| `--ring` | `oklch(from var(--primary) l c h / 0.55)` | idem | Anneau 2px + offset 2px `--background` |
| `--success` / `-subtle` | `oklch(0.50 0.12 155)` / `oklch(0.965 0.03 155)` | `oklch(0.78 0.13 155)` / `oklch(0.27 0.045 155)` | Payé, présent, actif |
| `--warning` / `-subtle` | `oklch(0.52 0.11 65)` / `oklch(0.965 0.04 85)` | `oklch(0.82 0.12 80)` / `oklch(0.28 0.05 75)` | Partiel, en retard, solde dû |
| `--danger` / `-subtle` | `oklch(0.53 0.19 25)` / `oklch(0.965 0.02 25)` | `oklch(0.72 0.16 25)` / `oklch(0.27 0.06 25)` | Impayé, absent, annulé, destructif |
| `--info` / `-subtle` | `oklch(0.52 0.13 250)` / `oklch(0.965 0.02 250)` | `oklch(0.75 0.11 250)` / `oklch(0.27 0.05 250)` | Terminé, informatif |
| `--chart-1…5` | primary, info, success, warning, `oklch(0.60 0.10 300)` | versions `L+0.2` | Graphiques (`bar-chart`, courbes) |

**Thème d'école :** garder `theme_primary` comme **seule** entrée utilisateur et en dériver le reste avec la
syntaxe de couleur relative OKLCH (`oklch(from …)`). `theme_primary_hover` et `theme_primary_light`
deviennent des valeurs calculées ; `theme_background` disparaît ou devient une teinte bornée à `C ≤ 0.01`.
`primary-foreground` est choisi côté serveur (blanc ou `oklch(0.18 …)` selon le contraste), et l'enregistrement
est refusé si aucun des deux n'atteint 4,5:1.

### Rayon, bordures, ombres

- `--radius: 0.625rem` ; `sm 6px` (badges, kbd), `md 8px` (boutons, inputs, items de nav), `lg 10px`,
  `xl 14px` (cartes, dialogues), `full` (pills de statut, avatars). Supprimer `rounded-3xl`.
- Bordure 1px `--border` partout. La profondeur vient de l'étagement des surfaces, pas des ombres.
- Ombres (clair) : `--shadow-xs: 0 1px 2px oklch(0.2 0.01 260 / 0.05)` (boutons, inputs) ;
  `--shadow-sm: 0 1px 2px oklch(0.2 0.01 260 / 0.04), 0 1px 3px oklch(0.2 0.01 260 / 0.06)` (cartes au survol) ;
  `--shadow-lg: 0 0 0 1px var(--border), 0 12px 32px -8px oklch(0.2 0.01 260 / 0.16), 0 4px 8px -4px oklch(0.2 0.01 260 / 0.08)`
  (popover, dialogue, menu). Sombre : remplacer par `inset 0 1px 0 oklch(1 0 0 / 0.05)` plus la bordure.
  Interdire les ombres colorées (`shadow-primary/25`).

### Typographie

- **UI : Inter Variable** via `next/font/google` (`subsets: ['latin', 'latin-ext']`, `display: 'swap'`,
  `variable: '--font-sans'`), avec `font-feature-settings: 'cv05', 'cv08'` pour distinguer `l`, `I` et `1`
  dans les noms et les références de reçu. Alternative plus « Vercel » : Geist ; Inter reste plus robuste pour
  le français (accents, guillemets) et un public non technique.
- **Display : Fraunces** (`opsz`, 600), réservée aux H1 de page, à la salutation du tableau de bord, à l'affiche
  imprimée et aux e-mails, ce qui unifie avec `email-template.ts:140`. C'est la touche « digne »,
  institutionnelle, qui distingue une école d'un CRM. Une seule graisse, jamais sous 24px.
- **Mono : Geist Mono** pour clés API, identifiants, raccourcis (les 12 usages `font-mono`).
- Échelle (taille/interligne) : `xs 12/16`, `sm 13/20` (cellules de tableau), `base 14/20` (corps UI),
  `md 16/24` (lecture, formulaires parents sur mobile), `lg 18/26` (titre de carte), `xl 20/28` (H2),
  `2xl 24/32` (H1 UI), `display 32/38` (Fraunces), `kpi 30/36` (chiffres).
  Minimum absolu 12px : supprimer `text-[10px]`.
- Graisses : 400, 500 et 600 seulement. `font-bold` et `font-extrabold` sortent de l'UI.
- Chiffres : `tabular-nums` par défaut sur `td`, KPI et tout `formatCurrency` ; montants alignés à droite,
  devise en `muted-foreground`.
- Surtitres en capitales : une seule recette `text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground`.

### Mouvement et focus

- Tokens : `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`, `--duration-fast: 120ms` (survol, pression),
  `--duration-base: 180ms` (popover, onglets), `--duration-slow: 280ms` (dialogue, tiroir).
  Transitions ciblées (`transition-[background-color,box-shadow]`), jamais `transition-all`.
- Focus unique : `outline-2 outline-offset-2 outline-[--ring]` sur tout élément interactif (via `@layer base`
  sur `:focus-visible`), visible sur fond clair, sombre et primaire.
- `prefers-reduced-motion` global dans `globals.css`, pas au cas par cas.

## 4. Plan

### Quick wins (< 1h chacun)

| # | Action | Fichiers |
|---|---|---|
| Q1 | Charger Inter via `next/font`, brancher `--font-sans` | `app/[locale]/layout.tsx`, `src/styles/globals.css` |
| Q2 | Anneau de focus coloré (`ring-[--color-primary]/55 ring-offset-background`) + focus des items de nav et des lignes de tableau | `src/components/ui/button/button.tsx:6`, `rich-data-table/rich-data-table.tsx:208`, `src/features/dashboard/sidebar-nav-item.tsx:68` |
| Q3 | `thead` neutre : `bg-surface-2`, texte `muted-foreground`, bordure basse ; retirer le dégradé | `src/components/ui/data-table/data-table.tsx:38-45` |
| Q4 | Nav active sobre : `bg-primary-subtle text-primary font-medium` + barre 2px ; retirer le dégradé et l'ombre colorée | `sidebar-nav-item.tsx:72` |
| Q5 | `tabular-nums` + alignement à droite sur tous les montants | `payments-table.tsx:69`, `dashboard/page.tsx:234-284`, `kpi-card.tsx`, `financial-summary.tsx`, `families-data-table.tsx`, `enrollments-table.tsx` |
| Q6 | Remplacer `text-graphite-700` et `text-graphite/60` par `graphite-600` en attendant `muted-foreground` | 31 occurrences (`input.tsx:12`, `header-client.tsx:48,56`, `payments-table.tsx:71`…) |
| Q7 | Bannir `text-[10px]` (monter à `text-xs`) | `circle-progress.tsx:68`, `enrollment-menu.tsx:84`, `student-trend-card.tsx:59`, `event-images-dialog.tsx:175`, `header-client.tsx:56` |
| Q8 | Retirer le hero en dégradé à marges négatives ; salutation + date sur fond neutre (modèle Jobber) | `app/[locale]/(dashboard)/dashboard/page.tsx:209` |
| Q9 | Un seul voile de fond `bg-foreground/40 backdrop-blur-[2px]` | `dialog.tsx:194`, `sidebar.tsx:106`, `drawer/drawer.tsx` |
| Q10 | Squelette traduit à la place de `Loading...` | `app/[locale]/(dashboard)/layout.tsx:117` |

### Structurel (tokens et primitives)

1. **Réécrire `globals.css`** : couche sémantique du §3 dans `:root` / `.dark`, exposée par `@theme inline`
   (`--color-surface`, `--color-muted-foreground`, `--color-success-subtle`…). Renommer ou supprimer les gammes
   inversées (`graphite-*`, `white-*`, `alabaster-*`, `yale-blue-*`) ; les garder en alias dépréciés une version,
   puis les retirer via un codemod. Supprimer `.display-*` non utilisés. — `src/styles/globals.css`
2. **Mode sombre** : `next-themes` (attribut `class`), `@custom-variant dark (&:where(.dark, .dark *))`,
   interrupteur dans le menu utilisateur (`sidebar-user-menu.tsx`) et `settings`. Pré-requis : zéro `bg-white`
   hors primitives (69 occurrences). — `app/[locale]/layout.tsx`, `src/features/dashboard/*`, `app/**`
3. **Primitive `Badge` / `StatusBadge` unique**, avec variantes sémantiques (`success|warning|danger|info|neutral`)
   + icône optionnelle 12px (modèle Stripe), et mapping métier centralisé (`paymentStatusTone`,
   `attendanceStatusTone`, `enrollmentStatusTone`). Fusionner `BalanceBadge` et `StatusDot`.
   — `src/components/ui/status-badge`, `balance-badge`, `data-table/cells.tsx`, nouveau `src/lib/status-tones.ts`
4. **Primitive `Stat`** (libellé, valeur tabulaire, delta, icône neutre 16px) ; supprimer les palettes locales
   de `kpi-card.tsx:9-37` et les 21 `<Card className="rounded border … bg-white">`.
   — `src/components/ui/stat` (nouveau), `families/[id]/_components/kpi-card.tsx`, `dashboard/page.tsx`,
   `_components/school-insights.tsx`
5. **Primitives alignées sur les tokens** : `Card` (`rounded-xl border-border bg-surface`, sans ombre),
   `Input`/`Select`/`Textarea` (`border-input`, `h-9`, `shadow-xs`, focus unifié), `Button` (`h-9` par défaut,
   `sm h-8`, `lg h-10` ; retirer `xl h-14` ; `destructive` en `bg-danger`), `Dialog` (`rounded-xl shadow-lg`).
   — `src/components/ui/{card,input,select,button,dialog,drawer,tabs}`
6. **Thème d'école dérivé** : une seule couleur saisie ; `hover`, `subtle`, `ring` et `foreground` calculés en
   OKLCH ; validation du contraste à l'enregistrement ; refonte des 10 nuanciers en teintes seules.
   — `src/lib/theme-palettes.ts`, `src/components/theme-provider.tsx`, `config/_components/theme-palette-editor.tsx`,
   `use-cases/config/*` (validation), `docs/business-rules.md`
7. **Icônes** : `size-4` (16px) dans le texte et les boutons, `size-3.5` dans les badges, `size-5` réservé à la
   navigation ; `strokeWidth={1.75}` par défaut. Remplacer les 133 `h-x w-x` par `size-*`.
   — `sidebar-nav-item.tsx:76` (`size={20}`), `dashboard/page.tsx:242,261,276` (`h-6 w-6`)
8. **Garde-fous** : règle dans `.agents/rules/tailwind-v4.md` interdisant les gammes Tailwind brutes
   (`red-*`, `amber-*`…) hors `globals.css`, et un test ou script `grep` en CI qui échoue sur
   `\b(bg|text|border)-(red|amber|green|emerald|blue)-\d`.

### Ambitieux (détails signature)

1. **Titres Fraunces + corps Inter** : H1 de page, salutation et affiche imprimée en Fraunces 600 `opsz` auto,
   unifiés avec les e-mails. C'est la seule concession « éditoriale », et elle suffit à rendre l'app digne plutôt
   que générique. — `globals.css` (`--font-display`), `app/[locale]/layout.tsx`, en-têtes de page, `(print)/**/affiche/page.tsx`
2. **Fiches famille et élève façon Attio** : deux colonnes (onglets activité / paiements / enfants à gauche,
   panneau de propriétés à droite avec libellés `muted-foreground`), fil d'activité à connecteurs fins, montants
   Stripe-like. — `families/[id]/page.tsx`, `_components/activity-feed.tsx`, `students/[id]/page.tsx`
3. **Palette de commandes `⌘K`** premium : groupes, raccourcis `kbd` stylés, aperçu de la famille et de son solde
   dans le panneau de droite. — `src/features/dashboard/search-modal.tsx`, `header-client.tsx:46-58`
4. **Micro-interactions métier** : compteur de montant animé à l'encaissement (`record-payment-dialog`),
   barre de progression de paiement qui se remplit, chorégraphie « présence validée » étendue en système
   (tokens de durée) avec action de masse collante « Tous présents » (modèle ClassDojo), toasts Sonner stylés
   aux tokens (`richColors` remplacé par des classes `toastOptions`). — `globals.css`, `attendance/_components/*`,
   `payments/_components/record-payment-dialog.tsx`, `app/[locale]/layout.tsx:78`
5. **Mode sombre soigné** : surfaces étagées façon Linear, graphiques recolorés via `--chart-*`, logo d'école
   sur pastille neutre pour les logos sombres, `color-scheme: dark` pour les contrôles natifs.
   — `globals.css`, `bar-chart`, `circle-progress`, `sidebar-brand.tsx`
6. **Densité réglable** (« Confortable / Compacte ») pour les administrateurs, par variable
   `--row-h` 40/32px sur les tableaux. — `rich-data-table.tsx`, `data-table.tsx`, préférences utilisateur
