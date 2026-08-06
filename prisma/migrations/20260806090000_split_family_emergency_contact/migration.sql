-- AlterTable
ALTER TABLE "Family"
ADD COLUMN "emergencyContactName" VARCHAR(250),
ADD COLUMN "emergencyContactPhone" VARCHAR(20);

-- Backfill "emergencyContact" into the structured columns.
-- Ambiguous values are kept whole in "emergencyContactName" rather than split badly.
WITH parsed AS (
    SELECT
        "id",
        btrim("emergencyContact") AS raw,
        regexp_match(
            btrim("emergencyContact"),
            '^(.*[^[:space:]|,:-])[[:space:]]*[|,:-][[:space:]]*(\+?[0-9][0-9 .()-]*)$'
        ) AS separator_match,
        regexp_match(
            btrim("emergencyContact"),
            '^(.*[^[:space:][:digit:]])[[:space:]]+(\+?[0-9][0-9 .()-]*)$'
        ) AS whitespace_match
    FROM "Family"
    WHERE "emergencyContact" IS NOT NULL
      AND btrim("emergencyContact") <> ''
),
resolved AS (
    SELECT
        "id",
        raw ~ '^\+?[0-9][0-9 .()-]*$'
            AND length(raw) <= 20
            AND length(regexp_replace(raw, '[^0-9]', '', 'g')) >= 6 AS is_phone_only,
        separator_match IS NOT NULL
            AND length(separator_match[2]) <= 20
            AND length(regexp_replace(separator_match[2], '[^0-9]', '', 'g')) >= 6 AS has_separator,
        whitespace_match IS NOT NULL
            AND length(whitespace_match[2]) <= 20
            AND length(regexp_replace(whitespace_match[2], '[^0-9]', '', 'g')) >= 6 AS has_whitespace,
        raw,
        separator_match,
        whitespace_match
    FROM parsed
)
UPDATE "Family" f
SET
    "emergencyContactName" = CASE
        WHEN r.is_phone_only THEN NULL
        WHEN r.has_separator THEN NULLIF(
            regexp_replace(btrim(r.separator_match[1]), '[[:space:]|,:-]+$', ''), ''
        )
        WHEN r.has_whitespace THEN NULLIF(
            regexp_replace(btrim(r.whitespace_match[1]), '[[:space:]|,:-]+$', ''), ''
        )
        ELSE r.raw
    END,
    "emergencyContactPhone" = CASE
        WHEN r.is_phone_only THEN r.raw
        WHEN r.has_separator THEN r.separator_match[2]
        WHEN r.has_whitespace THEN r.whitespace_match[2]
        ELSE NULL
    END
FROM resolved r
WHERE f."id" = r."id";

-- AlterTable
ALTER TABLE "Family"
DROP COLUMN "emergencyContact";
