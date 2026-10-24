-- Devise et fuseau par école. Les valeurs par défaut reproduisent le comportement actuel
-- (euro, heure de Paris) : aucune école existante ne voit de changement au déploiement.
ALTER TABLE "School" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR';

ALTER TABLE "School" ADD COLUMN "timeZone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Paris';

ALTER TABLE "School" ADD CONSTRAINT "School_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
