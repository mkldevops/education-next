ALTER TYPE "SchoolRole" ADD VALUE 'TEACHER';

ALTER TABLE "Teacher" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Teacher_userId_schoolId_key" ON "Teacher"("userId", "schoolId");
CREATE INDEX "Teacher_userId_idx" ON "Teacher"("userId");
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invitation" ADD COLUMN "teacherId" TEXT;
CREATE INDEX "Invitation_teacherId_idx" ON "Invitation"("teacherId");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_teacherId_schoolId_fkey" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "Teacher"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
