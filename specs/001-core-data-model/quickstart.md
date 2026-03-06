# Quickstart: Core Data Model

## Prérequis

```bash
pnpm db:start       # Démarre PostgreSQL + Mailpit
```

## Setup

```bash
# 1. Appliquer le schema Prisma
pnpm db:push

# 2. Générer le client Prisma
pnpm db:generate

# 3. Vérifier le type-check
pnpm type-check

# 4. Lancer les tests
pnpm test
```

## Vérification

### Schema Prisma

Vérifier que toutes les entités existent :

```bash
pnpm db:studio
```

Entités attendues : User, UserFamily, Family, FamilyPerson, Person, Student, PhoneNumber, Config, Level, Period, ClassPeriod, Enrollment, ClassAssignment, Payment, Plan

### Domain entities

Vérifier que les règles métier fonctionnent :

```bash
pnpm test -- --grep "enrollment"
pnpm test -- --grep "payment"
```

### Scénario de validation manuelle

1. Créer une famille "Dupont"
2. Ajouter une personne "Jean Dupont" (parent)
3. Créer un élève "Marie Dupont" rattaché à la famille
4. Créer une période "2026-2027" (sept 2026 → août 2027)
5. Créer un niveau "CP"
6. Créer une classe "CP-A" (capacité: 25) rattachée au niveau CP et à la période
7. Créer un plan "Inscription annuelle" (montant: 500€)
8. Inscrire Marie dans CP-A avec le plan → statut PENDING
9. Activer l'inscription → statut ACTIVE
10. Enregistrer un paiement de 250€ en espèces sur la famille Dupont
11. Vérifier que le solde restant = 250€

## Structure des fichiers créés

```
prisma/schema.prisma              # 13 entités + 5 enums
src/domain/enrollment.ts          # Machine à états
src/domain/payment.ts             # Distribution des paiements
src/domain/period.ts              # Validation chevauchement
src/domain/level.ts               # Chaîne de promotion
src/gateways/*-gateway.ts         # Accès base de données
src/use-cases/*/                  # Logique métier
src/lib/db.ts                     # Client Prisma + soft-delete extension
```
