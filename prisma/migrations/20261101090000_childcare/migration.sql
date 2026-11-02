-- CreateTable
CREATE TABLE "ChildcareSubscription" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(10,2) NOT NULL,
    "startMonth" DATE NOT NULL,
    "endMonth" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildcareSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildcareCharge" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "recordedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" VARCHAR(250),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildcareCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildcarePayment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildcarePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildcareSubscription_studentId_idx" ON "ChildcareSubscription"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildcareSubscription_id_schoolId_key" ON "ChildcareSubscription"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildcareSubscription_schoolId_studentId_key" ON "ChildcareSubscription"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "ChildcareCharge_subscriptionId_idx" ON "ChildcareCharge"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildcareCharge_id_schoolId_key" ON "ChildcareCharge"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildcareCharge_schoolId_subscriptionId_month_key" ON "ChildcareCharge"("schoolId", "subscriptionId", "month");

-- CreateIndex
CREATE INDEX "ChildcarePayment_receiptId_idx" ON "ChildcarePayment"("receiptId");

-- CreateIndex
CREATE INDEX "ChildcarePayment_chargeId_idx" ON "ChildcarePayment"("chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildcarePayment_id_schoolId_key" ON "ChildcarePayment"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "ChildcareSubscription" ADD CONSTRAINT "ChildcareSubscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildcareSubscription" ADD CONSTRAINT "ChildcareSubscription_studentId_schoolId_fkey" FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildcareCharge" ADD CONSTRAINT "ChildcareCharge_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildcareCharge" ADD CONSTRAINT "ChildcareCharge_subscriptionId_schoolId_fkey" FOREIGN KEY ("subscriptionId", "schoolId") REFERENCES "ChildcareSubscription"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildcareCharge" ADD CONSTRAINT "ChildcareCharge_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildcareCharge" ADD CONSTRAINT "ChildcareCharge_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildcarePayment" ADD CONSTRAINT "ChildcarePayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildcarePayment" ADD CONSTRAINT "ChildcarePayment_receiptId_schoolId_fkey" FOREIGN KEY ("receiptId", "schoolId") REFERENCES "Receipt"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildcarePayment" ADD CONSTRAINT "ChildcarePayment_chargeId_schoolId_fkey" FOREIGN KEY ("chargeId", "schoolId") REFERENCES "ChildcareCharge"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un mois se stocke au 1er, un montant reste positif, et une fin ne précède pas son début.
ALTER TABLE "ChildcareSubscription"
  ADD CONSTRAINT "ChildcareSubscription_monthlyAmount_check" CHECK ("monthlyAmount" > 0),
  ADD CONSTRAINT "ChildcareSubscription_startMonth_check" CHECK (EXTRACT(DAY FROM "startMonth") = 1),
  ADD CONSTRAINT "ChildcareSubscription_endMonth_check"
    CHECK ("endMonth" IS NULL OR (EXTRACT(DAY FROM "endMonth") = 1 AND "endMonth" >= "startMonth"));
ALTER TABLE "ChildcareCharge"
  ADD CONSTRAINT "ChildcareCharge_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "ChildcareCharge_month_check" CHECK (EXTRACT(DAY FROM "month") = 1);
ALTER TABLE "ChildcarePayment"
  ADD CONSTRAINT "ChildcarePayment_amount_check" CHECK ("amount" > 0);
