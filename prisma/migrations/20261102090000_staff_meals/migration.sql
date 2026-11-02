-- CreateTable
CREATE TABLE "StaffMeal" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "service" "MealService" NOT NULL,
    "weekdays" INTEGER[],
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffMeal_schoolId_idx" ON "StaffMeal"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMeal_id_schoolId_key" ON "StaffMeal"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMeal_schoolId_teacherId_service_key" ON "StaffMeal"("schoolId", "teacherId", "service");

-- AddForeignKey
ALTER TABLE "StaffMeal" ADD CONSTRAINT "StaffMeal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMeal" ADD CONSTRAINT "StaffMeal_teacherId_schoolId_fkey" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "Teacher"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Jours ISO (lundi = 1), comme MealSchedule : au moins un, sans NULL. Doublons et jours hors
-- réglage de l'école sont refusés par le cas d'usage.
ALTER TABLE "StaffMeal" ALTER COLUMN "weekdays" SET NOT NULL;

ALTER TABLE "StaffMeal" ADD CONSTRAINT "StaffMeal_weekdays_check"
  CHECK (
    cardinality("weekdays") >= 1
    AND array_position("weekdays", NULL) IS NULL
    AND "weekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]
  );
