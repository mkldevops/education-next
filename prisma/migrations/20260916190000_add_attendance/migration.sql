CREATE TYPE "AttendanceSessionStatus" AS ENUM ('DRAFT', 'VALIDATED');
CREATE TYPE "AttendanceEntryStatus" AS ENUM ('NOT_RECORDED', 'PRESENT', 'ABSENT');

CREATE TABLE "AttendanceSession" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classPeriodId" TEXT NOT NULL,
  "classScheduleSlotId" TEXT,
  "occurrenceKey" VARCHAR(300) NOT NULL,
  "occurredOn" DATE NOT NULL,
  "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "validatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceSession_id_schoolId_key" ON "AttendanceSession"("id", "schoolId");
CREATE UNIQUE INDEX "AttendanceSession_schoolId_classPeriodId_occurredOn_occurrenceKey_key" ON "AttendanceSession"("schoolId", "classPeriodId", "occurredOn", "occurrenceKey");
CREATE INDEX "AttendanceSession_schoolId_occurredOn_idx" ON "AttendanceSession"("schoolId", "occurredOn");

CREATE TABLE "AttendanceEntry" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "attendanceSessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "studentName" VARCHAR(500) NOT NULL,
  "status" "AttendanceEntryStatus" NOT NULL DEFAULT 'NOT_RECORDED',
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceEntry_attendanceSessionId_studentId_key" ON "AttendanceEntry"("attendanceSessionId", "studentId");
CREATE INDEX "AttendanceEntry_schoolId_studentId_idx" ON "AttendanceEntry"("schoolId", "studentId");

ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_classPeriodId_schoolId_fkey" FOREIGN KEY ("classPeriodId", "schoolId") REFERENCES "ClassPeriod"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_classScheduleSlotId_schoolId_fkey" FOREIGN KEY ("classScheduleSlotId", "schoolId") REFERENCES "ClassScheduleSlot"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_attendanceSessionId_schoolId_fkey" FOREIGN KEY ("attendanceSessionId", "schoolId") REFERENCES "AttendanceSession"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_studentId_schoolId_fkey" FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
