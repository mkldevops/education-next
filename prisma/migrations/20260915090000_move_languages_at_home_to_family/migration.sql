-- AlterTable
ALTER TABLE "Family" ADD COLUMN "languagesAtHome" JSONB NOT NULL DEFAULT '[]';

-- Backfill: a family inherits the distinct languages declared on its children.
UPDATE "Family" AS f
SET "languagesAtHome" = l.languages
FROM (
  SELECT fp."familyId", jsonb_agg(DISTINCT btrim(lang.value) ORDER BY btrim(lang.value)) AS languages
  FROM "FamilyPerson" AS fp
  JOIN "Student" AS s ON s."personId" = fp."personId" AND s."schoolId" = fp."schoolId"
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(s."languagesAtHome") = 'array' THEN s."languagesAtHome" ELSE '[]'::jsonb END
  ) AS lang(value)
  WHERE btrim(lang.value) <> ''
  GROUP BY fp."familyId"
) AS l
WHERE f.id = l."familyId";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "languagesAtHome";
