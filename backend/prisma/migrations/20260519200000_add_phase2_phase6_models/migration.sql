-- Phase 2: Security & Governance tables
-- Phase 6: User Lifecycle / Archive table

CREATE TABLE "BlockedIP" (
    "id"          TEXT NOT NULL,
    "ipAddress"   TEXT NOT NULL,
    "reason"      TEXT,
    "expiresAt"   TIMESTAMP(3),
    "blockedById" TEXT,
    "blockedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlockedIP_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlockedIP_ipAddress_key" ON "BlockedIP"("ipAddress");
CREATE INDEX "BlockedIP_ipAddress_idx" ON "BlockedIP"("ipAddress");

CREATE TABLE "LoginLog" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "success"   BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginLog_email_idx"     ON "LoginLog"("email");
CREATE INDEX "LoginLog_ipAddress_idx" ON "LoginLog"("ipAddress");
CREATE INDEX "LoginLog_success_idx"   ON "LoginLog"("success");
CREATE INDEX "LoginLog_createdAt_idx" ON "LoginLog"("createdAt");

CREATE TABLE "UserRoleHistory" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "previousRole" TEXT NOT NULL,
    "newRole"      TEXT NOT NULL,
    "changedById"  TEXT,
    "reason"       TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRoleHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserRoleHistory_userId_idx"    ON "UserRoleHistory"("userId");
CREATE INDEX "UserRoleHistory_createdAt_idx" ON "UserRoleHistory"("createdAt");

CREATE TABLE "ArchivedUser" (
    "id"           TEXT NOT NULL,
    "originalId"   TEXT NOT NULL,
    "snapshot"     JSONB NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'ARCHIVED',
    "archivedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedById" TEXT,
    CONSTRAINT "ArchivedUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArchivedUser_originalId_key" ON "ArchivedUser"("originalId");
CREATE INDEX "ArchivedUser_status_idx"     ON "ArchivedUser"("status");
CREATE INDEX "ArchivedUser_archivedAt_idx" ON "ArchivedUser"("archivedAt");
