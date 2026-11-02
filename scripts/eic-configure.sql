-- Configuration idempotente du calendrier, du fuseau et de l'activation des repas d'une école EIC.
--
--   psql -X -v ON_ERROR_STOP=1 -v school=<slug> [-v category=CLOSURE] [-v apply=1] -f scripts/eic-configure.sql
--
-- Sans `apply`, tout est annulé en fin de script : la sortie vaut aperçu.
-- `category` (CLOSURE par défaut, l'école étant fermée) : CLOSURE suspend repas et appels, HOLIDAY les repas seuls.
-- Fermetures en visibilité MEMBERS : les familles organisent leur semaine autour, sans publication publique.
-- La devise n'est jamais écrite : les montants sont stockés sans devise et jamais convertis.
-- Une école qui n'est pas en KMF est refusée ; la devise se règle dans l'application, qui la verrouille
-- dès qu'un paiement actif ou un reçu non annulé existe (`setSchoolCurrency`).
-- Ne touche ni aux prix, ni aux périodes, ni aux jours autorisés : ils sont affichés pour contrôle.

\set ON_ERROR_STOP on
\if :{?school}
\else
  \echo 'Variable school requise'
  \quit 3
\endif
\if :{?category}
\else
  \set category CLOSURE
\endif

BEGIN;

CREATE TEMP TABLE target ON COMMIT DROP AS
SELECT id FROM "School" WHERE slug = :'school' AND "isActive";

DO $$
BEGIN
  IF (SELECT count(*) FROM target) <> 1 THEN
    RAISE EXCEPTION 'École introuvable ou inactive';
  END IF;
END $$;

DO $$
DECLARE
  current_currency text;
  recorded boolean;
BEGIN
  SELECT s.currency INTO current_currency FROM "School" s JOIN target t ON t.id = s.id;
  IF current_currency = 'KMF' THEN
    RETURN;
  END IF;
  SELECT EXISTS (SELECT 1 FROM "Payment" p JOIN target t ON t.id = p."schoolId" WHERE p."isActive")
      OR EXISTS (SELECT 1 FROM "Receipt" r JOIN target t ON t.id = r."schoolId" WHERE r."cancelledAt" IS NULL)
    INTO recorded;
  IF recorded THEN
    RAISE EXCEPTION 'Devise % avec des montants enregistrés : conversion refusée', current_currency;
  END IF;
  RAISE EXCEPTION 'Devise % au lieu de KMF : à régler dans l''application avant ce script', current_currency;
END $$;

CREATE TEMP TABLE closure (slug text, title text, start_on date, end_on date) ON COMMIT DROP;
INSERT INTO closure VALUES
  ('eic-vacances-2026-10-03', 'Vacances EIC — 3 au 6 octobre 2026', '2026-10-03', '2026-10-06'),
  ('eic-vacances-2026-11-04', 'Vacances EIC — 4 au 8 novembre 2026', '2026-11-04', '2026-11-08'),
  ('eic-ferie-2026-11-12', 'Jour férié EIC — 12 novembre 2026', '2026-11-12', '2026-11-12'),
  ('eic-vacances-2026-12-30', 'Vacances EIC — 30 décembre 2026 au 3 janvier 2027', '2026-12-30', '2027-01-03'),
  ('eic-vacances-2027-02-03', 'Vacances EIC — 3 au 7 février 2027', '2027-02-03', '2027-02-07'),
  ('eic-vacances-2027-03-06', 'Vacances EIC — 6 au 14 mars 2027', '2027-03-06', '2027-03-14'),
  ('eic-vacances-2027-04-10', 'Vacances EIC — 10 au 13 avril 2027', '2027-04-10', '2027-04-13'),
  ('eic-ferie-2027-05-01', 'Jour férié EIC — 1 mai 2027', '2027-05-01', '2027-05-01'),
  ('eic-ferie-2027-05-16', 'Jour férié EIC — 16 mai 2027', '2027-05-16', '2027-05-16');

CREATE TEMP TABLE closure_event ON COMMIT DROP AS
SELECT e.* FROM "Event" e JOIN target t ON t.id = e."schoolId"
WHERE e."isActive" AND e.category IN ('CLOSURE', 'HOLIDAY') AND e.status <> 'CANCELLED';

DO $$
DECLARE conflicts int;
BEGIN
  SELECT count(*) INTO conflicts
  FROM closure c JOIN closure_event e
    ON e."startAt"::date <= c.end_on AND coalesce(e."endAt", e."startAt")::date >= c.start_on
  WHERE e.status <> 'PUBLISHED'
     OR e."startAt"::date <> c.start_on
     OR coalesce(e."endAt", e."startAt")::date <> c.end_on;
  IF conflicts > 0 THEN
    RAISE EXCEPTION 'Événements en conflit avec le calendrier (dates ou statut) : %', conflicts;
  END IF;
END $$;

UPDATE "School" s SET "timeZone" = 'Indian/Comoro', "updatedAt" = now()
FROM target t
WHERE s.id = t.id AND s."timeZone" <> 'Indian/Comoro';

UPDATE "Config" c SET value = 'true', "updatedAt" = now()
FROM target t
WHERE c."schoolId" = t.id AND c.name = 'meals_enabled' AND c."isActive" AND c.value <> 'true';

INSERT INTO "Config" (id, "schoolId", name, value, "valueType", "updatedAt")
SELECT gen_random_uuid()::text, t.id, 'meals_enabled', 'true', 'BOOLEAN', now()
FROM target t
WHERE NOT EXISTS (
  SELECT 1 FROM "Config" c WHERE c."schoolId" = t.id AND c.name = 'meals_enabled' AND c."isActive"
);

UPDATE "Event" e SET category = :'category'::"EventCategory", "updatedAt" = now()
FROM closure c, target t
WHERE e."schoolId" = t.id AND e."isActive" AND e.status = 'PUBLISHED'
  AND e.category IN ('CLOSURE', 'HOLIDAY')
  AND e.category <> :'category'::"EventCategory"
  AND e."startAt"::date = c.start_on
  AND coalesce(e."endAt", e."startAt")::date = c.end_on;

INSERT INTO "Event" (id, "schoolId", title, slug, category, visibility, status, "allDay", "startAt", "endAt", "updatedAt")
SELECT gen_random_uuid()::text, t.id, c.title, c.slug, :'category'::"EventCategory", 'MEMBERS', 'PUBLISHED', true,
  c.start_on::timestamp, CASE WHEN c.end_on = c.start_on THEN NULL ELSE c.end_on::timestamp END, now()
FROM closure c CROSS JOIN target t
WHERE NOT EXISTS (
  SELECT 1 FROM closure_event e
  WHERE e."startAt"::date = c.start_on AND coalesce(e."endAt", e."startAt")::date = c.end_on
);

\echo '--- école'
SELECT s.slug, s.currency, s."timeZone" FROM "School" s JOIN target t ON t.id = s.id;
\echo '--- drapeaux (payments_enabled absent = activé)'
SELECT c.name, c.value FROM "Config" c JOIN target t ON t.id = c."schoolId"
WHERE c."isActive" AND c.name IN ('meals_enabled', 'payments_enabled', 'attendance_enabled', 'events_enabled')
ORDER BY 1;
\echo '--- périodes actives'
SELECT p.name, p."startAt"::date, p."endAt"::date FROM "Period" p JOIN target t ON t.id = p."schoolId"
WHERE p."isActive" ORDER BY 2 DESC;
\echo '--- services et prix'
SELECT m.service, m."isEnabled", m."allowedWeekdays" FROM "MealServiceSetting" m JOIN target t ON t.id = m."schoolId"
ORDER BY 1;
SELECT p.service, p.amount, p."effectiveFrom" FROM "MealPrice" p JOIN target t ON t.id = p."schoolId" ORDER BY 1, 3;
\echo '--- fermetures'
SELECT e.title, e.category, e."startAt"::date AS debut, coalesce(e."endAt", e."startAt")::date AS fin
FROM "Event" e JOIN target t ON t.id = e."schoolId"
JOIN closure c ON c.start_on = e."startAt"::date AND c.end_on = coalesce(e."endAt", e."startAt")::date
WHERE e."isActive" AND e.status = 'PUBLISHED' AND e.category IN ('CLOSURE', 'HOLIDAY')
ORDER BY 3;

\if :{?apply}
  COMMIT;
  \echo 'APPLIQUÉ'
\else
  ROLLBACK;
  \echo 'APERÇU : rien écrit'
\endif
