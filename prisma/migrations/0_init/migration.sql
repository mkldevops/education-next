-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('PARENT', 'TUTOR', 'GRANDPARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'CHECK', 'STRIPE');

-- CreateEnum
CREATE TYPE "ConfigValueType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PARENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PARENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "emergencyContact" VARCHAR(250),
    "authorizedPickup" TEXT,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFamily" (
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,

    CONSTRAINT "UserFamily_pkey" PRIMARY KEY ("userId","familyId")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "lastname" VARCHAR(250) NOT NULL,
    "sex" "Sex" NOT NULL,
    "email" VARCHAR(250),
    "address" VARCHAR(250),
    "postCode" VARCHAR(10),
    "city" VARCHAR(250),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyPerson" (
    "familyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL,

    CONSTRAINT "FamilyPerson_pkey" PRIMARY KEY ("familyId","personId")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "birthday" TIMESTAMP(3) NOT NULL,
    "birthplace" VARCHAR(250),
    "previousSchool" VARCHAR(250),
    "healthNotes" TEXT,
    "languagesAtHome" JSONB NOT NULL DEFAULT '[]',
    "snackAuthorization" BOOLEAN NOT NULL DEFAULT false,
    "allergies" VARCHAR(250),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneNumber" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL,
    "personId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "nextLevelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassPeriod" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "levelId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canLeaveAlone" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAssignment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "classPeriodId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(250),
    "paidAt" TIMESTAMP(3) NOT NULL,
    "cashedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_identifier_key" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Family_createdById_idx" ON "Family"("createdById");

-- CreateIndex
CREATE INDEX "UserFamily_familyId_idx" ON "UserFamily"("familyId");

-- CreateIndex
CREATE INDEX "FamilyPerson_personId_idx" ON "FamilyPerson"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_personId_key" ON "Student"("personId");

-- CreateIndex
CREATE INDEX "PhoneNumber_personId_idx" ON "PhoneNumber"("personId");

-- CreateIndex
CREATE INDEX "Config_personId_idx" ON "Config"("personId");

-- CreateIndex
CREATE INDEX "Config_name_idx" ON "Config"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Level_nextLevelId_key" ON "Level"("nextLevelId");

-- CreateIndex
CREATE INDEX "ClassPeriod_levelId_idx" ON "ClassPeriod"("levelId");

-- CreateIndex
CREATE INDEX "ClassPeriod_periodId_idx" ON "ClassPeriod"("periodId");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");

-- CreateIndex
CREATE INDEX "Enrollment_planId_idx" ON "Enrollment"("planId");

-- CreateIndex
CREATE INDEX "Enrollment_status_idx" ON "Enrollment"("status");

-- CreateIndex
CREATE INDEX "ClassAssignment_enrollmentId_idx" ON "ClassAssignment"("enrollmentId");

-- CreateIndex
CREATE INDEX "ClassAssignment_classPeriodId_idx" ON "ClassAssignment"("classPeriodId");

-- CreateIndex
CREATE INDEX "Payment_familyId_idx" ON "Payment"("familyId");

-- CreateIndex
CREATE INDEX "Payment_enrollmentId_idx" ON "Payment"("enrollmentId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFamily" ADD CONSTRAINT "UserFamily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFamily" ADD CONSTRAINT "UserFamily_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyPerson" ADD CONSTRAINT "FamilyPerson_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyPerson" ADD CONSTRAINT "FamilyPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Config" ADD CONSTRAINT "Config_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_nextLevelId_fkey" FOREIGN KEY ("nextLevelId") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPeriod" ADD CONSTRAINT "ClassPeriod_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPeriod" ADD CONSTRAINT "ClassPeriod_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_classPeriodId_fkey" FOREIGN KEY ("classPeriodId") REFERENCES "ClassPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

