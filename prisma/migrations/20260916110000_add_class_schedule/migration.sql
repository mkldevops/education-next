CREATE TABLE "ClassScheduleSlot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classPeriodId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassScheduleSlot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClassScheduleSlot_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
    CONSTRAINT "ClassScheduleSlot_time_format_check" CHECK (
      "startTime" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "endTime" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
    CONSTRAINT "ClassScheduleSlot_time_range_check" CHECK ("endTime" > "startTime")
);

CREATE TABLE "ClassScheduleSlotTeacher" (
    "schoolId" TEXT NOT NULL,
    "classScheduleSlotId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "ClassScheduleSlotTeacher_pkey" PRIMARY KEY ("classScheduleSlotId", "teacherId")
);

CREATE UNIQUE INDEX "ClassScheduleSlot_id_schoolId_key" ON "ClassScheduleSlot"("id", "schoolId");
CREATE INDEX "ClassScheduleSlot_schoolId_idx" ON "ClassScheduleSlot"("schoolId");
CREATE INDEX "ClassScheduleSlot_schoolId_classPeriodId_weekday_startTime_idx" ON "ClassScheduleSlot"("schoolId", "classPeriodId", "weekday", "startTime");
CREATE INDEX "ClassScheduleSlotTeacher_schoolId_idx" ON "ClassScheduleSlotTeacher"("schoolId");
CREATE INDEX "ClassScheduleSlotTeacher_schoolId_teacherId_idx" ON "ClassScheduleSlotTeacher"("schoolId", "teacherId");

ALTER TABLE "ClassScheduleSlot"
  ADD CONSTRAINT "ClassScheduleSlot_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassScheduleSlot"
  ADD CONSTRAINT "ClassScheduleSlot_classPeriodId_schoolId_fkey"
  FOREIGN KEY ("classPeriodId", "schoolId") REFERENCES "ClassPeriod"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassScheduleSlotTeacher"
  ADD CONSTRAINT "ClassScheduleSlotTeacher_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassScheduleSlotTeacher"
  ADD CONSTRAINT "ClassScheduleSlotTeacher_classScheduleSlotId_schoolId_fkey"
  FOREIGN KEY ("classScheduleSlotId", "schoolId") REFERENCES "ClassScheduleSlot"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassScheduleSlotTeacher"
  ADD CONSTRAINT "ClassScheduleSlotTeacher_teacherId_schoolId_fkey"
  FOREIGN KEY ("teacherId", "schoolId") REFERENCES "Teacher"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Config" ("id", "schoolId", "name", "value", "valueType", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s."id", d."name", d."value", d."valueType"::"ConfigValueType", true, NOW(), NOW()
FROM "School" s
CROSS JOIN (
  VALUES
    ('class_schedule_enabled', 'false', 'BOOLEAN'),
    ('class_schedule_teacher_overlap_allowed', 'true', 'BOOLEAN'),
    ('class_schedule_visibility', 'INTERNAL', 'TEXT')
) AS d("name", "value", "valueType")
WHERE NOT EXISTS (
  SELECT 1 FROM "Config" c
  WHERE c."schoolId" = s."id" AND c."name" = d."name" AND c."isActive" = true
);
