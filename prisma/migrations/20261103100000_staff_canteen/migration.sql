-- #545 : la cantine du personnel passe par les enseignants (le personnel y figure déjà) et
-- les comptes repas, facturés comme ceux des élèves. Le comptage seul de #547 disparaît ; la table est vide en production.
DROP TABLE "StaffMeal";

-- AlterTable: an exempt staff member eats without ever being billed
ALTER TABLE "Teacher" ADD COLUMN "mealExempt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: a meal account belongs to a student or to a teacher
ALTER TABLE "MealAccount" ALTER COLUMN "studentId" DROP NOT NULL,
ADD COLUMN "teacherId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MealAccount_schoolId_teacherId_service_key" ON "MealAccount"("schoolId", "teacherId", "service");

-- AddForeignKey
ALTER TABLE "MealAccount" ADD CONSTRAINT "MealAccount_teacherId_schoolId_fkey" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "Teacher"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MealAccount" ADD CONSTRAINT "MealAccount_owner_check"
  CHECK (("studentId" IS NULL) <> ("teacherId" IS NULL));

-- AlterTable: a receipt is paid by a family or by a teacher
ALTER TABLE "Receipt" ALTER COLUMN "familyId" DROP NOT NULL,
ADD COLUMN "teacherId" TEXT;

-- CreateIndex
CREATE INDEX "Receipt_teacherId_idx" ON "Receipt"("teacherId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_teacherId_schoolId_fkey" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "Teacher"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_payer_check"
  CHECK (("familyId" IS NULL) <> ("teacherId" IS NULL));
