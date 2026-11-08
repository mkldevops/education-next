# Research: Core Data Model

**Feature**: 001-core-data-model
**Date**: 2026-03-05

## 1. Héritage Person/Student en Prisma

**Decision**: Tables séparées avec relation 1:1 (Person ← Student)

**Rationale**: Prisma n'a pas de STI natif. Des tables séparées offrent un typage fort, des requêtes indépendantes par type, et une meilleure séparation des domaines. Student a une relation `@unique` vers Person.

**Alternatives rejetées**:

- Table unique avec discriminateur : perte de type safety, tous les champs optionnels
- Relations polymorphiques : complexité inutile pour un seul sous-type

## 2. Soft-Delete

**Decision**: Prisma Client Extension (`$extends`) filtrant automatiquement `isActive: true`

**Rationale**: Les extensions Prisma 6 interceptent les requêtes au niveau client de manière transparente. Plus propre que le middleware `$use` (pattern legacy). Le code métier n'a pas besoin de filtrer manuellement.

**Alternatives rejetées**:

- `where: { isActive: true }` manuel partout : violation DRY, risque d'oubli
- Middleware `$use` : ancien pattern, extensions préférées en Prisma 6

## 3. Machine à états Enrollment

**Decision**: Validation dans l'entité Domain (DDD pattern)

**Rationale**: Conforme à la Clean Architecture du projet. Les transitions sont validées dans `src/domain/enrollment.ts` avec le Result type pattern (`'OK'` | error code). Testable unitairement sans base de données.

**Transitions autorisées**:

```
pending → active
pending → cancelled
active → completed
active → cancelled
```

**Alternatives rejetées**:

- Middleware Prisma : logique dispersée, difficile à tester
- Bibliothèque externe (xstate) : over-engineering pour 4 états

## 4. Distribution des paiements

**Decision**: Calcul proportionnel dans le gateway avec transaction Prisma `$transaction`

**Rationale**: La distribution se fait au prorata du solde restant de chaque inscription active. L'atomicité est garantie par `$transaction`. Le type `Decimal` natif de Prisma 6 assure la précision financière.

**Algorithme**:

1. Charger les inscriptions actives (status = ACTIVE) avec solde > 0
2. Calculer le total restant dû
3. Pour chaque inscription : `part = (solde_inscription / total_restant) * montant_paiement`
4. Appliquer arrondi HALF_UP à 2 décimales sur chaque part
5. Plafonner à `solde_inscription` pour éviter le sur-paiement
6. Attribuer le dernier centime de différence (somme des parts vs montant_paiement) à la première inscription
7. Appliquer dans une transaction atomique (isolation par défaut PostgreSQL = READ COMMITTED, suffisant car $transaction sérialise les écritures)

**Remboursements (montant négatif)** :

- Même algorithme inversé : charger les inscriptions actives ayant des paiements > 0
- Distribution proportionnelle du montant négatif
- Empêcher que le total payé d'une inscription devienne négatif (erreur `refundExceedsPaid`)

**Alternatives rejetées**:

- Distribution égale : injuste si les montants diffèrent
- Ordre FIFO (première inscription d'abord) : ne correspond pas au besoin "répartition équitable"

## 5. Relation auto-référentielle Level.nextLevel

**Decision**: Foreign key nullable `nextLevelId` sur Level pointant vers Level

**Rationale**: Pattern simple et natif Prisma. `nextLevelId = null` indique un niveau terminal (fin de cursus). Navigation type-safe avec `level.nextLevel?.name`.

**Schema Prisma**:

```prisma
model Level {
  id          String  @id @default(uuid())
  name        String
  nextLevelId String? @unique
  nextLevel   Level?  @relation("levelProgression", fields: [nextLevelId], references: [id])
  previousLevel Level? @relation("levelProgression")
}
```

**Alternatives rejetées**:

- Champ `order` (entier) : ne définit pas explicitement la chaîne de succession
- Table de mapping séparée : over-engineering pour une relation 1:1
