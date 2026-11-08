# Audit : contenu et configuration (workflows 19 à 21)

Périmètre :

- W19 : événements, pages publiques, affiche imprimable et flux ICS.
- W20 : configuration de l'école et de la plateforme, branding, upload S3 et route `app/api/media`.
- W21 : administration des écoles (super-admin) et import legacy (`scripts/migrate-legacy.mjs`).

Méthode : lecture de code de bout en bout, de l'action serveur à la base et à l'affichage.
Aucune exécution en navigateur. Ce qui n'a pas pu être confirmé est marqué « à vérifier ».

## 1. Synthèse

| Workflow                             | Solide | Simple | UX  | UI  | Verdict                                                                                                   |
| ------------------------------------ | ------ | ------ | --- | --- | --------------------------------------------------------------------------------------------------------- |
| W19 Événements, public, affiche, ICS | 2/5    | 4/5    | 3/5 | 4/5 | Autorisations saines, mais l'heure est fausse dans l'ICS et le slug peut être vide                        |
| W20 Config, branding, S3, média      | 3/5    | 4/5    | 4/5 | 4/5 | Validation correcte sauf `logo_url` : SSRF via `/icon` et objets S3 orphelins                             |
| W21 Écoles et import legacy          | 3/5    | 4/5    | 3/5 | 4/5 | Désactivation bien verrouillée, mais l'import n'est pas atomique et le changement de slug casse les liens |

Points solides sur les trois workflows :

- Chaque action commence par `requireSchoolAdmin` ou `requirePlatformAdmin`.
- La garde tenant et le soft-delete sont centralisés dans `src/lib/db.ts`.
- La route média refuse le path traversal.
- Aucun `dangerouslySetInnerHTML`.
- L'échappement et le pliage des lignes ICS sont conformes à la RFC.

## 2. Constats par workflow

### W19 : événements, pages publiques, affiche, ICS

#### Critique

- **Heure décalée dans le flux ICS pour les événements horodatés.**
  - Où : `src/domain/event-ics.ts:109-110`.
  - Cause : l'heure murale de l'école est stockée comme de l'UTC (`parseEventInputValue` ajoute `Z`), puis exportée avec `Z` (`formatIcsDateTimeUtc`, l.62-65).
  - Scénario : une réunion saisie à 18:00 à Paris sort en `DTSTART:...T180000Z`. Google et Apple Calendar l'affichent à 20:00 en été, 19:00 en hiver. Les parents arrivent en retard.
  - Correction : émettre une date-heure flottante (sans `Z`), ou ajouter un fuseau à `School` et émettre `DTSTART;TZID=<fuseau>` avec son `VTIMEZONE`.

#### Majeur

- **Slug vide pour un titre sans caractère latin.**
  - Où : `src/domain/event.ts:27-35` et `src/use-cases/events/create-event.ts:22-26`.
  - Scénario : un titre en arabe ou uniquement en emojis donne un slug `''`.
    - Le premier événement est créé avec une URL publique `/ecole/<slug>/evenements/` qui ne résout pas.
    - Le second provoque une P2002 non interceptée.
  - Correction : refuser un slug vide, ou retomber sur un suffixe dérivé de l'id, puis renvoyer `invalidSlug`.

- **Courses sur les contraintes uniques qui deviennent des exceptions non gérées.**
  - Où :
    - slug d'événement : `create-event.ts:22-26` et `update-event.ts:36-38` ;
    - limite de 6 images : `add-event-image.ts:20-23` ;
    - `upsertConfig` : `config-gateway.ts` fait `findFirst` puis `create`.
  - Cause : `useDialogForm.run()` n'intercepte pas les exceptions (`src/features/forms/use-dialog-form.ts:25-36`).
  - Scénario : deux uploads d'image simultanés donnent 7 images ou deux positions identiques. Deux créations simultanées avec le même titre produisent une erreur non gérée, sans toast.
  - Correction : intercepter P2002 dans le gateway pour renvoyer `slugAlreadyUsed`, et compter puis insérer dans une transaction verrouillée.

- **Objets S3 orphelins.**
  - Où :
    - `app/[locale]/(dashboard)/_lib/event-actions.ts:79-88` : l'upload se fait avant `addEventImage`, qui peut échouer (`tooManyImages`, `notFound`) ;
    - `src/gateways/event-gateway.ts:68-89` : `removeImage` supprime la ligne sans supprimer l'objet.
  - Scénario : chaque 7e image refusée, et chaque image retirée, reste servie à vie par `/api/media`, avec cache public immuable.
  - Correction : vérifier la limite avant le `put`, supprimer l'objet quand l'attache échoue et au retrait, ou lancer un balayage périodique des clés non référencées.

- **La liste publique est une impasse.**
  - Où : `app/[locale]/ecole/[slug]/evenements/page.tsx:128-164` et `src/gateways/event-gateway.ts:94-99`.
  - Problèmes :
    - les cartes n'ont pas de lien vers la page de détail ;
    - aucune borne de date : tous les événements passés s'affichent en premier, du plus ancien au plus récent.
  - Scénario : un parent ouvre la page, doit défiler deux ans d'événements passés, puis ne peut ouvrir ni le détail ni les images.
  - Correction : faire de chaque carte un lien vers `[eventSlug]`, et séparer « À venir » (tri croissant) de « Passés » (repliés, tri décroissant).

- **Le bandeau d'annonce et la visibilité « à venir » sont décalés de l'offset de l'école.**
  - Où : `src/domain/event.ts:107`, `131-153` et `172`.
  - Cause : `startAt > now` compare une heure murale stockée en UTC à un instant réel.
  - Scénario : en été à Paris, un événement de 18:00 est considéré comme commencé dès 16:00 réelles, deux heures trop tôt.
  - Correction : comparer à `now` converti en heure murale de l'école, avec la même source de fuseau que pour l'ICS.

#### Mineur

- `UID` ICS vaut `<id>@<schoolSlug>` (`event-ics.ts:94`). Changer le slug de l'école duplique tous les événements chez les abonnés. Correction : UID `<id>@<domaine de l'app>`.
- Le flux ICS inclut tout l'historique. Correction : le borner, par exemple aux 12 derniers mois et à tout le futur.
- Le lien d'abonnement est en `https://` et non en `webcal://` (page publique des événements). Un clic télécharge le fichier au lieu de s'abonner. Correction : proposer un lien `webcal://` en plus du lien de téléchargement.
- La liste publique n'applique pas le `ThemeProvider` de l'école, contrairement à la page de détail. Le branding est donc incohérent entre les deux pages. Correction : envelopper la liste comme le détail.
- L'affiche imprimable (`app/[locale]/(print)/dashboard/events/[id]/affiche/page.tsx:85,113,134`) :
  - un brouillon (`DRAFT`) s'imprime sans avertissement ;
  - avec un titre de 120 caractères, un résumé de 280 et une couverture, le bloc de date en `mt-auto` risque d'être coupé par `overflow-hidden` (à vérifier visuellement).
  - Correction : bandeau « Brouillon » à l'écran, masqué à l'impression mais avec un avertissement, et `line-clamp` sur le titre et le résumé.
- Validation du formulaire :
  - `event-form-fields.tsx` : pas de `maxLength` sur la description (5000 côté serveur) ni de `min` sur `endAt`. L'erreur n'apparaît qu'à la soumission ;
  - `announceDaysBefore` n'a pas de maximum (`src/use-cases/events/schemas.ts:29`).
  - Correction : aligner les attributs HTML sur le schéma et borner `announceDaysBefore` à 60.
- `app/[locale]/evenements/page.tsx` renvoie un `permanentRedirect` (308) vers l'école unique. Les navigateurs le mettent en cache et il restera faux à l'ajout d'une deuxième école. Correction : utiliser `redirect` (307).
- `store-webp-image.ts:22` se fie au `file.type` fourni par le client. Sans impact, car sharp décode et ré-encode en WebP. Correction : décider du type sur `sharp().metadata().format`.

### W20 : configuration, branding, S3, route média

#### Majeur

- **SSRF via `logo_url` et `/icon`.**
  - Où : `src/lib/branding-icon.ts:14-33`, `app/icon.tsx:10-13` et `src/use-cases/config/set-config.ts:21-33`.
  - Cause :
    - `logo_url` est un TEXT libre ;
    - `new URL(logoUrl, NEXT_PUBLIC_APP_URL)` accepte une URL absolue ;
    - `/icon` est `force-dynamic` et récupère l'URL côté serveur, en suivant les redirections, sans limite de taille (timeout de 3 s).
  - Scénario : un admin d'école saisit `http://169.254.169.254/latest/meta-data/` ou un service interne.
    - N'importe quel visiteur anonyme déclenche la requête serveur, puisque le cookie `active_school` suffit (`src/lib/branding.ts:48-72`).
    - C'est une SSRF aveugle, plus un vecteur de consommation mémoire.
  - Correction : n'accepter pour `logo_url` que des chemins `/api/media/branding/<schoolId>/...` ou des URL `https` d'une liste blanche, et côté `/icon` lire l'objet via le `storage-gateway` plutôt que par `fetch`.

- **`logo_url` permet un pixel de tracking.**
  - Où : `set-config.ts:21-33` et `schemas.ts` (`value: z.string()` sans maximum).
  - Scénario : une URL tierce est chargée par le navigateur de chaque parent, ce qui expose IP et user-agent à un tiers. La valeur n'a pas de longueur maximale.
  - Correction : même validation que ci-dessus et `max(2048)`.

#### Mineur

- **Upload immédiat dans le dialogue de configuration.**
  - Où : `image-value-field.tsx:35-46`.
  - Scénario : l'image est stockée dès sa sélection. Annuler le dialogue laisse un objet orphelin.
  - Correction : même stratégie de nettoyage que pour W19.
- **Aucune limite de débit sur les uploads.**
  - Où : `media-actions.ts`.
  - Scénario : un admin, ou un compte admin compromis, peut remplir le bucket (11 Mo par requête, `next.config.ts`).
  - Correction : quota par école.
- **`HeadBucket` à chaque `put`.**
  - Où : `src/gateways/storage-gateway.ts:15-27`.
  - Problèmes :
    - un aller-retour S3 supplémentaire à chaque upload ;
    - `CreateBucket` est tenté sur n'importe quelle erreur, 403 compris, ce qui masque la vraie cause ;
    - les erreurs de `put` ne sont pas interceptées.
  - Correction : mémoriser le résultat, ne créer le bucket que sur 404, et convertir les erreurs S3 en `uploadFailed`.
- **Anciens logos SVG servis sans CSP.**
  - Où : `app/api/media/[...key]/route.ts` renvoie le Content-Type stocké, et `next.config.ts` ne définit pas de CSP.
  - Scénario : d'anciens logos SVG, s'il en existe (à vérifier en base), seraient servis en `image/svg+xml` sur l'origine de l'application.
  - Correction : ajouter `Content-Security-Policy: default-src 'none'; sandbox` sur cette route. `nosniff` est déjà présent.

Points corrects :

- `COLOR` est validé par `HEX_COLOR` (`theme-palettes.ts:18`) et `NUMBER` par `isPositiveInteger`.
- Les réglages plateforme sont protégés par `requirePlatformAdmin`, et le panneau plateforme n'est visible que du super-admin.
- Les erreurs `config.*` sont traduites en fr et en en.

### W21 : écoles et import legacy

#### Majeur

- **L'import legacy n'est pas atomique.**
  - Où : `scripts/migrate-legacy.mjs:172-174`, puis des phases `BEGIN`/`COMMIT` successives (l.179-223, 228-251, etc.) ; le `catch` n'annule que la phase en cours.
  - Scénario : une ligne legacy invalide en phase 4 (FK, contrainte, donnée nulle) laisse l'école purgée et à moitié importée. Les `UserFamily`, `Invitation` et `PaymentTransaction` purgés ne sont jamais réinsérés (`scripts/lib/purge-school.mjs:15-21`).
  - Correction :
    - exécuter la purge et tous les inserts dans une seule transaction ;
    - ajouter une option `--dry-run` qui annule à la fin ;
    - demander une confirmation quand l'école contient déjà des données.

- **Changer le slug d'une école casse ses liens publics.**
  - Où : `src/use-cases/schools/update-school.ts:16-19`.
  - Scénario : le super-admin corrige le slug.
    - Les liens d'événements partagés et les affiches imprimées (QR ou URL) répondent 404.
    - Les abonnements ICS sont rompus, puis dupliqués via l'UID (voir W19).
  - Correction : avertir dans le dialogue et conserver une table d'alias de slugs qui redirige en 308.

#### Mineur

- **Une invitation expirée bloque la désactivation.**
  - Où : `src/gateways/school-gateway.ts:125`.
  - Cause : le compte `usedAt: null` inclut les invitations expirées (`expiresAt` dépassé).
  - Scénario : une invitation de l'an dernier, jamais utilisée, bloque la désactivation. Le super-admin doit passer par l'écran utilisateurs de l'école pour la révoquer.
  - Correction : ajouter `expiresAt: { gt: new Date() }`.
- **`name` n'est pas trimé.**
  - Où : `src/use-cases/schools/schemas.ts`.
  - Scénario : `"   "` est accepté comme nom d'école.
  - Correction : `.trim().min(1)`.
- **Course sur le slug d'école.**
  - Où : création et mise à jour d'école.
  - Scénario : P2002 non interceptée, même mécanique que W19.
  - Correction : intercepter P2002 et renvoyer `slugAlreadyUsed`, déjà traduit.
- **Import dans une école désactivée.**
  - Où : `migrate-legacy.mjs:136`.
  - Cause : la vérification de l'école n'inclut pas `isActive`, donc l'import peut viser une école désactivée.
  - Correction : filtrer `"isActive" = true` ou exiger `--allow-inactive`.

Points corrects :

- `--school-id` est obligatoire (`scripts/lib/school-arg.mjs`) et chaque `DELETE` est filtré par `schoolId`. Ces deux points sont testés.
- `deactivate` verrouille les écoles actives (`FOR UPDATE`) et compte les blocages sous le verrou.
- Les erreurs `slugAlreadyUsed`, `lastActiveSchool` et `alreadyActive` sont traduites en fr et en en.

## 3. Top 5 des actions

1. **Corriger le fuseau horaire des événements horodatés.** Ajouter un fuseau à `School`, puis émettre `TZID` (ou une heure flottante) dans l'ICS et comparer « à venir » ou « annoncé » en heure murale. Corrige l'ICS et le bandeau J-x.
2. **Fermer la SSRF de `/icon`.** Limiter `logo_url` aux clés du bucket de l'école (ou à une liste blanche `https`), et lire le logo via le `storage-gateway` plutôt que par `fetch`.
3. **Rendre l'import legacy atomique.** Une seule transaction pour la purge et les inserts, avec `--dry-run` et une confirmation si l'école contient des données.
4. **Intercepter P2002 et fiabiliser `useDialogForm`.**
   - Slugs d'événement et d'école, config et positions d'image renvoient un code typé.
   - `run()` intercepte les exceptions pour afficher un toast générique.
   - Le slug vide est refusé.
5. **Rendre la liste publique utilisable et stable.**
   - Cartes cliquables vers le détail.
   - Séparation « À venir » et « Passés ».
   - Lien `webcal://`.
   - UID ICS indépendant du slug, et avertissement ou alias au changement de slug d'école.
