-- Cantine et goûter : comptes repas par élève, segments datés et ajustements en jours.
-- Tables neuves uniquement : aucune école n'est touchée tant que `meals_enabled` reste éteint.

-- CreateEnum
CREATE TYPE "MealAdjustmentKind" AS ENUM ('OPENING', 'REFUND', 'FORFEIT', 'GIFT');

-- CreateTable
CREATE TABLE "MealAccount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "service" "MealService" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealSchedule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "startOn" DATE NOT NULL,
    "endOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealAdjustment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" "MealAdjustmentKind" NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" VARCHAR(250) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealAccount_schoolId_idx" ON "MealAccount"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MealAccount_id_schoolId_key" ON "MealAccount"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MealAccount_schoolId_studentId_service_key" ON "MealAccount"("schoolId", "studentId", "service");

-- CreateIndex
CREATE INDEX "MealSchedule_accountId_idx" ON "MealSchedule"("accountId");

-- CreateIndex
CREATE INDEX "MealSchedule_periodId_idx" ON "MealSchedule"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "MealSchedule_id_schoolId_key" ON "MealSchedule"("id", "schoolId");

-- CreateIndex
CREATE INDEX "MealAdjustment_accountId_idx" ON "MealAdjustment"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MealAdjustment_id_schoolId_key" ON "MealAdjustment"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "MealAccount" ADD CONSTRAINT "MealAccount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAccount" ADD CONSTRAINT "MealAccount_studentId_schoolId_fkey" FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSchedule" ADD CONSTRAINT "MealSchedule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSchedule" ADD CONSTRAINT "MealSchedule_accountId_schoolId_fkey" FOREIGN KEY ("accountId", "schoolId") REFERENCES "MealAccount"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSchedule" ADD CONSTRAINT "MealSchedule_periodId_schoolId_fkey" FOREIGN KEY ("periodId", "schoolId") REFERENCES "Period"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAdjustment" ADD CONSTRAINT "MealAdjustment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAdjustment" ADD CONSTRAINT "MealAdjustment_accountId_schoolId_fkey" FOREIGN KEY ("accountId", "schoolId") REFERENCES "MealAccount"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAdjustment" ADD CONSTRAINT "MealAdjustment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Jours ISO (lundi = 1) : au moins un, sans NULL. Doublons et jours hors réglage de l'école
-- sont refusés par le cas d'usage, qui connaît le réglage.
ALTER TABLE "MealSchedule" ALTER COLUMN "weekdays" SET NOT NULL;

ALTER TABLE "MealSchedule" ADD CONSTRAINT "MealSchedule_weekdays_check"
  CHECK (
    cardinality("weekdays") >= 1
    AND array_position("weekdays", NULL) IS NULL
    AND "weekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]
  );

ALTER TABLE "MealSchedule" ADD CONSTRAINT "MealSchedule_dates_check"
  CHECK ("endOn" IS NULL OR "endOn" >= "startOn");

-- Une reprise ou un don ajoute des jours, un remboursement ou un abandon en retire.
ALTER TABLE "MealAdjustment" ADD CONSTRAINT "MealAdjustment_days_check"
  CHECK (
    ("kind" IN ('OPENING', 'GIFT') AND "days" >= 0)
    OR ("kind" IN ('REFUND', 'FORFEIT') AND "days" < 0)
  );
