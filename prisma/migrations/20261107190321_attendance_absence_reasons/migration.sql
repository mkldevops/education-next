-- AlterTable
ALTER TABLE "AttendanceEntry" ADD COLUMN     "absenceReasonId" TEXT,
ADD COLUMN     "absenceReasonLabel" VARCHAR(80);

-- CreateTable
CREATE TABLE "AbsenceReason" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "justified" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbsenceReason_schoolId_position_idx" ON "AbsenceReason"("schoolId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceReason_id_schoolId_key" ON "AbsenceReason"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_absenceReasonId_schoolId_fkey" FOREIGN KEY ("absenceReasonId", "schoolId") REFERENCES "AbsenceReason"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceReason" ADD CONSTRAINT "AbsenceReason_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Default reasons for every existing school, kept in sync with DEFAULT_ABSENCE_REASONS.
INSERT INTO "AbsenceReason" ("id", "schoolId", "label", "justified", "position", "updatedAt")
SELECT gen_random_uuid()::text, s."id", r."label", r."justified", r."position", CURRENT_TIMESTAMP
FROM "School" s
CROSS JOIN (VALUES
  ('Maladie', true, 0),
  ('Rendez-vous médical', true, 1),
  ('Raison familiale', true, 2),
  ('Sans nouvelles', false, 3)
) AS r("label", "justified", "position");
