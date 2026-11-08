-- Reçu d'un paiement en ligne : aucun auteur interne.
ALTER TABLE "Receipt" ALTER COLUMN "recordedById" DROP NOT NULL;

-- Lien public de lecture d'un reçu.
ALTER TABLE "Receipt" ADD COLUMN "shareToken" VARCHAR(64);
CREATE UNIQUE INDEX "Receipt_shareToken_key" ON "Receipt"("shareToken");
