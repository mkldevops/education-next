# Catalogue de scénarios QA

Référentiel de parcours à rejouer à chaque campagne QA.
Chaque run est consigné dans `.agents/qa/runs/<date>.md` avec le statut par scénario.

Comptes seed : `admin@school.test/admin123` (ADMIN), `parent@school.test/parent123` (PARENT, famille Dupont).
App : `http://localhost:8550` (PORT fixé par `.env`). Mailpit : `http://localhost:8553`.

## Statuts

- `PASS` — parcours conforme à l'attendu
- `FAIL` — défaut bloquant ou incohérence avérée
- `WARN` — friction UX/UI non bloquante
- `SKIP` — non exécuté ce run (préciser pourquoi)

## AUTH — Authentification

| ID      | Parcours                              | Attendu                                                           |
| ------- | ------------------------------------- | ----------------------------------------------------------------- |
| AUTH-01 | Login admin (`/fr/login`) puis logout | Redirection dashboard, session active, logout renvoie au login    |
| AUTH-02 | Login parent                          | Accès portail restreint à la famille Dupont                       |
| AUTH-03 | Login avec mauvais mot de passe       | Message d'erreur localisé, pas de fuite technique, champ conservé |
| AUTH-04 | Mot de passe oublié                   | Email reçu dans Mailpit, lien de reset fonctionnel                |

## ADM — Parcours administrateur

| ID     | Parcours                                                     | Attendu                                                                                                     |
| ------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| ADM-01 | Dashboard : KPIs vs listes                                   | Compteurs (familles, élèves, inscriptions, paiements) cohérents avec les pages de liste                     |
| ADM-02 | Créer une famille puis lui ajouter un membre depuis sa fiche | Famille visible en liste et en détail ; membre avec contact complet affiché dans « Parents & Tuteurs »      |
| ADM-03 | Créer un élève puis l'inscrire à une classe                  | Élève rattaché à la famille, inscription visible côté famille et côté classe                                |
| ADM-04 | Enregistrer un paiement sur une inscription                  | Solde restant recalculé juste (net - payé), badge statut à jour                                             |
| ADM-07 | Activer une inscription En attente puis encaisser            | Avant activation le bouton d'encaissement est désactivé avec le motif ; après activation le règlement passe |
| ADM-05 | Configurer niveaux / périodes / classes                      | CRUD complet, libellés traduits, pas d'accès sans rôle admin                                                |
| ADM-06 | Recherche globale                                            | Résultats pertinents familles/élèves, navigation vers le détail                                             |

## PAY — Encaissements

| ID     | Parcours                                          | Attendu                                                                                                 |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| PAY-01 | Dialog de règlement : montant, méthode, référence | Solde encaissable rappelé, « Payer le solde » pré-remplit, placeholder de référence adapté à la méthode |
| PAY-02 | Date d'encaissement selon la méthode              | Champ visible pour Chèque uniquement ; refusé côté serveur pour les autres méthodes                     |
| PAY-03 | Montant supérieur au solde encaissable            | Message explicite « dépasse le solde des inscriptions actives », dialog conservé, rien en base          |
| PAY-04 | Bouton Payer depuis la fiche élève                | Mène à la famille, onglet Paiements actif, dialog ouvert                                                |
| PAY-05 | Historique des paiements d'une famille            | Total et compteur justes ; « En attente » d'encaissement réservé aux chèques                            |

## PAR — Portail parent

| ID     | Parcours                                            | Attendu                                                                |
| ------ | --------------------------------------------------- | ---------------------------------------------------------------------- |
| PAR-01 | Navigation parent : familles/élèves visibles        | Uniquement la famille Dupont et ses élèves, navigation adaptée au rôle |
| PAR-02 | Paiements et solde côté parent                      | Montants identiques à la vue admin de la même famille                  |
| PAR-03 | URL directe vers une ressource d'une autre famille  | `notFound()` (404), aucune donnée divulguée                            |
| PAR-04 | Accès pages admin (plans, settings école) en parent | Refus propre (404), pas d'écran cassé                                  |

## I18N / UI — Localisation et interface

| ID      | Parcours                                             | Attendu                                                                          |
| ------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| I18N-01 | Switch fr ↔ en sur dashboard, formulaires, tables    | Aucune clé brute, placeholders et enums traduits, montants formatés selon locale |
| UI-01   | Navigation clavier sur les tables riches             | Lignes cliquables focusables (Tab), activables Enter/Espace                      |
| UI-02   | Responsive mobile (375px) : dashboard, listes, menus | Pas d'overflow horizontal, menus d'action utilisables                            |
| UI-03   | États vides et erreurs                               | Pages sans données affichent un état vide propre, pas de crash                   |
