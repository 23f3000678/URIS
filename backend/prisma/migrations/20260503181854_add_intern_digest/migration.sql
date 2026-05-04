-- CreateTable
CREATE TABLE "InternDigest" (
    "id" TEXT NOT NULL,
    "internId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "capacityScore" DOUBLE PRECISION NOT NULL,
    "credibilityScore" DOUBLE PRECISION NOT NULL,
    "performanceIndex" DOUBLE PRECISION NOT NULL,
    "activeTasks" INTEGER NOT NULL,
    "completedTasks" INTEGER NOT NULL,
    "openAlerts" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternDigest_internId_idx" ON "InternDigest"("internId");

-- CreateIndex
CREATE INDEX "InternDigest_weekStart_idx" ON "InternDigest"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "InternDigest_internId_weekStart_key" ON "InternDigest"("internId", "weekStart");
