-- Phase 8: Approval Workflows — ApprovalRequest table

CREATE TABLE "ApprovalRequest" (
    "id"            TEXT NOT NULL,
    "action"        TEXT NOT NULL,
    "targetId"      TEXT NOT NULL,
    "targetType"    TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "payload"       JSONB NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "reviewedById"  TEXT,
    "reviewNote"    TEXT,
    "expiresAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApprovalRequest_requestedById_idx" ON "ApprovalRequest"("requestedById");
CREATE INDEX "ApprovalRequest_reviewedById_idx"  ON "ApprovalRequest"("reviewedById");
CREATE INDEX "ApprovalRequest_status_idx"        ON "ApprovalRequest"("status");
CREATE INDEX "ApprovalRequest_action_idx"        ON "ApprovalRequest"("action");
CREATE INDEX "ApprovalRequest_createdAt_idx"     ON "ApprovalRequest"("createdAt");
