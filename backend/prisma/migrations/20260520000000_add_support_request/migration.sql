-- Phase 3: Support Request table

CREATE TABLE "SupportRequest" (
    "id"             TEXT NOT NULL,
    "submittedById"  TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "category"       TEXT NOT NULL DEFAULT 'general',
    "status"         TEXT NOT NULL DEFAULT 'open',
    "priority"       TEXT NOT NULL DEFAULT 'normal',
    "assignedToId"   TEXT,
    "internalNotes"  TEXT,
    "resolvedAt"     TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupportRequest"
    ADD CONSTRAINT "SupportRequest_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupportRequest"
    ADD CONSTRAINT "SupportRequest_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SupportRequest_submittedById_idx" ON "SupportRequest"("submittedById");
CREATE INDEX "SupportRequest_assignedToId_idx"  ON "SupportRequest"("assignedToId");
CREATE INDEX "SupportRequest_status_idx"        ON "SupportRequest"("status");
CREATE INDEX "SupportRequest_priority_idx"      ON "SupportRequest"("priority");
CREATE INDEX "SupportRequest_createdAt_idx"     ON "SupportRequest"("createdAt");
