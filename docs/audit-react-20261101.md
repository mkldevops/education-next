# Audit de l’intégration et de l’expérience de la web app

Date : 1 novembre 2026. Périmètre : expérience globale, parents, enseignants et administration.

## Verdict

La base est déjà riche : navigation selon les rôles, accueil parent, recherche de personnes et
d’actions, paiement en ligne, appel sauvegardé, événements et installation PWA. Le meilleur levier
est de relier ces capacités : conserver le contexte, ouvrir directement le bon dossier et rendre
chaque résultat d’action explicite. Ajouter des écrans avant de terminer ces liens augmenterait la
complexité des parcours.

Priorités : continuité des listes et des tâches, protection des saisies, accessibilité mobile,
cohérence des surfaces, puis enrichissement des vues parent et enseignant.

## Méthode et limites

- Analyse du code actuel, en utilisant les audits de septembre comme historique uniquement.
- Inventaire automatique de `app/` et `src/` : 48 pages, 22 fichiers `loading.tsx`, 311 fichiers TSX
  de production, 380 fichiers de tests. Ce sont des comptes de fichiers, pas une couverture de tests.
- Lecture ciblée du shell, de l’accueil, des listes, du dossier famille, du paiement en ligne,
  du formulaire famille, du planning, de l’appel, des primitives et de la PWA. Les 311 fichiers TSX
  n’ont pas été tous examinés en profondeur. Les parcours caisse, repas, configuration et IA ne
  constituent pas ici des audits métier exhaustifs.
- Stack résolue : Next.js 16.3.8, React 19.3.1, Tailwind 4.3.3, TypeScript strict, Zustand,
  primitives UI locales, Vitest et Testing Library. Références : `pnpm-lock.yaml:64`,
  `tsconfig.json:9`, `src/components/ui/AGENTS.md:1`.
- Aucun serveur applicatif local détecté et aucun onglet applicatif disponible dans le navigateur.
  Pas de validation visuelle, de parcours authentifié, de mesure LCP/INP/CLS ou de contraste calculé.
  Les risques qui nécessitent une reproduction navigateur sont identifiés comme tels.
- Aucune modification applicative. L’installation des dépendances manquantes a été déclenchée par
  pnpm pour exécuter les tests ; elle a généré le client Prisma, sans migration ni seed.

## Éléments déjà solides

| Élément | Preuve actuelle | Conséquence |
| --- | --- | --- |
| Accueil parent dédié et paiement | `app/[locale]/(dashboard)/dashboard/page.tsx:156`, `:264` | Il faut enrichir le parcours existant, pas recréer un portail parent. |
| Recherche de navigation, actions et personnes | `src/features/dashboard/search-modal.tsx:137` | Bon point d’entrée pour raccourcir les tâches. |
| Chargement différé de la recherche | `src/features/dashboard/header-client.tsx:12` | Évite de charger systématiquement cette interaction. |
| Sauvegarde et gestion des erreurs de l’appel | `app/[locale]/(dashboard)/dashboard/my-classes/[id]/attendance/_components/attendance-panel.tsx:173`, `:241` | Les améliorations doivent préserver la sérialisation et les erreurs par élève. |
| Marquage des élèves restants présents | Même fichier, `:473` | L’action groupée existe déjà ; la recommandation concerne la consultation et les exceptions. |
| Focus des dialogues et clavier des onglets | `src/components/ui/dialog/dialog.tsx:126`, `src/components/ui/tabs/tabs.tsx:28` | Des fondations réutilisables existent. |
| Tokens, polices et réduction des animations | `src/styles/globals.css:74`, `:232`, `app/[locale]/layout.tsx:2` | Les anciens constats « aucune police/tokens » sont dépassés. |
| Pages privées exclues du cache PWA | `public/sw.js:36` | Conserver cette séparation lors de tout travail hors connexion. |

## Constats priorisés

### 1. Le contexte des listes et des onglets n’est pas durable — P1

**Confirmé dans le code.** Recherche, tri, colonnes et pagination de `RichDataTable` vivent dans le
state du composant. Seule la taille de page est conservée dans `localStorage`.
Les inscriptions ont aussi un filtre de statut local. Les onglets acceptent une sélection initiale
mais ne publient pas leur sélection dans l’URL.

Preuves : `src/components/ui/rich-data-table/rich-data-table.tsx:100`,
`app/[locale]/(dashboard)/dashboard/enrollments/_components/enrollments-table.tsx:55`,
`src/components/ui/tabs/tabs.tsx:18`,
`app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx:257`.

Impact : une vue filtrée ne peut pas être partagée et son rétablissement après remontage n’est pas
garanti. Proposition : paramètres d’URL validés pour recherche, filtre, tri, page et onglet ;
préférences de présentation stockées séparément. Préserver école et période.
Effort indicatif : 2–4 jours sur les listes principales, risque moyen.

### 2. Les tâches de l’accueil ouvrent des pages génériques — P1

**Confirmé.** « Inscriptions en attente » pointe vers `/dashboard/enrollments`, dont le filtre
initial vaut `ALL`. Chèques non encaissés et soldes restants pointent tous deux vers
`/dashboard/payments`, sans intention distincte dans le lien.

Preuves : `app/[locale]/(dashboard)/dashboard/page.tsx:313`, `:323`, `:335`,
`app/[locale]/(dashboard)/dashboard/enrollments/_components/enrollments-table.tsx:55`.

Impact : l’utilisateur doit retrouver les éléments que l’accueil vient de lui signaler.
Proposition : liens vers une vue préfiltrée, titre rappelant le motif et bouton de remise à zéro.
Effort : 1–2 jours après la définition de l’état URL, risque faible à moyen.

### 3. Fermer le formulaire famille peut supprimer la saisie — P1

**Confirmé par la composition des composants.** Le responsable et les enfants sont en state local
dans le contenu du dialogue ; le contenu est démonté à la fermeture. Échap ou un clic sur le fond
ferment sans garde de saisie modifiée. Le formulaire ne fournit pas de brouillon persistant.

Preuves : `app/[locale]/(dashboard)/dashboard/families/_components/create-family-dialog.tsx:118`,
`src/components/ui/dialog/dialog.tsx:145`, `:186`, `:195`.

Impact : perte possible d’un dossier familial saisi en plusieurs étapes.
Proposition : confirmation uniquement si le contenu a changé, conservation du brouillon pendant
la session et indication claire de la réussite. Toute persistance durable de données personnelles
nécessite une politique d’expiration et de séparation des comptes et écoles.
Effort : 1–2 jours pour la protection initiale, risque moyen.

### 4. Les erreurs du formulaire famille restent trop globales — P1

**Confirmé.** La validation de l’étape responsable remonte une catégorie via un toast, en exploitant
seulement le premier chemin d’erreur. Le champ concerné n’est pas ciblé par ce traitement.

Preuve : `app/[locale]/(dashboard)/dashboard/families/_components/create-family-dialog.tsx:196`.

Impact : correction plus lente, particulièrement sur mobile et avec plusieurs enfants.
Proposition : erreurs près des champs, `aria-invalid`/`aria-describedby`, résumé navigable et focus
sur le premier champ invalide. Garder les toasts pour les retours globaux.
Effort : 1–2 jours, risque faible à moyen.

### 5. Le tiroir mobile mérite une correction de gestion du focus — P1

**Risque identifié dans le code, à reproduire au navigateur.** La fermeture translate l’aside hors
écran ; ses liens restent montés, sans `inert` ou mécanisme équivalent dans ce composant. À
l’ouverture, seul Échap est géré : pas de placement ni de confinement du focus dans le tiroir.

Preuves : `src/features/dashboard/sidebar.tsx:89`, `:141`, `:147`, `:174`.

Impact : risque de tabulation vers la navigation masquée ou derrière le panneau ouvert.
Proposition : comportement de tiroir modal sur mobile, avec focus initial, confinement, restauration,
fond inerte et blocage du défilement ; conserver le comportement non modal du bureau.
Effort : 0,5–1,5 jour, risque moyen à cause des changements de breakpoint.

### 6. La navigation interne peut contourner la protection de l’appel — P1

**Risque identifié, non reproduit dans un navigateur.** L’appel protège la fermeture/recharge par
`beforeunload`, mais les changements restent d’abord dans des brouillons locaux et les timers sont
annulés au démontage. Cette protection seule ne couvre pas une navigation interne App Router.

Preuves : `app/[locale]/(dashboard)/dashboard/my-classes/[id]/attendance/_components/attendance-panel.tsx:99`,
`:145`, `:154`, `:241`. La recherche globale utilise `router.push` :
`src/features/dashboard/search-modal.tsx:130`.

Impact : risque de perdre une modification non encore enregistrée en quittant l’appel.
Proposition : tester une sortie immédiate sous réseau ralenti, puis garantir l’enregistrement ou
interposer un choix explicite. Évaluer les liens, la recherche globale et les boutons retour.
Effort : 1–3 jours selon le mécanisme retenu, risque moyen.

### 7. Le clic de notification perd sa destination — P2

**Défaut reproduit par exécution du service worker dans un contexte Node isolé.** Une charge push
avec `url: '/fr/dashboard/events/123'` produit des données de notification contenant seulement
`dateOfArrival`. Le clic ouvre `/dashboard`.

Preuves : `public/sw.js:65`, `:70`, `:80`.

Impact : rupture du parcours contextuel, si des notifications push sont émises. Aucun parcours
complet d’abonnement/émission push n’a été trouvé dans `app/` et `src/` ; cela ne prouve donc pas
un incident actuellement vécu par les utilisateurs.
Proposition : conserver une destination interne validée, la normaliser en URL absolue pour retrouver
un onglet existant, préserver la locale et vérifier les autorisations à l’arrivée.
Effort : 0,5–1 jour pour ce gestionnaire ; une offre de notifications complète est un autre chantier.

### 8. Les cartes enfants ne permettent pas d’aller au dossier — P2

**Confirmé.** L’accueil parent affiche une carte avec identité, classe et prochain cours ; la carte
ne contient pas de lien vers le détail de l’enfant.

Preuve : `app/[locale]/(dashboard)/dashboard/page.tsx:194`.

Impact : la synthèse informe sans prolonger naturellement le parcours.
Proposition : lien explicite « Voir le dossier », puis raccourcis vers planning, présences et repas
selon les modules et droits réellement disponibles. Éviter de transformer tout le bloc en zone
cliquable ambiguë si plusieurs actions y sont proposées.
Effort : 0,5–1 jour pour le lien ; 2–4 jours pour une carte enrichie, risque faible à moyen.

### 9. Deux générations de styles coexistent — P2

**Confirmé.** 67 lignes TS/TSX de production contiennent `bg-white` (compte textuel, pas 67 défauts).
Le tableau, son menu de colonnes, les champs et le planning utilisent encore des surfaces
historiques alors que le shell possède des tokens sémantiques. Le tableau de paiements n’applique
pas non plus systématiquement alignement numérique et chiffres tabulaires aux montants.

Preuves : `src/components/ui/rich-data-table/rich-data-table.tsx:161`, `:182`,
`src/components/ui/input/input.tsx:43`,
`app/[locale]/(dashboard)/dashboard/planning/_components/schedule-grid.tsx:55`,
`app/[locale]/(dashboard)/dashboard/payments/_components/payments-table.tsx:69`,
`src/styles/globals.css:74`.

Impact : impression d’assemblage et coût accru pour ajouter un mode sombre cohérent.
Proposition : harmoniser surfaces, bordures, statuts et montants ; ajouter ensuite un mode sombre
complet si souhaité. Ne pas traiter chaque occurrence de blanc comme automatiquement fautive.
Effort : 2–4 jours pour les composants partagés et les parcours principaux, risque visuel moyen.

### 10. Le tableau partagé peut mieux annoncer ses interactions — P2

**Confirmé dans le markup.** Le champ de recherche reçoit un placeholder sans label explicite dans
ce composant. Les en-têtes triables affichent une icône sans `aria-sort` sur l’en-tête ; le menu de
colonnes est un panneau personnalisé sans état `aria-expanded` sur son déclencheur.

Preuves : `src/components/ui/rich-data-table/rich-data-table.tsx:142`, `:152`, `:188`.

Impact : état des contrôles moins compréhensible avec les technologies d’assistance.
Proposition : nommer la recherche, annoncer le tri et utiliser un panneau dont le clavier, la
fermeture et le retour du focus sont définis. Vérifier aussi les lignes avec `role="button"`
et les actions qu’elles contiennent (`:240`) avec un lecteur d’écran.
Effort : 0,5–1,5 jour, risque faible à moyen.

### 11. La pagination visuelle ne borne pas la requête familles — P2

**Confirmé.** La page lit toutes les familles actives avec leurs relations ; la pagination du tableau
est appliquée ensuite côté client. Le `take: 5` observé borne les paiements par inscription, pas le
nombre de familles.

Preuves : `app/[locale]/(dashboard)/dashboard/families/page.tsx:63`, `:97`, `:109`,
`src/components/ui/rich-data-table/rich-data-table.tsx:56`.

Impact : volume serveur et données transmises croissent avec l’école. Aucune latence chiffrée
n’a été mesurée ; ce n’est pas la preuve d’une lenteur actuelle.
Proposition : recherche, tri et pagination serveur avec compteurs cohérents et projections adaptées.
Effort : 2–4 jours sur ce parcours, risque moyen ; commencer par un jeu de données réaliste.

### 12. Le retour de paiement manque d’un suivi explicite de confirmation — P2

**Confirmé sur la page examinée.** Le paramètre `payment=success` affiche un message statique ;
ce bloc ne suit pas la confirmation du paiement côté serveur. Le retour navigateur peut précéder
le traitement du webhook.

Preuve : `app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx:246`.

Impact : l’utilisateur peut voir un retour Stripe et un solde encore inchangé sans comprendre la
situation. Ce constat ne remet pas en cause l’encaissement ni la fiabilité du webhook.
Proposition : afficher « confirmation en cours », puis un paiement confirmé par le serveur, le
montant et une référence. Rafraîchissement borné et possibilité de réessayer ; ne jamais considérer
le paramètre d’URL comme une preuve de règlement.
Effort : 1–3 jours, risque moyen.

## Enrichissements à forte valeur après ces corrections

Ces propositions sont des évolutions produit, pas des bugs établis.

| Public | Évolution | Base observée | Bénéfice et ordre de grandeur |
| --- | --- | --- | --- |
| Parents | Une vue « cette semaine » par enfant : cours, événements, présences et échéances selon modules | `dashboard/page.tsx:215` et `:246` | Répondre à « que dois-je savoir et faire ? » en une visite ; 3–6 jours après validation des données disponibles. |
| Enseignants | Basculer entre cartes individuelles et liste compacte pour corriger les exceptions | `attendance-panel.tsx:506` et `:473` | Voir la classe entière et retrouver un élève sans parcourir chaque carte ; 2–4 jours, conserver le récapitulatif et la validation. |
| Administration | Planning hebdomadaire sur un axe horaire, avec navigation vers les créneaux | `planning/_components/schedule-grid.tsx:49` | Repérer les journées chargées et les chevauchements visuellement ; 4–7 jours, règles de conflit à cadrer séparément. |
| Tous | Historique familial consultable et filtrable, avec « Voir plus » | `families/[id]/_components/activity-feed.tsx:81` | Le fil s’arrête aujourd’hui à 8 éléments ; rendre les événements existants explorables, puis étudier les autres types d’activité ; 2–4 jours. |
| Parents | Notifications choisies par catégorie et destinataire, ouvrant le bon écran | `public/sw.js:49` | Une information utile au bon moment ; nécessite cadrage des abonnements, de l’émission et des préférences avant chiffrage fiable. |
| Tous | États réseau explicites et reprise de saisie ciblée | `public/sw.js:36`, `attendance-panel.tsx:99` | La PWA actuelle fournit un écran hors connexion, pas une application métier hors ligne ; commencer par le statut de connexion et la reprise maîtrisée de l’appel. |
| Visiteurs | Une entrée publique propre à l’école si l’acquisition et l’information des familles sont un objectif | `app/[locale]/page.tsx:15` | La racine redirige actuellement vers connexion/dashboard ; arbitrage produit nécessaire avant d’ajouter une page publique. |

## Santé frontend : appréciation qualitative du périmètre lu

Les notes évaluent la structure observée, pas une campagne de mesure ni toutes les pages.

| Axe | Note /10 | Motif |
| --- | --- | --- |
| Architecture | 7 | Frontières serveur/client et primitives partagées ; 18 TSX de plus de 300 lignes à examiner selon leur responsabilité. La longueur seule n’est pas un défaut. |
| Patterns React | 8 | Nettoyages et sauvegardes explicites sur les composants lus ; protection de navigation et de fermeture à compléter. |
| Performance structurelle | 6 | Chargement différé de la palette ; listes non bornées côté serveur. Performance ressentie non mesurée. |
| Cohérence UI et accessibilité du code | 6 | Fondations sémantiques et clavier présents ; anciennes surfaces et comportement du tiroir à terminer. |
| TypeScript | 9 | Mode strict, aucune occurrence de `: any`, `<any>` ou `as any` dans le code de production selon la recherche ; 6 doubles casts, dont plusieurs adaptateurs globaux légitimes. Pas de `@ts-ignore` ou `@ts-expect-error` détecté en production. |
| Tests | 7 | Tests de comportement et d’intégration présents ; aucun outillage E2E navigateur repéré dans les scripts/dépendances/configurations examinés. |

Moyenne indicative : **7,2/10**. La qualité perçue en situation réelle reste à mesurer.
React Compiler est activé (`next.config.ts:17`) : l’absence de `useMemo` ou `memo` n’est pas ici
considérée comme un défaut. Aucun gain de bundle, de latence ou de conversion n’est inventé.

## Vérifications effectuées

59 tests réussis dans 5 fichiers : tableau partagé, sidebar, service worker, création de famille,
appel enseignant. Commande :

```sh
pnpm test src/components/ui/rich-data-table/__tests__/rich-data-table.test.tsx \
  src/features/dashboard/__tests__/sidebar.test.tsx \
  src/features/pwa/__tests__/service-worker.test.ts \
  'app/[locale]/(dashboard)/dashboard/families/_components/create-family-dialog.test.tsx' \
  'app/[locale]/(dashboard)/dashboard/my-classes/[id]/attendance/_components/attendance-panel.test.tsx'
```

Le scénario isolé push/clic a reproduit la perte de destination : attendu
`/fr/dashboard/events/123`, obtenu `/dashboard`.
Les tests existants ne constituent pas une validation des douze constats.
Runtime local : Node 24.22.1, différent du Node 26 de CI. Pas de build ou de séquence CI complète :
aucune PR ni modification applicative dans cet audit.

## Approches proposées pour le plan détaillé

Estimations indicatives pour une personne connaissant le dépôt, vérification comprise ; les lots
partagent du travail et ne doivent pas être additionnés mécaniquement.

1. **Amélioration progressive — recommandée.** D’abord les constats P1 (environ 5–9 jours selon la
   protection de navigation retenue), puis cohérence et parcours parent (environ 4–7 jours), enfin
   planning, historique et notifications après cadrage. Risque moyen ; pas de changement métier
   nécessaire pour les premiers lots.
2. **Fluidité et performance en premier.** État URL, liens préfiltrés et pagination serveur
   (environ 4–7 jours). Mesurer la taille des données et les temps sur des écoles réalistes.
   Risque moyen ; aucune promesse chiffrée avant mesure.
3. **Architecture et système visuel en premier.** Harmoniser primitives, surfaces et contrôles,
   puis séparer les responsabilités des gros composants qui le justifient (environ 5–9 jours).
   Risque moyen de régression visuelle et d’évolution des API internes.
4. **Fiabilité et tests de parcours en premier.** Protection des saisies, tiroir mobile, retour
   Stripe, notifications et scénarios E2E par rôle (environ 5–9 jours, hors infrastructure push).
   Risque moyen, particulièrement sur les changements de navigation.

## Approche retenue : amélioration progressive

Choix utilisateur : option 1. Le plan couvre les douze constats ; les enrichissements métier restent
des lots ultérieurs. Il organise le travail et ne constitue pas une autorisation de développement.
Les positions de code ci-dessous correspondent à l’état audité et pourront évoluer.

### Ordre et budget

| Lot | Résultat | Dépendances | Effort indicatif |
| --- | --- | --- | --- |
| 1. Protéger | Saisies préservées, erreurs localisées, navigation mobile maîtrisée | Aucune ; reproduire d’abord le risque sur l’appel | 3–6 jours |
| 2. Relier | Listes et onglets partageables, tâches préfiltrées, cartes enfants avec accès au dossier | Contrat d’état URL avant les liens préfiltrés | 3–5 jours |
| 3. Clarifier | Surfaces cohérentes, paiement confirmé, destination des notifications conservée | Lot 1 pour les primitives partagées | 3–5 jours |
| 4. Passer à l’échelle | Pagination serveur des familles et mesure sur données réalistes | Lot 2 | 2–4 jours |
| 5. Enrichir | Appel en liste, historique consultable, puis planning hebdomadaire | Validation visuelle et usage des lots précédents | 4–8 jours pour appel + historique ; planning séparé |

Première tranche : **lots 1 et 2, environ 6–11 jours**. Les deux lots suivants représentent environ
5–9 jours supplémentaires. Ces fourchettes incluent les tests ciblés et une recette du lot,
pas la mise en place d’une nouvelle infrastructure de notifications ou d’un mode métier hors ligne.
Le budget détaillé remplace les fourchettes préliminaires des approches, sans les cumuler.

### Lot 1 — Protéger les actions quotidiennes

**1.1. Préserver le formulaire famille et guider la correction des erreurs (constats 3 et 4).**

- Fichiers : `src/components/ui/dialog/dialog.tsx:64`, `:145`, `:195` ;
  `app/[locale]/(dashboard)/dashboard/families/_components/create-family-dialog.tsx:118`, `:196`.
- Introduire une possibilité de refuser la fermeture, puis l’utiliser uniquement lorsque le
  formulaire contient des changements. Traiter Échap, fond, bouton fermer et annulation de façon
  cohérente ; empêcher une fermeture involontaire pendant la soumission.
- Conserver le brouillon en mémoire tant que la session de saisie reste ouverte. Reporter la
  persistance durable : elle demande un traitement explicite des données personnelles.
- Associer les erreurs Zod aux champs et aux enfants concernés ; annoncer le résumé, focaliser
  le premier champ invalide et conserver la saisie après un échec serveur.
- Acceptation : Échap sur formulaire intact ferme ; sur formulaire modifié, « Continuer la saisie »
  conserve responsable, enfants et étape ; un échec de validation affiche le champ et la cause.
- Tests : compléter `src/components/ui/dialog/__tests__/dialog.test.tsx` et
  `app/[locale]/(dashboard)/dashboard/families/_components/create-family-dialog.test.tsx`.
- Effort : 1,5–2,5 jours. Risque : moyen. Rupture publique/métier : non ; extension additive de
  l’API interne du dialogue, comportement existant conservé chez les autres appelants.

**1.2. Garantir la sortie de l’appel sans perte (constat 6).**

- Fichiers :
  `app/[locale]/(dashboard)/dashboard/my-classes/[id]/attendance/_components/attendance-panel.tsx:145`,
  `:154`, `:241` ; `src/features/dashboard/search-modal.tsx:130` ;
  `src/features/dashboard/sidebar.tsx:103`.
- Reproduire sous réseau ralenti : modifier une présence, puis quitter immédiatement par sidebar,
  recherche, lien de créneau et retour navigateur. Vérifier la donnée enregistrée après retour.
- Si le risque est confirmé, choisir une stratégie compatible avec le routeur installé : attendre
  une sauvegarde ou garder l’utilisateur dans l’appel avec une action de reprise. Ne pas s’appuyer
  sur un `beforeunload` seul ou une API de blocage supposée disponible.
- Acceptation : aucune modification non confirmée ne disparaît silencieusement ; une erreur reste
  visible et empêche la validation d’une séance incomplètement sauvegardée.
- Tests : compléter `attendance-panel.test.tsx`, `attendance-panel-r2.test.tsx` et ajouter un
  scénario navigateur de navigation interne avec requête retardée/échouée.
- Effort : 1–2 jours, à réviser si le routeur impose une solution transversale. Risque : moyen.
  Rupture métier : non ; ne changer ni le sens des statuts ni les règles de validation.

**1.3. Terminer le comportement du tiroir mobile (constat 5).**

- Fichiers : `src/features/dashboard/sidebar.tsx:89`, `:141` ;
  `src/features/dashboard/header-client.tsx:51`.
- Vérifier le parcours clavier et lecteur d’écran, puis isoler le tiroir mobile du contenu de fond,
  gérer focus initial, confinement, restauration et défilement. Rendre les liens masqués inertes.
- Acceptation : tiroir fermé, Tab ne rejoint aucun lien hors écran ; ouvert, le focus reste dedans ;
  Échap restaure le focus au déclencheur. Passage mobile/bureau sans verrou de scroll résiduel.
- Tests : compléter `src/features/dashboard/__tests__/sidebar.test.tsx` et recette à 390 px,
  au breakpoint de bascule et sur bureau.
- Effort : 0,5–1,5 jour. Risque : moyen. Rupture d’API : non attendue.

### Lot 2 — Relier les écrans et garder le contexte

**2.1. Établir l’état URL des listes et onglets (constat 1).**

- Fichiers : `src/components/ui/rich-data-table/rich-data-table.tsx:64`, `:100` ;
  `src/components/ui/tabs/tabs.tsx:12`, `:18` ;
  `app/[locale]/(dashboard)/dashboard/families/page.tsx:24` ;
  `app/[locale]/(dashboard)/dashboard/enrollments/_components/enrollments-table.tsx:55` ;
  `app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx:257`.
- Définir un contrat validé par route (`q`, `status`, `sort`, `page`, `tab`) avec valeurs par défaut,
  bornes et remise à la première page quand le filtre change. Les noms sont proposés, pas encore
  une API livrée. Utiliser des clés d’onglet stables, jamais leur libellé traduit ou leur index.
- Donner aux primitives une interface contrôlée optionnelle ; garder leurs défauts actuels.
  Les routes portent la synchronisation URL pour préserver la réutilisation des primitives.
- Préserver les autres paramètres. Utiliser `replace` pour la saisie de recherche temporisée et
  définir explicitement les interactions qui créent une entrée d’historique.
- Exemple de comportement : `/fr/dashboard/enrollments?status=PENDING` ouvre les inscriptions
  en attente ; `/fr/dashboard/families/<id>?tab=payments` conserve l’onglet après rechargement.
- Acceptation : copier l’URL reproduit la vue ; retour depuis une fiche retrouve filtres et page ;
  paramètres invalides reviennent à une valeur sûre ; aucune donnée d’une autre école n’apparaît.
- Tests : compléter `rich-data-table.test.tsx`, `tabs.test.tsx`, `enrollments-table.test.tsx` et
  `families/[id]/page.test.tsx`, avec rechargement et historique au navigateur.
- Effort : 2–3 jours pour les premières routes. Risque : moyen. Rupture publique : non ; extensions
  internes additives et maintien des liens existants sans paramètres.

**2.2. Relier les tâches de l’accueil et les cartes enfants (constats 2 et 8).**

- Fichier principal : `app/[locale]/(dashboard)/dashboard/page.tsx:194`, `:313`, `:323`, `:335` ;
  réception des intentions : `dashboard/enrollments/page.tsx:35`, `dashboard/payments/page.tsx:35`.
- Propager le filtre d’inscriptions en attente ; distinguer la destination « chèques à encaisser »
  de la destination « restes à payer ». Définir le filtre ou l’onglet récepteur avant de modifier le lien.
- Ajouter « Voir le dossier » aux enfants, vers une route réellement accessible au parent ; afficher
  les raccourcis supplémentaires seulement si le module et le droit existent.
- Acceptation : chaque compteur ouvre les éléments correspondant à son libellé ; un parent accède
  au dossier de son enfant et reste refusé sur celui d’une autre famille.
- Tests : `dashboard/page.test.tsx`, `dashboard/payments/page.test.tsx`,
  `dashboard/payments/_components/payments-table.test.tsx` et tests de portée de la route enfant.
- Effort : 1–2 jours. Risque : faible à moyen. Rupture d’API ou métier : non.

### Lot 3 — Clarifier les états et harmoniser la présentation

**3.1. Unifier les primitives et les annonces accessibles (constats 9 et 10).**

- Fichiers : `src/components/ui/rich-data-table/rich-data-table.tsx:142`, `:152`, `:182`, `:188` ;
  `src/components/ui/input/input.tsx:43` ; `src/styles/globals.css:74` ;
  `app/[locale]/(dashboard)/dashboard/payments/_components/payments-table.tsx:69` ;
  `dashboard/planning/_components/schedule-grid.tsx:55`.
- Remplacer les surfaces historiques par les tokens appropriés sur ces composants. Aligner les
  montants à droite et utiliser les chiffres tabulaires ; nommer la recherche et annoncer le tri.
- Exemple : `bg-white border-alabaster-700` devient `bg-surface border-border` lorsque la surface
  a ce rôle ; ce n’est pas un remplacement automatique de tous les blancs.
- Exemple : ajouter `aria-sort="ascending"` ou `"descending"` à l’en-tête trié, et un nom explicite
  au champ de recherche. Le menu de colonnes doit annoncer ouverture et fermeture au clavier.
- Acceptation : tableaux, champs et planning partagent leurs surfaces ; tri et recherche sont
  compréhensibles au lecteur d’écran ; anciennes couleurs d’école testées sur les actions principales.
- Tests : `rich-data-table.test.tsx`, `payments-table.test.tsx`, `schedule-grid.test.tsx` ; captures
  avant/après sur mobile et bureau. Pas de mode sombre partiel dans ce lot.
- Effort : 1,5–2,5 jours. Risque visuel : moyen. Rupture d’API : non attendue.

**3.2. Donner un état fiable au retour de paiement (constat 12).**

- Fichiers : `app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx:246`,
  `families/[id]/_components/online-payment-button.tsx:22` ; ajouter une lecture de statut protégée
  seulement après identification du lien existant entre checkout, famille et paiement.
- Afficher un état d’attente tant que le serveur ne confirme pas le règlement ; rafraîchissement
  borné, puis message explicatif et action manuelle. Ne pas déduire la réussite de `payment=success`.
- Acceptation : webhook retardé, aucun faux succès ; webhook reçu, solde et référence cohérents ;
  erreur réseau récupérable et tentatives terminées après la limite prévue.
- Tests : `families/[id]/page.test.tsx`, tests de confirmation checkout existants et scénario de
  retour navigateur avant webhook. Conserver l’idempotence et les protections financières.
- Effort : 1–2 jours sous réserve des identifiants disponibles. Risque : moyen. Rupture métier : non ;
  migration de base non prévue, à réévaluer avant développement si une nouvelle donnée est requise.

**3.3. Corriger la destination du gestionnaire de notifications (constat 7).**

- Fichier : `public/sw.js:65`, `:80`.
- Conserver une destination interne validée dans `options.data`, normaliser les URL avant comparaison
  avec les clients ouverts et conserver un repli sûr. Mettre à jour la version du worker si nécessaire.
- Acceptation : notification ciblée, bonne route et bonne locale ; onglet compatible déjà ouvert,
  réutilisation ; URL externe, repli interne. Ne déclencher aucune notification réelle pendant les tests.
- Tests : compléter `src/features/pwa/__tests__/service-worker.test.ts` avec push et clic.
- Effort : 0,5 jour. Risque : faible. Rupture d’API : non ; infrastructure push hors périmètre.

### Lot 4 — Borner les données avant la croissance

**4.1. Paginer les familles côté serveur (constat 11).**

- Fichiers : `app/[locale]/(dashboard)/dashboard/families/page.tsx:63`, `:109` ;
  `src/components/ui/rich-data-table/rich-data-table.tsx:122` ;
  `dashboard/families/_components/families-data-table.tsx:224`.
- Réutiliser le contrat URL du lot 2 et ajouter un mode de pagination contrôlée au tableau sans
  désactiver le mode client des autres usages. Borner la requête de familles avant chargement des
  relations ; tri stable, compte total et filtre identiques pour lecture et comptage.
- Préserver les calculs de solde et la séparation enseignant/administrateur. Les agrégats globaux
  ne doivent pas devenir, par erreur, des agrégats limités à la page affichée.
- Acceptation : changer de page change les enregistrements lus au serveur ; recherche et tri portent
  sur tout le périmètre autorisé ; mêmes soldes qu’avant, pas de doublon entre pages à tri identique.
- Tests : `dashboard/families/page.test.tsx`, tests du tableau et jeu de données local jetable.
  Mesurer avant/après durée de lecture et taille des données de page, sans seed destructif partagé.
- Effort : 2–4 jours. Risque : moyen. Rupture interne : extension du contrat de pagination ;
  aucun changement de schéma ou de règle métier prévu.

### Lot 5 — Enrichir les parcours après stabilisation

**5.1. Offrir une liste compacte pour l’appel.**

- Point d’entrée : `attendance-panel.tsx:506`. Réutiliser la sauvegarde, les erreurs et les droits
  existants ; ne pas dupliquer la logique métier dans la nouvelle vue.
- Acceptation : chaque élève est trouvable rapidement, correction d’une exception sans navigation
  entre cartes, mêmes résultats et mêmes protections dans les deux présentations.
- Tests : suites `attendance-panel*.test.tsx` et recette chronométrée sur une classe représentative.
- Effort : 2–4 jours. Risque : moyen. Rupture métier : non.

**5.2. Rendre l’historique familial consultable.**

- Point d’entrée : `families/[id]/_components/activity-feed.tsx:81`. Ajouter un chargement borné
  « Voir plus », puis des filtres sur les types d’activité existants.
- Acceptation : l’utilisateur peut consulter plus de huit événements ; ordre stable, contrôle des
  droits et exclusion des données financières pour les rôles non autorisés.
- Tests : nouveaux tests du fil, plus tests de portée de la page famille.
- Effort : 2–4 jours. Risque : moyen. Rupture métier : non ; nouveaux types d’activité hors lot.

**Chantiers ultérieurs à cadrer séparément.** Planning sur axe horaire
(`schedule-grid.tsx:49`, 4–7 jours indicatifs), vue parent « cette semaine »
(`dashboard/page.tsx:215`, 3–6 jours indicatifs), mode sombre complet et préférences de notifications.
Ne pas inclure d’infrastructure push, de règles de conflit ou de stockage métier hors ligne sans
leurs critères d’acceptation. Lire et mettre à jour `docs/business-rules.md` si leurs règles évoluent.

### Validation transversale et livraison

- Première validation navigateur : reproduire les risques 5 et 6 avant de coder leur correction.
  Utiliser des comptes et données de démonstration autorisés, sans paiement réel.
- Pour chaque lot : tests du comportement modifié, recette en français et anglais, mobile et bureau,
  vérification par rôle. Ajouter les scénarios E2E critiques au dispositif du dépôt après choix et
  configuration de l’outillage ; il n’existe pas encore de suite E2E démontrée par cet audit.
- Points de recette : liens partagés, rechargement, précédent/suivant navigateur, changement d’école
  et de période, réseau ralenti, échec serveur, clavier et retour du focus.
- Une PR par lot cohérent ; découper le premier lot si nécessaire pour isoler les primitives et
  l’appel. Avant chaque PR, exécuter la séquence CI du dépôt : installation figée, génération Prisma,
  lint, lint Tailwind, type-check, tests, knip et build, avec Node 26 comme CI.
- Captures avant/après pour les changements d’interface. Aucun seed destructif, déploiement ou
  changement d’environnement requis dans le plan initial.
- Aucune migration publique nécessaire pour les premiers lots. Les nouvelles props contrôlées
  restent optionnelles ; migrer les appelants route par route avant d’envisager un retrait d’API.

### Indicateurs de réussite

| Indicateur | État observé | Cible de recette |
| --- | --- | --- |
| Retour liste après fiche | State local non garanti au remontage | Même recherche, filtre, tri et page sur les routes migrées |
| Action depuis l’accueil | Liens génériques pour les tâches examinées | Une ouverture mène à la vue correspondant au compteur |
| Fermeture d’une saisie modifiée | Dialogue fermé sans garde | Aucun abandon silencieux dans le formulaire famille |
| Appel et navigation immédiate | Risque de perte non reproduit | Toutes les sorties testées préservent la saisie ou explicitent le blocage |
| Navigation mobile au clavier | Risque de focus hors écran | Aucun contrôle masqué atteint ; focus restauré après fermeture |
| Carte enfant vers dossier | Aucun lien dans la carte | Un lien explicite autorisé par enfant |
| Retour Stripe avant webhook | Message statique | Attente explicite puis confirmation serveur ou fin d’attente expliquée |
| Notification ciblée | Reproduction : destination perdue | Destination et locale conservées, repli interne testé |
| Familles lues par page | Toutes les familles actives | Nombre de familles borné par la taille demandée |
| Rapidité ressentie et appel | Non mesurée | Mesure initiale puis comparaison sur mêmes données et appareil |

## Synthèse finale

Audit transversal du code, douze constats documentés, sept axes d’enrichissement et approche
progressive choisie. Le plan propose cinq lots ; les deux premiers apportent la protection des
saisies et des parcours continus, avant les évolutions de présentation et de volume.
Le rapport distingue les faits confirmés des risques nécessitant une reproduction navigateur.
Vérification réalisée : 59 tests ciblés réussis et défaut de destination push reproduit isolément.
Le développement, la recette visuelle complète et la séquence CI des futurs lots restent à faire.
