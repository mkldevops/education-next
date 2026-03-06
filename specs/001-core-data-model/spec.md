# Feature Specification: Core Data Model — Enrollment Management

**Feature Branch**: `001-core-data-model`
**Created**: 2026-03-05
**Status**: Draft
**Input**: my_specs.md + mcd.png

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Gestion des familles et élèves (Priority: P1)

En tant qu'administrateur, je veux créer des fiches famille avec leurs membres (personnes, contacts, numéros de téléphone) et y rattacher des élèves, afin de disposer d'un annuaire complet avant toute inscription.

**Why this priority**: Sans familles ni élèves, aucune inscription ni paiement n'est possible. C'est la fondation de toute l'application.

**Independent Test**: Créer une famille, y ajouter des personnes avec différentes relations (parent, tuteur…), ajouter un élève avec ses informations médicales et scolaires, puis vérifier que l'élève apparaît dans la liste des élèves et dans la fiche famille.

**Acceptance Scenarios**:

1. **Given** l'admin est connecté, **When** il crée une famille avec un nom et un contact d'urgence, **Then** la famille apparaît dans la liste des familles avec un identifiant unique
2. **Given** une famille existante, **When** l'admin ajoute une personne (nom, prénom, sexe, email, adresse, code postal, ville) avec une relation (parent, tuteur, etc.), **Then** la personne est rattachée à la famille avec le type de relation correct
3. **Given** une personne existante dans une famille, **When** l'admin ajoute un numéro de téléphone avec des canaux de communication (SMS, WhatsApp, appel), **Then** le numéro est enregistré et visible sur la fiche
4. **Given** une famille existante, **When** l'admin crée un élève (date de naissance, lieu de naissance, école précédente, notes de santé, langues parlées à la maison, autorisation goûter, allergies), **Then** l'élève hérite des champs de Person et est rattaché à la famille
5. **Given** un élève existant, **When** l'admin consulte la liste des élèves, **Then** l'élève apparaît avec sa famille associée
6. **Given** une famille avec des personnes et élèves, **When** l'admin désactive (soft-delete) un élève, **Then** l'élève n'apparaît plus dans les listes actives mais reste en base de données

---

### User Story 2 — Gestion des périodes, niveaux et classes (Priority: P2)

En tant qu'administrateur, je veux configurer les périodes scolaires, les niveaux et les classes périodiques, afin de structurer l'année scolaire avant les inscriptions.

**Why this priority**: Les classes périodiques sont le conteneur des inscriptions. Sans elles, impossible d'inscrire un élève.

**Independent Test**: Créer une période (ex: 2026-2027), un niveau (ex: CP), puis une classe périodique rattachée aux deux avec une capacité. Vérifier que la classe apparaît dans le planning.

**Acceptance Scenarios**:

1. **Given** l'admin est connecté, **When** il crée une période avec un nom, une date de début et une date de fin, **Then** la période est enregistrée et visible dans la liste des périodes
2. **Given** l'admin est connecté, **When** il crée un niveau avec un nom libre (CP, CE1, Level 1…), **Then** le niveau est enregistré
3. **Given** une période et un niveau existants, **When** l'admin crée une classe périodique avec un nom et une capacité, **Then** la classe est rattachée au niveau et à la période
4. **Given** une classe périodique avec une capacité de 25, **When** l'admin consulte la classe, **Then** il voit le nombre de places restantes (capacité - inscriptions non-annulées ayant une affectation courante dans cette classe)
5. **Given** des périodes configurées différemment pour deux déploiements (sept-août en France, oct-sept ailleurs), **When** chaque école crée sa période, **Then** l'application fonctionne sans modification de code

---

### User Story 3 — Inscription des élèves (Priority: P3)

En tant qu'administrateur, je veux inscrire un élève dans une classe périodique avec un plan tarifaire, afin de gérer les effectifs et le suivi financier.

**Why this priority**: L'inscription est le processus métier central qui relie élèves, classes et paiements.

**Independent Test**: Inscrire un élève existant dans une classe périodique, choisir un plan tarifaire, vérifier que l'inscription apparaît avec le statut "pending" et le montant total calculé.

**Acceptance Scenarios**:

1. **Given** un élève rattaché à une famille et une classe périodique disponible, **When** l'admin inscrit l'élève en sélectionnant un plan tarifaire, **Then** une inscription est créée avec le statut "pending", le montant total du plan, et la date d'inscription
2. **Given** une inscription au statut "pending", **When** l'admin la valide, **Then** le statut passe à "active"
3. **Given** une inscription au statut "active", **When** l'admin la complète, **Then** le statut passe à "completed"
4. **Given** une inscription, **When** l'admin tente de sauter un statut (ex: pending → completed), **Then** le système refuse la transition
5. **Given** une inscription au statut "pending" ou "active", **When** l'admin l'annule, **Then** le statut passe à "cancelled", l'affectation courante est clôturée (endAt = aujourd'hui), et l'inscription est retirée des effectifs de la classe
6. **Given** une classe périodique pleine (capacité atteinte), **When** l'admin tente d'inscrire un nouvel élève, **Then** le système affiche un avertissement et bloque l'inscription
7. **Given** une inscription existante, **When** l'admin applique une réduction (discount), **Then** le montant total est recalculé
8. **Given** une inscription, **When** l'admin définit "l'élève peut partir seul" (canLeaveAlone), **Then** cette information est enregistrée sur l'inscription
9. **Given** un élève inscrit dans la période N, **When** l'admin déclenche la promotion automatique (si activée), **Then** l'élève est pré-inscrit dans le niveau suivant pour la période N+1
10. **Given** un élève affecté à une classe CP, **When** l'admin le réoriente vers CE1 en cours de période, **Then** l'affectation CP est clôturée (endAt = aujourd'hui) et une nouvelle affectation CE1 est créée (startAt = aujourd'hui, endAt = null)

---

### User Story 4 — Gestion des paiements (Priority: P4)

En tant qu'administrateur, je veux enregistrer des paiements sur la fiche famille et les répartir sur les inscriptions actives, afin de suivre les encaissements.

**Why this priority**: Le suivi financier est critique pour l'école mais dépend des inscriptions existantes.

**Independent Test**: Enregistrer un paiement en espèces sur une famille ayant 2 inscriptions actives, vérifier que le montant est réparti équitablement et que le solde restant de chaque inscription est mis à jour.

**Acceptance Scenarios**:

1. **Given** une famille avec des inscriptions actives, **When** l'admin enregistre un paiement en espèces avec un montant et une référence, **Then** le paiement est enregistré avec la méthode "cash" et la date de paiement
2. **Given** une famille avec 2 inscriptions de 500 € chacune, **When** l'admin enregistre un paiement de 200 €, **Then** 100 € sont attribués à chaque inscription
3. **Given** un paiement par chèque, **When** l'admin saisit le montant et la date d'encaissement future, **Then** le paiement est enregistré avec la date d'encaissement (cashedAt) distincte de la date de paiement (paidAt)
4. **Given** une inscription avec un montant total de 500 € et 500 € déjà payés, **When** l'admin tente d'enregistrer un paiement supplémentaire sur cette inscription, **Then** le système refuse le sur-paiement
5. **Given** des paiements enregistrés, **When** l'admin consulte la fiche famille, **Then** il voit le récapitulatif : montant total dû, montant payé, solde restant par inscription

---

### User Story 5 — Portail famille (Priority: P5, deferred)

En tant que membre d'une famille (role: family), je veux consulter les informations de mes enfants et effectuer des paiements en ligne, afin de suivre leur scolarité à distance.

**Why this priority**: Fonctionnalité à haute valeur ajoutée mais qui dépend de toutes les briques précédentes.

**Independent Test**: Se connecter avec un compte family, vérifier qu'on voit uniquement les élèves de sa famille, les inscriptions et paiements, et qu'on peut initier un paiement Stripe sans pouvoir modifier les informations des élèves.

**Acceptance Scenarios**:

1. **Given** un utilisateur avec le rôle "family" lié à une famille, **When** il se connecte, **Then** il voit uniquement les élèves rattachés à sa famille
2. **Given** un utilisateur family connecté, **When** il consulte un élève, **Then** il voit les informations de l'élève, ses inscriptions et le solde restant, mais ne peut rien modifier
3. **Given** un utilisateur family avec un solde impayé, **When** il initie un paiement en ligne, **Then** il est redirigé vers le processus de paiement Stripe
4. **Given** un paiement Stripe complété avec succès, **When** la confirmation est reçue, **Then** le paiement est enregistré automatiquement et le solde mis à jour
5. **Given** un utilisateur family, **When** il tente d'accéder à une famille qui n'est pas la sienne, **Then** l'accès est refusé

---

### User Story 6 — Configuration par déploiement (Priority: P6)

En tant qu'administrateur, je veux configurer les paramètres de l'application (devise, promotion automatique, etc.) via une interface de configuration, afin d'adapter l'outil à mon école sans modification de code.

**Why this priority**: La configurabilité est essentielle pour le multi-tenant mais peut être implémentée progressivement.

**Independent Test**: Modifier un paramètre Config (ex: activer la promotion automatique), vérifier que le comportement de l'application change en conséquence.

**Acceptance Scenarios**:

1. **Given** l'admin est connecté, **When** il accède aux paramètres, **Then** il voit la liste des configurations avec leur nom, valeur et type
2. **Given** un paramètre "automatic_promotion" de type boolean avec la valeur "false", **When** l'admin le passe à "true", **Then** le système propose la promotion automatique lors du passage à une nouvelle période
3. **Given** un paramètre de type texte, nombre ou boolean, **When** l'admin le modifie, **Then** la valeur est validée selon le type avant enregistrement

---

### Edge Cases

- Que se passe-t-il quand une famille n'a plus d'élèves actifs ? La famille reste accessible mais sans élèves dans les listes actives.
- Que se passe-t-il quand un élève est inscrit dans une classe puis que la classe est désactivée ? La désactivation de classe est interdite tant qu'elle contient des inscriptions actives (affectation courante endAt = null). Les affectations historiques (endAt renseigné) restent valides.
- Que se passe-t-il si un paiement par chèque est enregistré mais que la date d'encaissement n'est pas encore passée ? Le paiement est comptabilisé mais marqué comme "à encaisser" jusqu'à la date.
- Que se passe-t-il si une période se chevauche avec une autre ? Le système interdit les périodes qui se chevauchent.
- Que se passe-t-il si un élève est déjà inscrit dans une classe pour la même période ? Le système refuse le doublon (une seule inscription non-annulée par période).
- Comment gère-t-on un remboursement ? Le remboursement est enregistré comme un paiement négatif. La distribution inverse s'applique : le montant négatif est réparti proportionnellement sur les inscriptions actives ayant des paiements, réduisant le montant payé de chaque inscription. Le système DOIT empêcher qu'un remboursement rende le total payé d'une inscription négatif.
- Que se passe-t-il quand la distribution proportionnelle produit des fractions de centimes ? L'arrondi HALF_UP à 2 décimales est appliqué. Le dernier centime de différence est attribué à la première inscription pour garantir que la somme des parts égale le paiement.
- Que se passe-t-il si le nextLevel d'un Level est désactivé ? La promotion automatique saute ce niveau et cherche le prochain Level actif dans la chaîne. Si aucun Level actif suivant n'existe, le niveau est traité comme terminal.
- Que se passe-t-il si une famille a des inscriptions dans plusieurs périodes simultanément ? La distribution des paiements s'applique à TOUTES les inscriptions actives (status=ACTIVE) de la famille, indépendamment de la période.
- Que se passe-t-il si le montant d'un Plan est modifié après des inscriptions ? L'Enrollment stocke le totalAmount au moment de la création (snapshot). Modifier le Plan n'affecte pas les inscriptions existantes.
- Que se passe-t-il en cas d'inscriptions concurrentes dans une classe proche de sa capacité ? La vérification de capacité et la création d'inscription sont exécutées dans une transaction atomique pour éviter les race conditions.

## Requirements *(mandatory)*

### Functional Requirements

**Familles & Personnes**
- **FR-001**: Le système DOIT permettre de créer, modifier et désactiver des familles (nom, contact d'urgence, pickup autorisé)
- **FR-002**: Le système DOIT permettre de rattacher des personnes à une famille avec un type de relation (parent, tuteur, grand-parent, etc.)
- **FR-003**: Le système DOIT permettre d'ajouter des numéros de téléphone à une personne avec les canaux de communication associés (SMS, WhatsApp, appel)
- **FR-004**: Le système DOIT permettre de lier un ou plusieurs utilisateurs à une famille (relation "link" entre User et Family)

**Élèves**
- **FR-005**: Le système DOIT permettre de créer un élève uniquement via une fiche famille
- **FR-006**: L'élève DOIT hériter des champs de Person (nom, prénom, sexe, email, adresse) et ajouter : date de naissance, lieu de naissance, école précédente, notes de santé, langues parlées à la maison, autorisation goûter, allergies
- **FR-007**: Le système DOIT utiliser le soft-delete (champ isActive) pour toutes les entités. La désactivation (isActive = false) masque l'entité des requêtes par défaut tout en conservant les données en base. Les entités concernées : User, Family, Person, Student, PhoneNumber, Config, Level, Period, ClassPeriod, Enrollment, Payment, Plan

**Périodes & Niveaux**
- **FR-008**: Le système DOIT permettre de créer des périodes avec un nom, une date de début et une date de fin
- **FR-009**: Le système DOIT interdire les périodes qui se chevauchent
- **FR-010**: Le système DOIT permettre de créer des niveaux avec un nom libre défini par l'utilisateur
- **FR-011**: Le système DOIT permettre de créer des classes périodiques rattachées à un niveau et une période, avec un nom et une capacité maximale

**Inscriptions**
- **FR-012**: Le système DOIT permettre d'inscrire un élève pour une période en sélectionnant un plan tarifaire, puis de l'affecter à une classe périodique
- **FR-013**: L'inscription DOIT suivre une machine à états : pending → active → completed, avec annulation possible (pending → cancelled, active → cancelled). Aucun retour en arrière ni saut de statut autorisé
- **FR-014**: Le système DOIT empêcher l'inscription si la classe a atteint sa capacité maximale. La capacité occupée est calculée en comptant les inscriptions non-annulées (PENDING, ACTIVE, COMPLETED) ayant une affectation courante (endAt = null) dans cette classe
- **FR-015**: Le système DOIT empêcher les doublons d'inscription (un élève ne peut avoir qu'une seule inscription non-annulée par période, vérifiée via ClassAssignment → ClassPeriod → Period)
- **FR-015b**: Le système DOIT permettre de réaffecter une inscription à une autre classe périodique (réorientation, promotion, régression) en clôturant l'affectation courante (endAt) et en créant une nouvelle affectation
- **FR-015c**: Seule une affectation sans endAt est considérée comme l'affectation courante d'une inscription
- **FR-015d**: Lors de l'annulation d'une inscription, l'affectation courante (endAt = null) DOIT être clôturée automatiquement (endAt = date d'annulation)
- **FR-016**: Le système DOIT permettre d'appliquer une réduction sur une inscription et recalculer le montant total
- **FR-017**: Le système DOIT permettre d'enregistrer si l'élève peut partir seul (canLeaveAlone)

**Plans tarifaires**
- **FR-018**: Le système DOIT permettre de créer des plans tarifaires avec un nom et un montant
- **FR-019**: Un plan DOIT être associable à une ou plusieurs inscriptions. Le montant du plan est copié dans totalAmount de l'inscription au moment de la création (snapshot). Modifier un plan n'affecte pas les inscriptions existantes
- **FR-019b**: Le système DOIT permettre de lister les plans tarifaires actifs

**Paiements**
- **FR-020**: Le système DOIT permettre d'enregistrer des paiements sur une famille avec les méthodes : espèces, carte bleue, virement, chèque, Stripe
- **FR-021**: Les paiements par chèque DOIVENT enregistrer une date d'encaissement (cashedAt) distincte de la date de paiement (paidAt)
- **FR-022**: Les paiements DOIVENT être répartis au prorata du solde restant sur les inscriptions actives (status = ACTIVE) de la famille. L'algorithme : (1) charger les inscriptions actives avec solde > 0, (2) calculer le total restant dû, (3) pour chaque inscription : part = (solde_inscription / total_restant) × montant_paiement, (4) plafonner à solde_inscription, (5) appliquer dans une transaction atomique. L'arrondi HALF_UP à 2 décimales est appliqué, le dernier centime de différence est attribué à la première inscription
- **FR-022b**: Les remboursements sont enregistrés comme des paiements avec un montant négatif. La distribution inverse s'applique proportionnellement sur les inscriptions actives ayant des paiements. Le système DOIT empêcher qu'un remboursement rende le total payé d'une inscription négatif
- **FR-023**: Le système DOIT empêcher le sur-paiement (somme des paiements > montant total de l'inscription)
- **FR-024**: Le système DOIT permettre les paiements partiels et suivre le solde restant

**Portail famille**
- **FR-025**: Les utilisateurs avec le rôle "family" DOIVENT pouvoir consulter les informations de leurs élèves et inscriptions en lecture seule
- **FR-026**: Les utilisateurs family DOIVENT pouvoir effectuer des paiements Stripe en ligne
- **FR-027**: Les utilisateurs family NE DOIVENT PAS pouvoir modifier les informations des élèves ou le statut des inscriptions
- **FR-028**: L'accès DOIT être restreint à la famille liée à l'utilisateur

**Configuration**
- **FR-029**: Le système DOIT fournir une entité Config permettant de stocker des paramètres clé/valeur typés (texte, nombre, booléen)
- **FR-030**: Le système DOIT supporter la promotion automatique des élèves vers le niveau suivant lors du changement de période (opt-in via Config). Le niveau suivant est déterminé par la relation "nextLevel" définie sur chaque Level. La promotion est déclenchée manuellement par l'admin sur une période cible, en batch pour tous les élèves inscrits. Les inscriptions créées par promotion ont le statut PENDING et DOIVENT être validées par l'admin. Si le nextLevel est désactivé, la chaîne cherche le prochain Level actif ; s'il n'existe pas, l'élève est traité comme en niveau terminal
- **FR-030b**: L'admin DOIT pouvoir définir la chaîne de promotion en liant chaque Level à son Level suivant (relation optionnelle). Un Level sans nextLevel est un niveau terminal (pas de promotion)

**Authentification & Autorisation**
- **FR-031**: Le système NE DOIT PAS permettre l'auto-inscription des utilisateurs
- **FR-032**: Les utilisateurs DOIVENT pouvoir se connecter via OAuth. Les fournisseurs (Google, etc.) sont configurables via Better Auth au niveau du déploiement
- **FR-033**: Les comptes utilisateurs DOIVENT être créés par un administrateur avec un rôle assigné : admin ou family (mutuellement exclusifs, un utilisateur a exactement un rôle)
- **FR-033b**: Toutes les server actions de mutation DOIVENT requérir le rôle admin, sauf les actions du portail famille (US5) qui requièrent le rôle family
- **FR-033c**: Les server actions de lecture (list, get) DOIVENT filtrer les données selon le rôle : admin voit toutes les familles, family voit uniquement sa famille liée
- **FR-033d**: La session utilisateur DOIT être invalidée lorsque le compte est désactivé (isActive = false). La gestion des sessions est déléguée à Better Auth

**Transversal**
- **FR-034**: Toutes les entités DOIVENT inclure les champs isActive, createdAt, updatedAt
- **FR-035**: Toutes les mutations de données DOIVENT être validées côté serveur avec Zod. Les champs Json (roles, channels, languagesAtHome) DOIVENT avoir un schéma de validation explicite (ex: roles = tableau de "admin" | "family", channels = tableau de "sms" | "whatsapp" | "call")
- **FR-036**: Toutes les interfaces DOIVENT être utilisables sur un écran de 375px sans scroll horizontal
- **FR-037**: Tous les montants financiers DOIVENT utiliser le type Decimal avec une précision de 2 décimales et un arrondi HALF_UP
- **FR-038**: Les codes d'erreur retournés par les server actions DOIVENT avoir des clés de traduction i18n correspondantes dans messages/fr.json et messages/en.json

### Key Entities

- **User**: Compte utilisateur avec rôle unique (admin ou family, mutuellement exclusifs). Lié à une ou plusieurs familles. Pas d'auto-inscription, connexion OAuth configurable via Better Auth.
- **Family**: Regroupement familial. Contient un nom, un contact d'urgence et un pickup autorisé. Créé par un User. Liée à des Person via des relations typées.
- **Person**: Personne physique (nom, prénom, sexe, email, adresse). Peut avoir des numéros de téléphone et des configs.
- **Student**: Hérite de Person. Ajoute date/lieu de naissance, école précédente, notes de santé, langues, autorisation goûter, allergies. Appartient à une famille.
- **PhoneNumber**: Numéro de téléphone avec canaux de communication (SMS, WhatsApp, appel). Rattaché à une Person.
- **Config**: Paramètre clé/valeur typé (texte, nombre, booléen). Peut être rattaché à une Person ou utilisé globalement.
- **Level**: Niveau scolaire avec un nom libre (CP, CE1, Level 1…). Possède une relation optionnelle "nextLevel" vers un autre Level pour définir la chaîne de promotion.
- **Period**: Période scolaire avec nom, date de début et de fin. Configurable par déploiement.
- **ClassPeriod**: Classe pour une période donnée. Rattachée à un Level et une Period. A un nom et une capacité maximale.
- **Enrollment**: Inscription d'un élève pour une période. Statut (pending/active/completed/cancelled), montant total (snapshot du plan au moment de la création), réduction, date d'inscription, canLeaveAlone. Liée à un Plan. Peut être affectée à plusieurs ClassPeriod successivement via ClassAssignment.
- **ClassAssignment**: Affectation temporelle d'une inscription à une classe périodique. Contient startAt (date de début) et endAt (date de fin, null si affectation courante). Permet la réorientation, promotion ou régression en cours de période. Clôturée automatiquement lors de l'annulation de l'inscription.
- **Payment**: Paiement enregistré sur une famille. Montant (Decimal, 2 décimales, peut être négatif pour remboursement), méthode (cash/card/transfer/check/stripe), référence, date de paiement, date d'encaissement. Lié à une inscription.
- **Plan**: Plan tarifaire avec nom et montant. Associable à des inscriptions. Le montant est copié (snapshot) dans l'inscription au moment de la création.

### Assumptions

- La répartition des paiements se fait au prorata du solde restant (algorithme détaillé dans FR-022), avec arrondi HALF_UP à 2 décimales
- Les remboursements sont gérés comme des paiements négatifs avec distribution inverse (FR-022b)
- L'héritage Student/Person est implémenté via tables séparées avec relation 1:1 (Person ← Student, FK @unique)
- La promotion automatique crée des inscriptions "pending" que l'admin doit valider (batch, déclenché manuellement)
- Les méthodes de paiement sont un ensemble fixe : cash, card, transfer, check, stripe
- Les statuts d'inscription sont un ensemble fixe : pending, active, completed, cancelled
- La relation entre Person et Family est typée (parent, tutor, grandparent, sibling, other)
- Un utilisateur a exactement un rôle (admin ou family), pas de cumul
- L'admin voit toutes les familles. Le family voit uniquement sa famille liée
- Le montant total de l'inscription est un snapshot du plan (non affecté par modification ultérieure du plan)
- La vérification de capacité est transactionnelle pour éviter les race conditions
- Déploiement mono-école : une instance = une base de données = une école. Le multi-tenant est géré par instances séparées

### Out of Scope (MVP)

Les éléments suivants sont explicitement hors du périmètre du MVP et pourront être adressés ultérieurement :

- **Pagination, tri et filtrage** des listes : les listes retournent toutes les entités actives sans pagination. Sera ajouté quand le volume de données le nécessite
- **Opérations en masse** (bulk enrollment, bulk payment) : hors scope, les opérations sont unitaires sauf la promotion automatique (FR-030)
- **Audit logging** : pas de journalisation des opérations sensibles dans le MVP. Les timestamps createdAt/updatedAt fournissent une traçabilité minimale
- **Classification des données / chiffrement au repos** : les données sensibles (healthNotes, allergies) sont stockées en clair. Le chiffrement est délégué à la couche infrastructure (PostgreSQL TDE ou disque chiffré)
- **Conformité GDPR spécifique** : le soft-delete conserve les données. Un mécanisme de purge (hard-delete) pourra être ajouté pour le droit à l'effacement si requis par la réglementation applicable
- **Politique de rétention des données** : pas de purge automatique des enregistrements soft-deleted
- **Rate-limiting** : pas de limitation de débit sur les server actions dans le MVP. Next.js fournit une protection CSRF native sur les server actions

## Clarifications

### Session 2026-03-05

- Q: Un admin peut-il annuler une inscription ? Depuis quels statuts ? → A: Oui, annulation possible depuis pending ou active → statut "cancelled" ajouté
- Q: Comment le système détermine-t-il le niveau suivant pour la promotion automatique ? → A: Relation explicite "nextLevel" entre deux Level (chaînage). Un Level sans nextLevel est terminal
- Q: Un élève peut-il changer de classe en cours de période ? → A: Oui, via ClassAssignment (entité intermédiaire avec startAt/endAt). Permet réorientation, promotion et régression en cours de période

### Session 2026-03-06

- Q: Quelles entités utilisent le soft-delete ? → A: Toutes les entités (FR-007 aligné avec FR-034). Le champ isActive est filtré automatiquement via Prisma Client Extension
- Q: Comment la capacité d'une classe est-elle calculée ? → A: Comptage des inscriptions non-annulées (PENDING+ACTIVE+COMPLETED) ayant une affectation courante (endAt = null) dans la classe
- Q: Que se passe-t-il aux ClassAssignments lors d'une annulation ? → A: L'affectation courante est clôturée automatiquement (FR-015d)
- Q: Les rôles admin et family sont-ils cumulables ? → A: Non, mutuellement exclusifs (FR-033)
- Q: Quel est le scope admin vs family ? → A: Admin voit tout, family voit uniquement sa famille (FR-033b/c)
- Q: Quelle précision pour les montants financiers ? → A: Decimal, 2 décimales, arrondi HALF_UP (FR-037)
- Q: Que se passe-t-il si on modifie le montant d'un Plan après des inscriptions ? → A: Le totalAmount est un snapshot, les inscriptions existantes ne sont pas affectées (FR-019)
- Q: OAuth : quels fournisseurs ? → A: Configurables via Better Auth au niveau du déploiement (FR-032)
- Q: Les Json fields sont-ils validés ? → A: Oui, schéma Zod explicite pour roles, channels, languagesAtHome (FR-035)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrateur peut créer une famille, y ajouter un élève et l'inscrire dans une classe en moins de 5 minutes
- **SC-002**: La fiche famille affiche le solde total dû, payé et restant avec une précision de 2 décimales (type Decimal, arrondi HALF_UP). Les données reflètent le dernier état persisté (pas de cache applicatif)
- **SC-003**: 100% des transitions d'inscription respectent la machine à états (aucun saut de statut possible)
- **SC-004**: *(Deferred — US5)* Un utilisateur family peut consulter les informations de ses enfants et initier un paiement en moins de 3 clics depuis la page d'accueil
- **SC-005**: L'application est entièrement utilisable sur un écran de 375px de large sans scroll horizontal
- **SC-006**: Le système supporte des déploiements avec des périodes scolaires différentes (sept-août, oct-sept) sans modification de code
- **SC-007**: Aucune donnée sensible (élève, famille, inscription) ne peut être supprimée définitivement — seul le soft-delete est disponible
- **SC-008**: Un paiement par chèque avec date d'encaissement future apparaît comme "à encaisser" jusqu'à la date effective
