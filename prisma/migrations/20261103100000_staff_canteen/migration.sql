-- #545 : la cantine du personnel passe par une liste dédiée et les comptes repas, facturés
-- comme ceux des élèves. Le comptage seul de #547 disparaît ; la table est vide en production.
DROP TABLE "StaffMeal";

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "note" VARCHAR(250),
    "mealExempt" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffMember_schoolId_idx" ON "StaffMember"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_id_schoolId_key" ON "StaffMember"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: a meal account belongs to a student or to a staff member
ALTER TABLE "MealAccount" ALTER COLUMN "studentId" DROP NOT NULL,
ADD COLUMN "staffMemberId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MealAccount_schoolId_staffMemberId_service_key" ON "MealAccount"("schoolId", "staffMemberId", "service");

-- AddForeignKey
ALTER TABLE "MealAccount" ADD CONSTRAINT "MealAccount_staffMemberId_schoolId_fkey" FOREIGN KEY ("staffMemberId", "schoolId") REFERENCES "StaffMember"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MealAccount" ADD CONSTRAINT "MealAccount_owner_check"
  CHECK (("studentId" IS NULL) <> ("staffMemberId" IS NULL));

-- AlterTable: a receipt is paid by a family or by a staff member
ALTER TABLE "Receipt" ALTER COLUMN "familyId" DROP NOT NULL,
ADD COLUMN "staffMemberId" TEXT;

-- CreateIndex
CREATE INDEX "Receipt_staffMemberId_idx" ON "Receipt"("staffMemberId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_staffMemberId_schoolId_fkey" FOREIGN KEY ("staffMemberId", "schoolId") REFERENCES "StaffMember"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_payer_check"
  CHECK (("familyId" IS NULL) <> ("staffMemberId" IS NULL));
