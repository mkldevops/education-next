ALTER TYPE "AttendanceEntryStatus" ADD VALUE 'LATE';

ALTER TABLE "AttendanceEntry"
  ADD COLUMN "lateMinutes" INTEGER,
  ADD COLUMN "message" VARCHAR(1000);
