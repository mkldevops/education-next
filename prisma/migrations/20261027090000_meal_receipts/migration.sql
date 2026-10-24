-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'MOBILE_MONEY';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receiptId" TEXT;

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(250),
    "paidAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" VARCHAR(250),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "schoolId" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("schoolId")
);

-- CreateTable
CREATE TABLE "MealPayment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "daysAdded" INTEGER NOT NULL,
    "paidThroughAtReceipt" DATE,
    "creditAtReceipt" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Receipt_familyId_idx" ON "Receipt"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_id_schoolId_key" ON "Receipt"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_schoolId_number_key" ON "Receipt"("schoolId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_schoolId_idempotencyKey_key" ON "Receipt"("schoolId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MealPayment_receiptId_idx" ON "MealPayment"("receiptId");

-- CreateIndex
CREATE INDEX "MealPayment_accountId_idx" ON "MealPayment"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPayment_id_schoolId_key" ON "MealPayment"("id", "schoolId");

-- CreateIndex
CREATE INDEX "Payment_receiptId_idx" ON "Payment"("receiptId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receiptId_schoolId_fkey" FOREIGN KEY ("receiptId", "schoolId") REFERENCES "Receipt"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_familyId_schoolId_fkey" FOREIGN KEY ("familyId", "schoolId") REFERENCES "Family"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptCounter" ADD CONSTRAINT "ReceiptCounter_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPayment" ADD CONSTRAINT "MealPayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPayment" ADD CONSTRAINT "MealPayment_receiptId_schoolId_fkey" FOREIGN KEY ("receiptId", "schoolId") REFERENCES "Receipt"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPayment" ADD CONSTRAINT "MealPayment_accountId_schoolId_fkey" FOREIGN KEY ("accountId", "schoolId") REFERENCES "MealAccount"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un reçu encaisse toujours quelque chose ; son numéro part de 1.
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_amounts_check"
  CHECK ("total" > 0 AND "number" > 0);

-- Une annulation porte toujours sa date et son motif.
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_cancellation_check"
  CHECK (("cancelledAt" IS NULL) = ("cancelReason" IS NULL));

ALTER TABLE "ReceiptCounter" ADD CONSTRAINT "ReceiptCounter_next_check" CHECK ("next" > 0);

ALTER TABLE "MealPayment" ADD CONSTRAINT "MealPayment_amounts_check"
  CHECK (
    "amount" > 0
    AND "unitPrice" > 0
    AND "daysAdded" >= 0
    AND "creditAtReceipt" >= 0
  );
