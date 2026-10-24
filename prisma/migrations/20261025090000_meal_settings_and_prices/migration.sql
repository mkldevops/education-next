-- Cantine et goûter : réglages par service et tarifs datés. Tables neuves uniquement,
-- aucune école existante n'est touchée tant que `meals_enabled` reste éteint.
-- CreateEnum
CREATE TYPE "MealService" AS ENUM ('CANTEEN', 'SNACK');

-- CreateTable
CREATE TABLE "MealServiceSetting" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "service" "MealService" NOT NULL,
    "allowedWeekdays" INTEGER[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealServiceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPrice" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "service" "MealService" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MealServiceSetting_id_schoolId_key" ON "MealServiceSetting"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MealServiceSetting_schoolId_service_key" ON "MealServiceSetting"("schoolId", "service");

-- CreateIndex
CREATE UNIQUE INDEX "MealPrice_id_schoolId_key" ON "MealPrice"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPrice_schoolId_service_effectiveFrom_key" ON "MealPrice"("schoolId", "service", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "MealServiceSetting" ADD CONSTRAINT "MealServiceSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPrice" ADD CONSTRAINT "MealPrice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Jours ISO (lundi = 1) : au moins un, sans NULL. Les doublons sont refusés par le schéma de
-- saisie : un CHECK ne peut pas porter la sous-requête qui les compterait.
ALTER TABLE "MealServiceSetting" ALTER COLUMN "allowedWeekdays" SET NOT NULL;

ALTER TABLE "MealServiceSetting" ADD CONSTRAINT "MealServiceSetting_allowedWeekdays_check"
  CHECK (
    cardinality("allowedWeekdays") >= 1
    AND array_position("allowedWeekdays", NULL) IS NULL
    AND "allowedWeekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]
  );

ALTER TABLE "MealPrice" ADD CONSTRAINT "MealPrice_amount_check" CHECK ("amount" > 0);
