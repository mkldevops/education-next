-- CreateTable
CREATE TABLE "ImpersonationLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ImpersonationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImpersonationLog_sessionId_key" ON "ImpersonationLog"("sessionId");

-- CreateIndex
CREATE INDEX "ImpersonationLog_actorId_idx" ON "ImpersonationLog"("actorId");

-- CreateIndex
CREATE INDEX "ImpersonationLog_targetId_idx" ON "ImpersonationLog"("targetId");

-- CreateIndex
CREATE INDEX "ImpersonationLog_startedAt_idx" ON "ImpersonationLog"("startedAt");
