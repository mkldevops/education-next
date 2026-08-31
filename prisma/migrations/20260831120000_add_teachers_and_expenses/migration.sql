-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "firstName" VARCHAR(250) NOT NULL,
    "lastName" VARCHAR(250) NOT NULL,
    "email" VARCHAR(250),
    "phone" VARCHAR(20),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassPeriodTeacher" (
    "schoolId" TEXT NOT NULL,
    "classPeriodId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassPeriodTeacher_pkey" PRIMARY KEY ("classPeriodId","teacherId")
);

-- CreateTable
CREATE TABLE "TeacherExpense" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" VARCHAR(250) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_id_schoolId_key" ON "Teacher"("id", "schoolId");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_idx" ON "Teacher"("schoolId");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_lastName_firstName_idx" ON "Teacher"("schoolId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "ClassPeriodTeacher_teacherId_idx" ON "ClassPeriodTeacher"("teacherId");

-- CreateIndex
CREATE INDEX "ClassPeriodTeacher_schoolId_idx" ON "ClassPeriodTeacher"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherExpense_id_schoolId_key" ON "TeacherExpense"("id", "schoolId");

-- CreateIndex
CREATE INDEX "TeacherExpense_teacherId_idx" ON "TeacherExpense"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherExpense_schoolId_idx" ON "TeacherExpense"("schoolId");

-- CreateIndex
CREATE INDEX "TeacherExpense_requestedAt_idx" ON "TeacherExpense"("requestedAt");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPeriodTeacher" ADD CONSTRAINT "ClassPeriodTeacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPeriodTeacher" ADD CONSTRAINT "ClassPeriodTeacher_classPeriodId_schoolId_fkey" FOREIGN KEY ("classPeriodId", "schoolId") REFERENCES "ClassPeriod"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPeriodTeacher" ADD CONSTRAINT "ClassPeriodTeacher_teacherId_schoolId_fkey" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "Teacher"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExpense" ADD CONSTRAINT "TeacherExpense_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExpense" ADD CONSTRAINT "TeacherExpense_teacherId_schoolId_fkey" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "Teacher"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
