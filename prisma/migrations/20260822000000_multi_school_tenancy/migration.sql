-- Multi-écoles : introduit School / SchoolMember, scope 16 modèles par schoolId,
-- remplace User.role + enum Role par User.isSuperAdmin + SchoolMember.role (SchoolRole).
--
-- L'ordre des étapes est contraint et non cosmétique :
--   * l'INSERT de bootstrap doit fournir updatedAt (NOT NULL sans défaut) ;
--   * une FK valide les lignes existantes à sa création, donc SchoolMember doit être
--     peuplée AVANT la création de UserFamily_userId_schoolId_fkey ;
--   * les index uniques cibles doivent exister avant les FK composites qui les référencent.

-- ─── 1. Type et tables tenant ───────────────────────────────────────────────

CREATE TYPE "SchoolRole" AS ENUM ('ADMIN', 'PARENT');

CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "address" VARCHAR(250),
    "postCode" VARCHAR(10),
    "city" VARCHAR(250),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolMember" (
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "SchoolRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolMember_pkey" PRIMARY KEY ("userId","schoolId")
);

CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");
CREATE INDEX "SchoolMember_schoolId_role_idx" ON "SchoolMember"("schoolId", "role");
CREATE UNIQUE INDEX "SchoolMember_userId_schoolId_key" ON "SchoolMember"("userId", "schoolId");

ALTER TABLE "SchoolMember" ADD CONSTRAINT "SchoolMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolMember" ADD CONSTRAINT "SchoolMember_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 2. Bootstrap : exactement une école ────────────────────────────────────
-- Le CI rejoue depuis une base vide, qui n'a pas de Config.school_name : le COALESCE
-- est obligatoire. Le LIMIT 1 ordonné neutralise d'éventuels doublons de la clé.

INSERT INTO "School" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  COALESCE(
    (SELECT NULLIF(TRIM("value"), '') FROM "Config"
     WHERE "name" = 'school_name' AND "isActive"
     ORDER BY "updatedAt" DESC, "id" DESC
     LIMIT 1),
    'École'
  ),
  'default',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ─── 3. Colonne plateforme, avant son backfill ──────────────────────────────

ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- ─── 4. Les 16 colonnes schoolId, d'abord nullables ─────────────────────────

ALTER TABLE "Family" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "UserFamily" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Person" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "FamilyPerson" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Student" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "PhoneNumber" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Config" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Level" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Period" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "ClassPeriod" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Enrollment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "ClassAssignment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Plan" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "schoolId" TEXT;

-- ─── 5. Backfill vers l'école unique ────────────────────────────────────────

DO $$
DECLARE
  target_school TEXT;
BEGIN
  SELECT "id" INTO target_school FROM "School" ORDER BY "createdAt", "id" LIMIT 1;

  UPDATE "Family"             SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "UserFamily"         SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "Person"             SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "FamilyPerson"       SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "Student"            SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "PhoneNumber"        SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "Config"             SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "Level"              SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "Period"             SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "ClassPeriod"        SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "Enrollment"         SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "ClassAssignment"    SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "Payment"            SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "PaymentTransaction" SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "Plan"               SET "schoolId" = target_school WHERE "schoolId" IS NULL;
  UPDATE "Invitation"         SET "schoolId" = target_school WHERE "schoolId" IS NULL;
END $$;

-- ─── 6. Préflight bloquant : doublons de nom parmi les lignes actives ───────
-- Les uniques partiels de l'étape 9 échoueraient. Aucune fusion automatique :
-- ClassPeriod référence Level/Period, Enrollment référence Plan, et nextLevelId
-- traverse les niveaux — fusionner à l'aveugle corromprait des données métier.

DO $$
DECLARE
  duplicates TEXT;
BEGIN
  SELECT string_agg(entry, E'\n') INTO duplicates FROM (
    SELECT 'Config: ' || "name" AS entry FROM "Config"
      WHERE "isActive" GROUP BY "schoolId", "name" HAVING COUNT(*) > 1
    UNION ALL
    SELECT 'Level: ' || "name" FROM "Level"
      WHERE "isActive" GROUP BY "schoolId", "name" HAVING COUNT(*) > 1
    UNION ALL
    SELECT 'Period: ' || "name" FROM "Period"
      WHERE "isActive" GROUP BY "schoolId", "name" HAVING COUNT(*) > 1
    UNION ALL
    SELECT 'Plan: ' || "name" FROM "Plan"
      WHERE "isActive" GROUP BY "schoolId", "name" HAVING COUNT(*) > 1
  ) AS d;

  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION E'Migration multi-écoles interrompue : noms actifs en doublon.\n%\n\nRésolvez ces doublons (renommage ou archivage) puis relancez la migration.', duplicates;
  END IF;
END $$;

-- ─── 7. Config : colonne morte et nom d'école déplacé vers School ───────────
-- Config.personId n'était écrite qu'à null et n'avait aucun chemin de lecture.
-- School.name devient l'unique source de vérité du nom.

DROP INDEX IF EXISTS "Config_personId_idx";
ALTER TABLE "Config" DROP CONSTRAINT IF EXISTS "Config_personId_fkey";
ALTER TABLE "Config" DROP COLUMN "personId";

DELETE FROM "Config" WHERE "name" = 'school_name';

-- ─── 8. Rôles — AVANT toute contrainte de l'étape 9 ─────────────────────────

UPDATE "User" SET "isSuperAdmin" = ("role" = 'SUPER_ADMIN');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Invitation" WHERE "role" = 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Migration multi-écoles interrompue : des invitations portent le rôle SUPER_ADMIN, qui n''existe plus au niveau école.';
  END IF;
END $$;

ALTER TABLE "Invitation" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Invitation" ALTER COLUMN "role" TYPE "SchoolRole" USING "role"::text::"SchoolRole";
ALTER TABLE "Invitation" ALTER COLUMN "role" SET DEFAULT 'PARENT';

-- Les SUPER_ADMIN ne reçoivent aucune appartenance : leur portée est la plateforme.
INSERT INTO "SchoolMember" ("userId", "schoolId", "role", "createdAt")
SELECT
  u."id",
  (SELECT "id" FROM "School" ORDER BY "createdAt", "id" LIMIT 1),
  u."role"::text::"SchoolRole",
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" IN ('ADMIN', 'PARENT');

ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";

-- ─── 9. Contraintes : NOT NULL, puis uniques, puis FK composites ────────────

ALTER TABLE "Family"             ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "UserFamily"         ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Person"             ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "FamilyPerson"       ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Student"            ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "PhoneNumber"        ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Config"             ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Level"              ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Period"             ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ClassPeriod"        ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Enrollment"         ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ClassAssignment"    ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Payment"            ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "PaymentTransaction" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Plan"               ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Invitation"         ALTER COLUMN "schoolId" SET NOT NULL;

-- Les FK simples cèdent la place aux FK composites, qui portent la garantie tenant.
ALTER TABLE "ClassAssignment"    DROP CONSTRAINT "ClassAssignment_classPeriodId_fkey";
ALTER TABLE "ClassAssignment"    DROP CONSTRAINT "ClassAssignment_enrollmentId_fkey";
ALTER TABLE "ClassPeriod"        DROP CONSTRAINT "ClassPeriod_levelId_fkey";
ALTER TABLE "ClassPeriod"        DROP CONSTRAINT "ClassPeriod_periodId_fkey";
ALTER TABLE "Enrollment"         DROP CONSTRAINT "Enrollment_planId_fkey";
ALTER TABLE "Enrollment"         DROP CONSTRAINT "Enrollment_studentId_fkey";
ALTER TABLE "FamilyPerson"       DROP CONSTRAINT "FamilyPerson_familyId_fkey";
ALTER TABLE "FamilyPerson"       DROP CONSTRAINT "FamilyPerson_personId_fkey";
ALTER TABLE "Invitation"         DROP CONSTRAINT "Invitation_familyId_fkey";
ALTER TABLE "Invitation"         DROP CONSTRAINT "Invitation_personId_fkey";
ALTER TABLE "Level"              DROP CONSTRAINT "Level_nextLevelId_fkey";
ALTER TABLE "Payment"            DROP CONSTRAINT "Payment_enrollmentId_fkey";
ALTER TABLE "Payment"            DROP CONSTRAINT "Payment_familyId_fkey";
ALTER TABLE "Payment"            DROP CONSTRAINT "Payment_paymentTransactionId_fkey";
ALTER TABLE "PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_familyId_fkey";
ALTER TABLE "PhoneNumber"        DROP CONSTRAINT "PhoneNumber_personId_fkey";
ALTER TABLE "Student"            DROP CONSTRAINT "Student_personId_fkey";
ALTER TABLE "UserFamily"         DROP CONSTRAINT "UserFamily_familyId_fkey";

-- Uniques simples remplacés par leurs équivalents composites : une relation 1-à-1
-- composite exige l'unique composite côté source.
DROP INDEX "Level_nextLevelId_key";
DROP INDEX "Student_personId_key";

CREATE INDEX "ClassAssignment_schoolId_idx" ON "ClassAssignment"("schoolId");
CREATE INDEX "ClassPeriod_schoolId_idx" ON "ClassPeriod"("schoolId");
CREATE UNIQUE INDEX "ClassPeriod_id_schoolId_key" ON "ClassPeriod"("id", "schoolId");
CREATE INDEX "Config_schoolId_idx" ON "Config"("schoolId");
CREATE UNIQUE INDEX "Config_schoolId_name_key" ON "Config"("schoolId", "name") WHERE ("isActive" = true);
CREATE INDEX "Enrollment_schoolId_idx" ON "Enrollment"("schoolId");
CREATE UNIQUE INDEX "Enrollment_id_schoolId_key" ON "Enrollment"("id", "schoolId");
CREATE INDEX "Family_schoolId_idx" ON "Family"("schoolId");
CREATE UNIQUE INDEX "Family_id_schoolId_key" ON "Family"("id", "schoolId");
CREATE INDEX "FamilyPerson_schoolId_idx" ON "FamilyPerson"("schoolId");
CREATE INDEX "Invitation_schoolId_idx" ON "Invitation"("schoolId");
CREATE INDEX "Level_schoolId_idx" ON "Level"("schoolId");
CREATE UNIQUE INDEX "Level_id_schoolId_key" ON "Level"("id", "schoolId");
CREATE UNIQUE INDEX "Level_nextLevelId_schoolId_key" ON "Level"("nextLevelId", "schoolId");
CREATE UNIQUE INDEX "Level_schoolId_name_key" ON "Level"("schoolId", "name") WHERE ("isActive" = true);
CREATE INDEX "Payment_schoolId_idx" ON "Payment"("schoolId");
CREATE INDEX "PaymentTransaction_schoolId_idx" ON "PaymentTransaction"("schoolId");
CREATE UNIQUE INDEX "PaymentTransaction_id_schoolId_key" ON "PaymentTransaction"("id", "schoolId");
CREATE INDEX "Period_schoolId_idx" ON "Period"("schoolId");
CREATE UNIQUE INDEX "Period_id_schoolId_key" ON "Period"("id", "schoolId");
CREATE UNIQUE INDEX "Period_schoolId_name_key" ON "Period"("schoolId", "name") WHERE ("isActive" = true);
CREATE INDEX "Person_schoolId_idx" ON "Person"("schoolId");
CREATE UNIQUE INDEX "Person_id_schoolId_key" ON "Person"("id", "schoolId");
CREATE INDEX "PhoneNumber_schoolId_idx" ON "PhoneNumber"("schoolId");
CREATE INDEX "Plan_schoolId_idx" ON "Plan"("schoolId");
CREATE UNIQUE INDEX "Plan_id_schoolId_key" ON "Plan"("id", "schoolId");
CREATE UNIQUE INDEX "Plan_schoolId_name_key" ON "Plan"("schoolId", "name") WHERE ("isActive" = true);
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");
CREATE UNIQUE INDEX "Student_id_schoolId_key" ON "Student"("id", "schoolId");
CREATE UNIQUE INDEX "Student_personId_schoolId_key" ON "Student"("personId", "schoolId");
CREATE INDEX "UserFamily_schoolId_idx" ON "UserFamily"("schoolId");

ALTER TABLE "Family" ADD CONSTRAINT "Family_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserFamily" ADD CONSTRAINT "UserFamily_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserFamily" ADD CONSTRAINT "UserFamily_familyId_schoolId_fkey" FOREIGN KEY ("familyId", "schoolId") REFERENCES "Family"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFamily" ADD CONSTRAINT "UserFamily_userId_schoolId_fkey" FOREIGN KEY ("userId", "schoolId") REFERENCES "SchoolMember"("userId", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Person" ADD CONSTRAINT "Person_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FamilyPerson" ADD CONSTRAINT "FamilyPerson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FamilyPerson" ADD CONSTRAINT "FamilyPerson_familyId_schoolId_fkey" FOREIGN KEY ("familyId", "schoolId") REFERENCES "Family"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyPerson" ADD CONSTRAINT "FamilyPerson_personId_schoolId_fkey" FOREIGN KEY ("personId", "schoolId") REFERENCES "Person"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_personId_schoolId_fkey" FOREIGN KEY ("personId", "schoolId") REFERENCES "Person"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_personId_schoolId_fkey" FOREIGN KEY ("personId", "schoolId") REFERENCES "Person"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Config" ADD CONSTRAINT "Config_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Level" ADD CONSTRAINT "Level_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Level" ADD CONSTRAINT "Level_nextLevelId_schoolId_fkey" FOREIGN KEY ("nextLevelId", "schoolId") REFERENCES "Level"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Period" ADD CONSTRAINT "Period_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassPeriod" ADD CONSTRAINT "ClassPeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassPeriod" ADD CONSTRAINT "ClassPeriod_levelId_schoolId_fkey" FOREIGN KEY ("levelId", "schoolId") REFERENCES "Level"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassPeriod" ADD CONSTRAINT "ClassPeriod_periodId_schoolId_fkey" FOREIGN KEY ("periodId", "schoolId") REFERENCES "Period"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_schoolId_fkey" FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_planId_schoolId_fkey" FOREIGN KEY ("planId", "schoolId") REFERENCES "Plan"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_enrollmentId_schoolId_fkey" FOREIGN KEY ("enrollmentId", "schoolId") REFERENCES "Enrollment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_classPeriodId_schoolId_fkey" FOREIGN KEY ("classPeriodId", "schoolId") REFERENCES "ClassPeriod"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_familyId_schoolId_fkey" FOREIGN KEY ("familyId", "schoolId") REFERENCES "Family"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_enrollmentId_schoolId_fkey" FOREIGN KEY ("enrollmentId", "schoolId") REFERENCES "Enrollment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentTransactionId_schoolId_fkey" FOREIGN KEY ("paymentTransactionId", "schoolId") REFERENCES "PaymentTransaction"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_familyId_schoolId_fkey" FOREIGN KEY ("familyId", "schoolId") REFERENCES "Family"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_familyId_schoolId_fkey" FOREIGN KEY ("familyId", "schoolId") REFERENCES "Family"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_personId_schoolId_fkey" FOREIGN KEY ("personId", "schoolId") REFERENCES "Person"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
