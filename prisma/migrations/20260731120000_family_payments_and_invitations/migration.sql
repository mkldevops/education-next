-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Invitation"
ADD COLUMN "familyId" TEXT,
ADD COLUMN "personId" TEXT;

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "paymentTransactionId" TEXT;

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "providerSessionId" TEXT,
    "providerPaymentId" VARCHAR(250),
    "succeededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "paymentTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerSessionId_key" ON "PaymentTransaction"("providerSessionId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_familyId_idx" ON "PaymentTransaction"("familyId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_initiatedById_idx" ON "PaymentTransaction"("initiatedById");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderEvent_providerEventId_key" ON "PaymentProviderEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_paymentTransactionId_idx" ON "PaymentProviderEvent"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "Invitation_familyId_idx" ON "Invitation"("familyId");

-- CreateIndex
CREATE INDEX "Invitation_personId_idx" ON "Invitation"("personId");

-- CreateIndex
CREATE INDEX "Payment_paymentTransactionId_idx" ON "Payment"("paymentTransactionId");

-- AddForeignKey
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_paymentTransactionId_fkey"
FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "Family"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_initiatedById_fkey"
FOREIGN KEY ("initiatedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderEvent"
ADD CONSTRAINT "PaymentProviderEvent_paymentTransactionId_fkey"
FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "Family"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
