-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "endMonth" DATE,
ADD COLUMN     "writeOffAmount" DECIMAL(10,2),
ADD COLUMN     "writeOffReason" VARCHAR(500);

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "formerClassLabel" VARCHAR(100),
ADD COLUMN     "leftAt" TIMESTAMP(3);
