-- This migration carries data and is NOT idempotent: it must run exactly once,
-- before any schema sync. Fail loudly rather than silently no-op when the source
-- column is already gone, so a half-applied state is visible. See README.md.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Family'
          AND column_name = 'emergencyContact'
    ) THEN
        RAISE EXCEPTION
            'Family."emergencyContact" is already missing: this migration carries data and must run exactly once, before any schema sync. Applying it now would silently lose every emergency contact. See README.md in this migration directory.';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Family"
ADD COLUMN "emergencyContactName" VARCHAR(250),
ADD COLUMN "emergencyContactPhone" VARCHAR(20);

-- Backfill "emergencyContact" into the structured columns.
-- Ambiguous values are kept whole in "emergencyContactName" rather than split badly.
-- A candidate name must contain a letter, so a value holding only numbers
-- ("0611223344 / 0698765432") falls through whole instead of filing one number as a name.
WITH parsed AS (
    SELECT
        "id",
        btrim("emergencyContact") AS raw,
        regexp_match(
            btrim("emergencyContact"),
            '^(.*[^[:space:]|,:;/-])[[:space:]]*[|,:;/-][[:space:]]*(\+?[0-9][0-9 .()-]*)$'
        ) AS separator_match,
        regexp_match(
            btrim("emergencyContact"),
            '^(.*[^[:space:][:digit:]])[[:space:]]+(\+?[0-9][0-9 .()-]*)$'
        ) AS whitespace_match,
        regexp_match(
            btrim("emergencyContact"),
            '^(\+?[0-9][0-9 .()-]*[0-9])[[:space:]]*[|,:;/-]?[[:space:]]*(.*[^[:space:]])$'
        ) AS leading_match
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
            AND separator_match[1] ~ '[[:alpha:]]'
            AND length(separator_match[2]) <= 20
            AND length(regexp_replace(separator_match[2], '[^0-9]', '', 'g')) >= 6 AS has_separator,
        whitespace_match IS NOT NULL
            AND whitespace_match[1] ~ '[[:alpha:]]'
            AND length(whitespace_match[2]) <= 20
            AND length(regexp_replace(whitespace_match[2], '[^0-9]', '', 'g')) >= 6 AS has_whitespace,
        leading_match IS NOT NULL
            AND leading_match[2] ~ '[[:alpha:]]'
            AND length(leading_match[1]) <= 20
            AND length(regexp_replace(leading_match[1], '[^0-9]', '', 'g')) >= 6 AS has_leading,
        raw,
        separator_match,
        whitespace_match,
        leading_match
    FROM parsed
)
UPDATE "Family" f
SET
    "emergencyContactName" = CASE
        WHEN r.is_phone_only THEN NULL
        WHEN r.has_separator THEN regexp_replace(btrim(r.separator_match[1]), '[[:space:]|,:;/-]+$', '')
        WHEN r.has_whitespace THEN regexp_replace(btrim(r.whitespace_match[1]), '[[:space:]|,:;/-]+$', '')
        WHEN r.has_leading THEN regexp_replace(btrim(r.leading_match[2]), '[[:space:]|,:;/-]+$', '')
        ELSE r.raw
    END,
    "emergencyContactPhone" = CASE
        WHEN r.is_phone_only THEN r.raw
        WHEN r.has_separator THEN r.separator_match[2]
        WHEN r.has_whitespace THEN r.whitespace_match[2]
        WHEN r.has_leading THEN r.leading_match[1]
        ELSE NULL
    END
FROM resolved r
WHERE f."id" = r."id";

-- AlterTable
ALTER TABLE "Family"
DROP COLUMN "emergencyContact";
