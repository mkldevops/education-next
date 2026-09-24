# Revue design — surfaces publiques et parcours parent

Périmètre : landing, pages publiques école (événements, planning), affiche imprimée, auth (login, mot de
passe oublié/réinitialisation, passkey, Google), invitation, tableau de bord parent (famille, enfants,
planning, solde, paiement Stripe, présences), branding, pages d'erreur, emails, ton des messages fr/en.
Jugement sur le code uniquement (pas de session navigateur). Références visuelles : Mobbin.

---

## 1. Verdict

L'application est un back-office correct, mais sa façade publique n'existe pas encore.
`/` redirige vers le login. Aucune école n'a de page d'accueil, et le premier contact d'une famille est
une carte de login générique avec un bandeau coloré.
Le branding école se réduit à un logo et 4 hex, appliqués de façon incohérente d'une page à l'autre. Le
parent reçoit un dashboard d'admin (KPI d'effectifs, tableaux, onglets). Le ton oscille entre
administratif (« Non authentifié ») et du français codé en dur au milieu de l'anglais.
La base technique (next-intl, ThemeProvider, palettes AA, Stripe, ICS, passkeys) est saine : le
problème est la mise en scène, pas la fondation.

| Axe | Note /5 | Commentaire bref |
|---|---|---|
| Première impression | 1,5 | Pas de landing ni de page école ; police non chargée ; login daté |
| Confiance | 2,5 | Stripe rassure, mais checkout anonyme (« Frais de scolarité »), pas de reçu, email hors charte |
| Parcours parent | 2 | Dashboard admin recyclé, pas de présences, pas d'événements dans la nav |
| Auth / onboarding | 2,5 | Passkey + Google présents mais relégués ; invitation muette sur l'école et le rôle |
| Branding école | 2 | Thème appliqué sur 1 page publique sur 3 ; pas de garde de contraste runtime |
| Ton | 2,5 | Copy fr correcte par endroits, mais générique, robotique sur les erreurs, mélange fr/en |

---

## 2. Problèmes prioritaires (classés)

### P1 — Aucune vitrine : ni landing plateforme, ni page d'accueil école
- `app/[locale]/page.tsx:13-15` : `/` redirige vers `/dashboard` ou `/login`. Un parent qui tape l'URL
  tombe sur un formulaire.
- `app/[locale]/ecole/[slug]/` ne contient que `evenements/` et `planning/`. Pas de `page.tsx`, alors
  que le modèle `School` porte adresse, code postal et ville (`prisma/schema.prisma:116-125`).
- `app/[locale]/evenements/page.tsx:25-28` : avec plusieurs écoles actives, renvoie `notFound()`.
- `app/sitemap.ts:7` : seules `/login` et `/forgot-password` sont indexées ; pages événements et
  planning absentes.
- **Impact** : aucune URL partageable « l'école X » ; un lien sur une affiche ou dans un groupe
  WhatsApp de parents mène à une impasse ou à un login. C'est le moment de confiance n°1, et il est raté.

### P2 — Branding école incohérent et fragile
- Seule la page de détail événement applique le thème : `ecole/[slug]/evenements/[eventSlug]/page.tsx:81`
  (ThemeProvider + en-tête logo aux lignes 106-116). La liste `ecole/[slug]/evenements/page.tsx:101-115`
  et le planning `ecole/[slug]/planning/page.tsx:59-65` n'ont ni thème, ni logo, ni en-tête : on change
  d'identité visuelle en un clic.
- Le login ne connaît l'école que via le cookie de dernière visite (`app/[locale]/(auth)/login/page.tsx:37`,
  `src/lib/branding.ts:67-72`) : une première visite est anonyme.
- `src/components/theme-provider.tsx:21-34` accepte n'importe quel hex valide. Le test AA de
  `src/lib/theme-palettes.ts:54-65` ne couvre que les 10 presets. Une couleur libre claire rend
  illisible le texte blanc de `auth-card.tsx:20-23`.
- `src/lib/branding-config.ts:2-4` : seule clé `logo_url`. Pas d'accroche, de photo de couverture ni de
  contact.
- **Impact** : chaque école semble louer un outil, pas posséder son espace. La promesse
  multi-école n'est pas visible.

### P3 — Le parent vit dans un tableau de bord d'administrateur
- `app/[locale]/(dashboard)/dashboard/page.tsx:247-252` : `StudentTrendCard` (« élèves, 6 derniers
  mois ») affichée aux parents, sans aucun sens pour eux.
- Même page, `:253-264` et `:311-337` : KPI « inscriptions » et DataTable « inscriptions récentes » avec
  ProgressBar de paiement, un vocabulaire de guichet.
- Même page, `:209-213` : héros en dégradé avec un salut générique. Rien sur le prochain cours ou
  l'emploi du temps du jour.
- `src/features/dashboard/sidebar-items.ts:110-128` : la nav parent se limite à Dashboard, Ma famille
  et Planning. Pas d'Événements, pas de Paiements.
- `families/[id]/page.tsx:124-130` : fil d'Ariane « Familles » vers `/dashboard/families` pour un
  parent. `:217-283` : onglets admin (aperçu, enfants, paiements, activité) réutilisés tels quels.
- `families/[id]/_components/hero-banner.tsx:37-45` : `{count} {t('hero.members')}` sans pluriel ICU,
  ce qui donne « 1 Enfants ».
- Aucune vue de présences côté parent (aucune occurrence dans `students/[id]` ni `families/[id]`).
- **Impact** : le parent cherche une réponse simple (« où en est mon enfant, que dois-je payer,
  que se passe-t-il cette semaine ») et reçoit des métriques d'établissement.

### P4 — Le login est un écran 2015 et relègue les méthodes modernes
- `app/[locale]/(auth)/_components/auth-card.tsx:17` : `min-h-[calc(100vh-5rem)]`, résidu d'un header
  disparu. `:19` : `bg-white` codé en dur, `rounded shadow-lg`. `:20-23` : bandeau couleur primaire avec
  texte blanc.
- `login/page.tsx:52-56` : logo dans une pastille blanche posée sur le bandeau coloré.
- `src/features/auth/login-form.tsx:137-172` : Google et passkey sous le formulaire mot de passe.
  L'UI conditionnelle WebAuthn (`autocomplete="username webauthn"`) n'est pas utilisée.
- Même fichier, `:100` : erreur sans `role="alert"` ni `aria-live`. `:115-123` : pas de bouton
  afficher/masquer. `:133,157,170` : l'état de chargement est littéralement `'...'`. `:41,89` :
  `router.push('/dashboard')` ignore toute URL de retour.
- `app/[locale]/layout.tsx:73` : aucune police chargée. Inter est déclarée dans
  `src/styles/globals.css:75-76` mais jamais importée via `next/font`, d'où un repli `system-ui` qui
  varie selon l'OS.
- **Impact** : l'écran vu le plus souvent par les parents est le moins soigné ; la passkey, argument de
  sécurité et de confort, est cachée.

### P5 — Invitation muette : on ne sait ni qui invite, ni pour quoi
- `app/[locale]/invite/[token]/page.tsx:62-76` : pas de logo ni de thème école. `:73` :
  `AcceptInvitationForm` ne reçoit pas `schoolName`.
- Même page, `:17-19` : titre de métadonnées « Créer votre compte » codé en dur en français.
  `:30-50` : états « déjà utilisée » et « expirée » en français codé en dur, boîtes rouge/orange, sans
  CTA « demander un nouveau lien ».
- `accept-invitation-form.tsx:49` : titre générique. `:74-82` : pas de `autoComplete="new-password"`,
  pas de règles affichées, pas de toggle. `:85` : chargement `'...'`.
- `join-school-form.tsx:60` : `router.push('/login')` perd le retour vers l'invitation.
- `app/[locale]/(dashboard)/_lib/invitation-email.ts:29-37` : n'envoie pas `logoUrl`, alors que le
  template le supporte. Copy « invité(e)… sur la plateforme ».
- **Impact** : un parent reçoit un email d'une « plateforme » inconnue puis un formulaire anonyme ; c'est
  exactement le profil d'un hameçonnage. Le taux d'activation en pâtit directement.

### P6 — Paiement : la confiance Stripe est gâchée par le contexte
- `src/use-cases/payments/create-checkout-session.ts:58` : produit « Frais de scolarité » codé en dur,
  sans nom d'école, d'enfant(s) ni de période. Pas de `locale` Stripe ni de `custom_text`.
- Même fichier, `:67-68` : retour vers la page famille avec `?payment=`.
  `families/[id]/page.tsx:206-215` : bandeau de retour sans montant ni reçu.
- `online-payment-button.tsx` : paiement du solde total uniquement (pas d'échéancier) ; état désactivé
  quand Stripe n'est pas configuré, sans explication alternative.
- **Impact** : sur le relevé bancaire et la page Stripe, rien ne relie le paiement à l'école ; un parent
  hésite, et un paiement réussi ne laisse aucune preuve dans l'app.

### P7 — Emails hors charte et partiellement non traduits
- `src/lib/email-template.ts:18` promet « la palette de l'école » mais `:20-31` utilise le teal statique
  de la plateforme. `:32-34` : Fraunces/Karla, une troisième identité. `~:130` : `<html lang="fr">` codé
  en dur. `:106` : CTA en capitales espacées.
- `src/lib/auth.ts:18-29` : email de réinitialisation en français codé en dur.
- **Impact** : l'email, principal point d'entrée des familles, ne ressemble ni à l'école ni à l'app.

### P8 — Pages publiques incomplètes (événements, planning, affiche)
- `ecole/[slug]/evenements/page.tsx:127-163` : les cartes **ne pointent pas** vers la page de détail ;
  passé et futur mélangés en ordre croissant ; annulés en barré + opacité.
- `ecole/[slug]/evenements/[eventSlug]/page.tsx` : pas de retour vers la liste, pas d'« Ajouter au
  calendrier » unitaire, pas de partage, pas de pied de page ; libellé « annulé » rouge en capitales
  (`:145`).
- `ecole/[slug]/planning/page.tsx:12` : réutilise la `ScheduleGrid` admin (`isAdmin={false}`,
  `classes={[]}`), non adaptée au mobile.
- `(print)/dashboard/events/[id]/affiche/page.tsx:86-93` : logo en filigrane à 6 % (bruité selon le
  logo). `:134-139` : pied date/lieu, **sans QR code** vers la page publique.
- **Impact** : l'affiche, le canal le plus « communauté », ne convertit vers rien.

### P9 — Pages d'erreur techniques et ton robotique
- `src/features/error-pages/error-page-shell.tsx:75-81` : dégradé plus grille. `:86-93` : pastille code
  HTTP. `:127-142` : grille décorative 4×4 dessinant les chiffres. `:97` : `text-graphite-500` sur le
  h1.
- La 404 propose seulement « Retour à l'accueil », soit `/`, qui renvoie au login.
- messages : « Non authentifié », « Erreur serveur » ; en anglais « Page Not Found » en Title Case.
- **Impact** : dans un moment d'échec, on montre la machine au lieu de rassurer.

### P10 — Chaînes codées en dur et finitions i18n
- `app/[locale]/(dashboard)/layout.tsx:117` : « Loading... » en anglais.
- `dashboard/page.tsx:106` : repli de nom `'User'`.
- messages/en.json : « Login » comme titre (préférer « Sign in »).
- messages/fr.json : passkey nommée « clé de sécurité » (préférer « clé d'accès », terme Apple/Google
  fr) ; `publicEvent.preview.title` « Aperçu. » avec un point parasite ; clés `auth.register` mortes.
- `app/[locale]/layout.tsx:40` : description de métadonnées générique ; aucun `dark:` dans l'app.

---

## 3. Direction cible par surface

Principe directeur : **l'école est l'hôte, la plateforme est l'infrastructure**. Chaque surface publique
ou parent parle au nom de l'école (logo, couleur, nom, ton), et la plateforme signe discrètement en pied
de page (« Propulsé par … »), comme Uvodo sur ses reçus.

### 3.1 Page d'accueil école `/ecole/[slug]` (nouvelle) et landing `/`

Références :
- Profil organisation plus événements : Sweatpals https://mobbin.com/screens/1ce52a1f-dae0-4e8b-bf1e-d46bb799ff44,
  Posh https://mobbin.com/screens/61188f90-c79a-463a-b0b7-81871a5ba535,
  Luma https://mobbin.com/screens/9a2d1296-164e-4a8b-bbc7-ba0b3ca2ecce
- Couverture, logo et onglets classes/créneaux : Time2book https://mobbin.com/screens/a642cfeb-b202-46dd-9982-5198eea86d7f
- Héros sobre avec 2 CTA : Base https://mobbin.com/sites/sections/3b91d153-519f-40b5-9f42-2bf3ff8d5485,
  Dovetail https://mobbin.com/sites/sections/677fa46b-ca95-428a-a243-0adabff3449d

Direction :
- Un layout public partagé `ecole/[slug]/layout.tsx` : ThemeProvider école, en-tête (logo, nom,
  navigation Accueil · Événements · Planning, bouton « Espace parents ») et pied (adresse, contact,
  « Propulsé par »).
- Contenu de la home :
  - accroche d'une ligne
  - les 3 prochains événements
  - un aperçu de la semaine
  - bloc « Inscriptions / nous contacter »
  - adresse avec lien carte
- Fond neutre et couleur école réservée aux accents (CTA, liens, puces de date). On ne l'utilise jamais
  en aplat derrière du texte.
- `/` : pour un visiteur anonyme, une landing courte : promesse, sélecteur « Trouver mon école » et
  « Se connecter ». Pour un utilisateur connecté : redirection vers le dashboard, comme aujourd'hui.

```
+----------------------------------------------------------------+
| [logo] École Al-Nour          Accueil  Événements  Planning    |
|                                            [ Espace parents -> ]|
+----------------------------------------------------------------+
|  (bandeau couverture optionnel, 240px, fondu vers le fond)     |
|                                                                 |
|  École Al-Nour                                                  |
|  Cours du samedi et du dimanche, de 6 à 16 ans.                 |
|  12 rue X, 69000 Lyon · contact@…                               |
|  [ Espace parents ]   ( S'abonner au calendrier )               |
+----------------------------------------------------------------+
|  Prochains événements                        Tout voir ->       |
|  +-----------+ +-----------+ +-----------+                      |
|  | 12        | | 19        | | 03        |                      |
|  | OCT       | | OCT       | | NOV       |                      |
|  | Fête de   | | Réunion   | | Sortie    |                      |
|  | fin d'an. | | parents   | | musée     |                      |
|  +-----------+ +-----------+ +-----------+                      |
+----------------------------------------------------------------+
|  Cette semaine          Sam 9h-12h  Niveau 1 · Salle A          |
|                         Dim 9h-12h  Niveau 2 · Salle B          |
|                                        Planning complet ->      |
+----------------------------------------------------------------+
|  Adresse · Contact · Mentions         Propulsé par <plateforme> |
+----------------------------------------------------------------+
```

### 3.2 Événements publics (liste, détail, affiche)

Références :
- Luma https://mobbin.com/screens/a02338c1-09a9-400f-a4a3-d9f52ea37820 : bloc date/lieu,
  « Add to Calendar », hôte présenté.
- Partiful https://mobbin.com/screens/ea80ec45-c112-44fe-812d-4e253153cbc1 : menu Google, Outlook et
  Apple Calendar.
- Sweatpals https://mobbin.com/screens/814908d1-e703-4ffc-ab7e-e1e1a7017cf4 : icônes date et lieu,
  « View map ».

Direction :
- Liste :
  - sections « À venir » puis « Passés » (repliée), en ordre chronologique
  - carte entière cliquable vers le détail
  - pastille date (jour/mois) en couleur école
  - annulé = badge sobre « Annulé » ; le titre reste lisible, sans barré
- Détail :
  - fil « ← Tous les événements »
  - actions « Ajouter à mon agenda » (ICS unitaire, Google) et « Partager » (Web Share API, repli copie
    du lien)
  - lien carte sur le lieu
  - statut annulé en bandeau neutre avec icône, pas en capitales rouges
- Affiche :
  - QR code vers `/ecole/[slug]/evenements/[eventSlug]` (avec « Scannez pour les détails »)
  - logo en en-tête net, pas en filigrane à 6 %

### 3.3 Login et récupération de compte

Références :
- Split-screen marque et formulaire : Ferndesk https://mobbin.com/screens/b6867b5e-0fc3-4fa6-8eec-f39b1c1af322,
  Fabric https://mobbin.com/screens/e5a30e9f-9ba7-4b4a-b480-ae07cf8d3cbf
- Email d'abord et fournisseur en tête, badge « Last used » : Base44
  https://mobbin.com/screens/ad04bddc-cdf4-474d-bb54-a1bd74193a95
- Erreur inline et toggle mot de passe : Fabric (même écran), Klaviyo
  https://mobbin.com/screens/609920e7-3191-4ed1-8e5c-090cf98d338b

Direction :
- Shell `(auth)/layout.tsx` en deux colonnes, le panneau école à gauche :
  - logo, nom, accroche
  - photo de couverture, sinon un aplat très léger `primary-light`
  - le panneau disparaît sous 768px
- Formulaire sur fond neutre, sans bandeau coloré, dans cet ordre :
  1. email (autocomplete `username webauthn`, qui déclenche la passkey conditionnelle)
  2. bouton principal « Continuer »
  3. séparateur, puis « Continuer avec Google » et « Utiliser une clé d'accès »
  4. mot de passe révélé sous l'email
- Badge « Dernière méthode utilisée » (localStorage).
- États :
  - spinner et libellé explicite (« Connexion… »)
  - erreur en `role="alert"`
  - toggle afficher/masquer
  - `redirectTo` conservé jusqu'au dashboard
- Si l'école est inconnue (1re visite), afficher la marque plateforme neutre et un lien « Trouver mon
  école ». Ne jamais afficher un carton vide.
- Mot de passe oublié :
  - succès en écran dédié qui rappelle l'email saisi et donne un lien « Renvoyer »
  - lien invalide : proposer « Recevoir un nouveau lien »
  - réinitialisation réussie : connexion automatique ou redirection pré-remplie

```
+-------------------------------+--------------------------------+
|                               |                                |
|  [logo] École Al-Nour         |   Bon retour                   |
|                               |   Connectez-vous à l'espace    |
|  « Apprendre ensemble,        |   parents d'École Al-Nour.     |
|    chaque week-end. »         |                                |
|                               |   Email                        |
|  (photo couverture ou aplat   |   [ parent@exemple.fr       ]  |
|   primary-light très doux)    |   [      Continuer          ]  |
|                               |   ---------- ou ----------     |
|                               |   [ G  Continuer avec Google ] |
|                               |   [ @  Utiliser une clé d'accès]|
|                               |          (dernière utilisée)   |
|                               |                                |
|  12 rue X, Lyon               |   Pas encore de compte ?       |
|  contact@al-nour.fr           |   L'école vous envoie une      |
|                               |   invitation par email.        |
+-------------------------------+--------------------------------+
|              FR | EN                  Propulsé par <plateforme> |
+----------------------------------------------------------------+
```

### 3.4 Invitation et onboarding

Références :
- Clay https://mobbin.com/flows/c633c6c4-340d-4ba9-84ca-161c0d546a21 : « X vous invite à rejoindre Y »,
  expiration affichée.
- Asana https://mobbin.com/flows/5fa91fa3-560c-4886-9ec5-a08902ef21db : « Vous rejoignez en tant que
  … Pas le bon compte ? ».
- Amplitude https://mobbin.com/flows/ac66fd3b-f720-4d69-8fd4-a288071b301e : email verrouillé, jauge
  de force et règles cochées en direct.
- Fibery https://mobbin.com/flows/49bf3863-b754-4a82-be03-bb19182051cb : « Bienvenue à <équipe> » en
  titre.

Direction :
- En-tête école (logo, thème). Titre « Rejoignez École Al-Nour » et sous-titre « <Nom> vous invite en
  tant que parent de la famille Diallo ».
- Email en lecture seule, présenté comme du texte avec « Pas vous ? », non comme un champ grisé.
- Google et passkey proposés en premier, le mot de passe en alternative. Pour le mot de passe :
  - `autoComplete="new-password"`
  - règles cochées en direct
  - toggle afficher/masquer
- Invitation expirée ou utilisée : ton calme, puis action « Demander un nouveau lien » (notifie l'admin)
  ou « Se connecter » si le compte existe.
- Après création : connexion automatique et arrivée sur un dashboard d'accueil (« Bienvenue, voici vos
  enfants »), pas sur `/login`.

### 3.5 Dashboard parent

Références :
- Carte par enfant avec solde et prochaine échéance : Kit https://mobbin.com/screens/ea5d92c2-73fc-4fc7-9fb6-a6d32d332097,
  Greenlight https://mobbin.com/screens/7ea82a02-193c-4a6f-ae55-3cca33efc600
- Salut daté et liste « à faire » : Asana (écran final du flow ci-dessus).

Direction : un dashboard parent dédié, sans réutiliser l'admin.
- En-tête : « Bonjour Aminata » avec la date du jour, puis une ligne d'état (« Tout est en ordre » ou
  « 1 paiement en attente »).
- Une carte par enfant, avec :
  - photo ou initiale
  - classe et niveau
  - prochain cours (jour, heure, salle)
  - présence sur les 4 dernières séances (pastilles)
- Carte « Solde » : montant restant, échéance, puis « Payer » (total ou échéance) et « Voir les reçus ».
- Carte « Prochains événements de l'école » (3 max).
- Nav parent :
  - Accueil
  - Mes enfants
  - Planning
  - Événements
  - Paiements
  - Mon compte
- Sur la page famille vue par un parent : pas de fil « Familles », pas d'onglet « activité » d'audit, et
  des libellés au pluriel ICU (« 1 enfant », « 2 enfants »).
- Supprimer pour le rôle parent : `StudentTrendCard`, le KPI d'inscriptions et la DataTable admin.

### 3.6 Paiement Stripe et après-paiement

Références :
- Stripe https://mobbin.com/screens/8379a44e-9b7e-4341-8913-9cd1a4be3fa8 : « Paiement réussi », montant
  cité, email du reçu, puis « Voir le reçu ».
- Uvodo https://mobbin.com/screens/f47a3603-030c-4052-aba1-613439cf0bcb : marchand en tête, numéro et
  date, « Powered by » discret.
- Deel https://mobbin.com/screens/eb392439-083f-4863-b60b-baa13493780b : détail et téléchargement PDF.

Direction :
- Dans Checkout :
  - produit « École Al-Nour — Scolarité 2026-2027 », avec les prénoms des enfants en description
  - `locale` alignée sur la langue de l'utilisateur
  - `custom_text` rassurant (« Paiement sécurisé, un reçu vous est envoyé »)
  - `payment_intent_data.description` et `statement_descriptor_suffix` au nom de l'école
- Retour : page ou panneau de confirmation dédié avec montant, date, référence, « Télécharger le reçu »
  et « Retour à l'accueil ». Plus de simple bandeau.
- Plus tard : paiement d'une échéance ou d'un montant libre, et historique des reçus.

### 3.7 Pages d'erreur

Références :
- Vimeo https://mobbin.com/screens/0cf4923d-f5dd-42dc-9ddc-250fb8b91202 : titre humain et une action.
- Squarespace https://mobbin.com/screens/6276198a-1c16-40bb-878c-256fa6d3e36d : 404 dans le shell du
  site, avec la navigation conservée.

Direction :
- Retirer la grille 4×4, le dégradé et la pastille code. Garder un titre humain, une phrase et deux
  actions contextuelles (« Aller à mon espace » si connecté, sinon « Page de l'école » et « Se
  connecter »).
- Afficher la 404 dans le shell école quand l'URL est sous `/ecole/[slug]`.
- Afficher le code HTTP en petit, en `text-muted`, pour le support.
- Copy :
  - « Cette page n'existe pas (ou plus). »
  - « Vous devez être connecté pour voir cette page. »
  - « Quelque chose s'est mal passé de notre côté. Réessayez dans un instant. »

### 3.8 Emails

- Utiliser la couleur primaire de l'école (avec contrôle de contraste, repli sur teal) et le logo
  (`logoUrl` enfin transmis).
- Utiliser la même famille typographique que l'app (pile système plus Inter), sans Fraunces/Karla.
- Attribut `lang` dynamique.
- CTA en casse normale, 44px de haut.
- Expéditeur « École Al-Nour via <plateforme> ».
- Sujet et corps nomment l'école et le rôle (« Aminata, l'École Al-Nour vous invite à suivre la
  scolarité de Yacine »).
- L'email de réinitialisation passe par next-intl comme les autres.

### 3.9 Système visuel et ton

- Charger Inter (ou Geist) via `next/font` dans `app/[locale]/layout.tsx`. Échelle typographique
  resserrée :
  - 14/16 pour le corps
  - 20/24/32 pour les titres
  - `tracking-tight` sur les titres
- Dériver les tokens école d'**une seule** couleur primaire en OKLCH (hover, light et foreground calculés),
  avec un foreground noir ou blanc choisi par contraste au runtime, pour les couleurs libres comme pour
  les presets.
- Renommer les échelles inversées (`graphite-100` = le plus sombre) en tokens sémantiques
  (`--fg`, `--fg-muted`, `--bg`, `--bg-subtle`, `--border`) avant d'envisager le mode sombre.
- Ton : vouvoiement chaleureux, phrases courtes, l'école comme sujet (« L'école vous a invité »), jamais
  « la plateforme ».
  - EN : « Sign in », sentence case partout.
  - FR : « clé d'accès » plutôt que « clé de sécurité ».

---

## 4. Plan en trois niveaux

### Niveau 1 — Gains rapides (≤ 1 jour chacun)

| # | Action | Fichiers |
|---|---|---|
| Q1 | Charger la police via `next/font` et l'exposer en variable CSS | `app/[locale]/layout.tsx`, `src/styles/globals.css` |
| Q2 | États de chargement : spinner et libellé à la place de `'...'`, erreurs en `role="alert"` | `src/features/auth/login-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `accept-invitation-form.tsx`, `join-school-form.tsx` |
| Q3 | Toggle afficher/masquer et `autoComplete` corrects (`current-password`, `new-password`, `username webauthn`) | mêmes formulaires auth et invitation |
| Q4 | Pluriels ICU et casse (« 1 enfant ») | `families/[id]/_components/hero-banner.tsx`, `messages/fr.json`, `messages/en.json` |
| Q5 | Chaînes codées en dur vers next-intl : metadata, états expiré/utilisé, « Loading... », `'User'`, email reset, `lang` email | `app/[locale]/invite/[token]/page.tsx`, `app/[locale]/(dashboard)/layout.tsx`, `dashboard/page.tsx`, `src/lib/auth.ts`, `src/lib/email-template.ts` |
| Q6 | Cartes événement cliquables vers le détail ; « À venir » séparé de « Passés » | `app/[locale]/ecole/[slug]/evenements/page.tsx` |
| Q7 | ThemeProvider et en-tête logo sur la liste événements et le planning publics | `ecole/[slug]/evenements/page.tsx`, `ecole/[slug]/planning/page.tsx` |
| Q8 | Transmettre `logoUrl` et le nom de l'école à l'email d'invitation ; réécrire la copy | `app/[locale]/(dashboard)/_lib/invitation-email.ts`, `messages/*.json` |
| Q9 | Masquer `StudentTrendCard`, le KPI inscriptions et la DataTable pour le rôle parent | `app/[locale]/(dashboard)/dashboard/page.tsx` |
| Q10 | Ajouter Événements à la nav parent | `src/features/dashboard/sidebar-items.ts` |
| Q11 | Conserver `redirectTo` du login et de l'invitation jusqu'à la destination | `login-form.tsx`, `join-school-form.tsx`, `app/[locale]/(auth)/login/page.tsx` |
| Q12 | Stripe : `locale`, nom produit « École — Scolarité période », prénoms, `custom_text` | `src/use-cases/payments/create-checkout-session.ts`, `messages/*.json` |
| Q13 | Sitemap : pages publiques école, événements et planning par slug | `app/sitemap.ts` |
| Q14 | Copy : « Sign in », « clé d'accès », erreurs humaines, suppression de `auth.register` et du point de « Aperçu. » | `messages/fr.json`, `messages/en.json` |
| Q15 | Fil d'Ariane famille adapté au rôle parent | `app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx` |
| Q16 | Passer `schoolName` et le rôle à l'invitation, avec en-tête logo | `app/[locale]/invite/[token]/page.tsx`, `accept-invitation-form.tsx` |

### Niveau 2 — Structurant (1 à 5 jours chacun)

| # | Action | Fichiers |
|---|---|---|
| S1 | Layout public école partagé (en-tête, pied, thème) et **page d'accueil école** | nouveaux `app/[locale]/ecole/[slug]/layout.tsx`, `app/[locale]/ecole/[slug]/page.tsx` ; retrait des en-têtes dupliqués dans `evenements/[eventSlug]/page.tsx` |
| S2 | Refonte du shell auth en split-screen école, formulaire email d'abord, passkey conditionnelle, badge dernière méthode | `app/[locale]/(auth)/layout.tsx`, `_components/auth-card.tsx`, `login/page.tsx`, `src/features/auth/login-form.tsx` |
| S3 | Parcours mot de passe oublié complet : écran de succès avec email, lien invalide menant à une nouvelle demande, auto-connexion | `forgot-password-form.tsx`, `reset-password-form.tsx`, pages `(auth)/forgot-password`, `(auth)/reset-password` |
| S4 | Invitation brandée : titre « Rejoignez X », rôle, Google/passkey d'abord, états expirés actionnables, auto-connexion | `app/[locale]/invite/[token]/page.tsx`, `accept-invitation-form.tsx`, `join-school-form.tsx`, action de demande de nouveau lien dans `app/[locale]/(dashboard)/_lib/` |
| S5 | **Dashboard parent dédié** : cartes enfant (prochain cours, présences), solde, événements | nouveau `app/[locale]/(dashboard)/dashboard/_components/parent-home.tsx`, `dashboard/page.tsx` (bascule par rôle), use-cases lecture famille |
| S6 | **Vue présences parent** par enfant, avec scope famille strict | nouveau `app/[locale]/(dashboard)/dashboard/children/[id]/page.tsx` (ou onglet dans `families/[id]`), use-case lecture présences |
| S7 | Confirmation de paiement dédiée avec montant, référence et reçu | `create-checkout-session.ts` (success_url avec `session_id`), nouvelle page `dashboard/payments/success/page.tsx`, `families/[id]/page.tsx` |
| S8 | Tokens dérivés d'une couleur en OKLCH et foreground par contraste au runtime | `src/components/theme-provider.tsx`, `src/lib/theme-palettes.ts`, `src/styles/globals.css` |
| S9 | Email aux couleurs de l'école, typo de l'app, CTA en casse normale, `lang` dynamique | `src/lib/email-template.ts`, `src/lib/auth.ts`, `_lib/invitation-email.ts` |
| S10 | Pages d'erreur calmes et contextuelles (shell école sous `/ecole`) | `src/features/error-pages/error-page-shell.tsx`, `app/[locale]/not-found.tsx`, `app/[locale]/error.tsx`, `messages/*.json` |
| S11 | Détail événement : retour, ICS unitaire, Google Calendar, partage, lien carte | `ecole/[slug]/evenements/[eventSlug]/page.tsx`, route ICS unitaire à côté de la route ICS existante |
| S12 | Planning public mobile en vue liste par jour | `ecole/[slug]/planning/page.tsx`, nouveau composant liste (ne plus réutiliser `ScheduleGrid` admin) |

### Niveau 3 — Ambitieux

| # | Action | Fichiers |
|---|---|---|
| A1 | Landing plateforme à `/` pour les anonymes, avec annuaire « Trouver mon école » | `app/[locale]/page.tsx`, nouveau `app/[locale]/(public)/…`, `app/[locale]/evenements/page.tsx` (sélecteur au lieu de `notFound()`) |
| A2 | Kit de marque école : accroche, couverture, contact, réseaux | `src/lib/branding-config.ts`, `src/lib/branding.ts`, écran réglages branding, `prisma/schema.prisma` si besoin de champs dédiés (migration relue) |
| A3 | QR code sur l'affiche et logo net en en-tête | `app/[locale]/(print)/dashboard/events/[id]/affiche/page.tsx` (dépendance QR à justifier pour knip) |
| A4 | Échéancier et paiement partiel, historique des reçus | `src/use-cases/payments/create-checkout-session.ts`, `online-payment-button.tsx`, nouvelle page `dashboard/payments/page.tsx`, `docs/business-rules.md` |
| A5 | PWA et notifications (rappel d'événement, paiement reçu, absence) | `app/manifest.ts`, service worker, préférences dans `src/actions/` |
| A6 | Mode sombre, après migration vers les tokens sémantiques (S8) | `src/styles/globals.css`, `app/[locale]/layout.tsx`, composants `src/components/ui` |
| A7 | Abonnement calendrier par école (webcal) mis en avant sur la home école | route ICS école existante, `ecole/[slug]/page.tsx` |

Ordre recommandé : Q1 à Q16, puis S1 et S2 (vitrine et porte d'entrée), puis S4 et S5 (activation et
valeur parent), puis S7 à S9 (confiance paiement et email). Les items A viennent ensuite, selon
l'adoption.
