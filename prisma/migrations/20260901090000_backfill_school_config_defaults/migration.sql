-- Les écoles créées depuis l'interface n'ont jamais reçu de ligne `Config` : seul le seed
-- local en créait. Ce backfill pose les réglages par défaut pour chaque école existante,
-- sans toucher à ceux déjà renseignés.
INSERT INTO "Config" ("id", "schoolId", "name", "value", "valueType", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s."id", d."name", d."value", d."valueType"::"ConfigValueType", true, NOW(), NOW()
FROM "School" s
CROSS JOIN (
  VALUES
    ('logo_url', '', 'TEXT'),
    ('favicon_url', '', 'TEXT'),
    ('teacher_expenses_enabled', 'false', 'BOOLEAN'),
    ('max_students_per_class', '30', 'NUMBER'),
    ('theme_primary', '#3c6e71', 'COLOR')
) AS d("name", "value", "valueType")
WHERE NOT EXISTS (
  SELECT 1 FROM "Config" c
  WHERE c."schoolId" = s."id" AND c."name" = d."name" AND c."isActive" = true
);
