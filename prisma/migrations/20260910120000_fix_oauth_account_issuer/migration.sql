UPDATE "Account" a
SET "issuer" = 'https://accounts.google.com'
WHERE a."providerId" = 'google'
  AND a."issuer" = 'local:oauth:google'
  AND NOT EXISTS (
    SELECT 1
    FROM "Account" other
    WHERE other."issuer" = 'https://accounts.google.com'
      AND other."accountId" = a."accountId"
  );
