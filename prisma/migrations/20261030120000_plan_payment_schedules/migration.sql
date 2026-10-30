-- Additive only: existing plans retain their annual amount and have no overdue tracking.
ALTER TABLE "Plan"
ADD COLUMN "pricing" JSONB,
ADD COLUMN "paymentSchedule" JSONB;
