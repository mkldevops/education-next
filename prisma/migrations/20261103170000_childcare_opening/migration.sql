-- AlterTable
ALTER TABLE "ChildcareSubscription" ADD COLUMN     "openingPaidThrough" DATE,
ADD COLUMN     "openingReason" VARCHAR(250),
ADD COLUMN     "openingRecordedAt" TIMESTAMP(3),
ADD COLUMN     "openingRecordedById" TEXT;

-- AddForeignKey
ALTER TABLE "ChildcareSubscription" ADD CONSTRAINT "ChildcareSubscription_openingRecordedById_fkey" FOREIGN KEY ("openingRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Une reprise porte toujours son mois et sa raison.
ALTER TABLE "ChildcareSubscription" ADD CONSTRAINT "ChildcareSubscription_opening_check"
  CHECK (("openingPaidThrough" IS NULL) = ("openingReason" IS NULL));
