ALTER TABLE "Session" ADD COLUMN "impersonatedBy" TEXT;

CREATE INDEX "Session_impersonatedBy_idx" ON "Session"("impersonatedBy");
