-- CreateTable
CREATE TABLE "MealAbsence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealAbsence_accountId_idx" ON "MealAbsence"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MealAbsence_id_schoolId_key" ON "MealAbsence"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MealAbsence_schoolId_accountId_date_key" ON "MealAbsence"("schoolId", "accountId", "date");

-- AddForeignKey
ALTER TABLE "MealAbsence" ADD CONSTRAINT "MealAbsence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAbsence" ADD CONSTRAINT "MealAbsence_accountId_schoolId_fkey" FOREIGN KEY ("accountId", "schoolId") REFERENCES "MealAccount"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAbsence" ADD CONSTRAINT "MealAbsence_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
