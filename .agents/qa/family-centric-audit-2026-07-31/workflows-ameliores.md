# Workflows améliorés — famille comme point d’entrée

Date de validation : 31 juillet 2026

## Principe produit

La famille est désormais l’unique espace de création et d’opération. Les listes globales Élèves,
Inscriptions et Encaissements servent à rechercher, suivre et contrôler, sans créer de données.

## Administration

```mermaid
flowchart TD
  A["Tableau de bord administrateur"] --> B["Créer une famille"]
  B --> C["Fiche famille"]
  D["Liste des familles"] --> C
  C --> E["Ajouter un parent ou tuteur"]
  C --> F["Ajouter un élève"]
  C --> G["Inscrire un élève"]
  C --> H["Enregistrer un règlement"]
  E --> I["Inviter le responsable au portail"]
  F --> G
  G --> J["Affecter une classe et gérer le statut"]
  H --> K["Solde et historique de la famille"]
  L["Listes globales"] --> M["Recherche, suivi et reporting"]
```

Résultat :

- le tableau de bord ne propose plus que « Nouvelle famille » ;
- le formulaire de famille crée d’abord le foyer, puis oriente vers sa fiche ;
- l’élève ne peut être créé que depuis une famille déjà connue ;
- l’encaissement manuel reçoit une famille préselectionnée ;
- les actions administratives ne sont pas rendues dans le portail parent.

## Invitation d’un parent

```mermaid
sequenceDiagram
  actor Admin
  participant Famille as "Fiche famille"
  participant Invitation
  actor Parent
  participant Compte

  Admin->>Famille: Ajouter un responsable avec son email
  Admin->>Invitation: Inviter au portail
  Invitation->>Invitation: Vérifier personne, email et famille
  Invitation-->>Parent: Envoyer le lien d’invitation
  Parent->>Compte: Créer son compte
  Compte->>Compte: Attribuer le rôle Parent
  Compte->>Compte: Créer le lien UserFamily
  Compte->>Invitation: Marquer l’invitation utilisée
  Compte-->>Parent: Ouvrir son portail familial
```

## Portail parent et paiement

```mermaid
flowchart TD
  A["Connexion parent"] --> B["Accueil"]
  B --> C["Ma famille"]
  C --> D["Mes enfants et inscriptions"]
  C --> E["Solde de la période"]
  E --> F{"Solde restant ?"}
  F -- "Non" --> G["Famille à jour"]
  F -- "Oui" --> H{"Stripe configuré ?"}
  H -- "Non" --> I["Bouton désactivé et message explicite"]
  H -- "Oui" --> J["Créer une session Checkout côté serveur"]
  J --> K["Paiement hébergé par Stripe"]
  K --> L["Webhook Stripe signé"]
  L --> M{"Événement valide et inédit ?"}
  M -- "Non" --> N["Rejeter ou ignorer sans double paiement"]
  M -- "Oui" --> O["Répartir le règlement sur les inscriptions"]
  O --> P["Mettre à jour le solde familial"]
  P --> C
```

Garanties :

- la famille vient de la session parent, jamais du navigateur ;
- le montant est recalculé côté serveur à partir des inscriptions ;
- le retour navigateur ne valide aucun paiement ;
- seul le webhook signé finalise la transaction ;
- l’identifiant d’événement empêche une double comptabilisation ;
- « Enregistrer un règlement » et « Payer en ligne » restent deux opérations distinctes.

## Navigation finale

| Administrateur | Parent |
|---|---|
| Tableau de bord | Tableau de bord |
| Familles | Ma famille |
| Élèves, consultation | Profil |
| Inscriptions, consultation et suivi |  |
| Encaissements, registre |  |
| Configuration |  |

## Validation locale

- connexions administrateur et parent validées dans le navigateur sur `pnpm dev` ;
- absence de création sur les listes globales validée ;
- actions regroupées dans la fiche famille validées ;
- navigation parent réduite et accès direct à la famille validés ;
- état soldé et état avec solde de 1 180 € validés selon la période ;
- bouton de paiement et état « Stripe non configuré » validés ;
- webhook sans signature rejeté avec le statut HTTP 400 ;
- génération Prisma, lint, typage, 385 tests, Knip et build Next.js validés.

