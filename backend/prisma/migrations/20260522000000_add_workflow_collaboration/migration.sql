-- Phase 9: Workflow & Collaboration — TaskNote, TaskEscalation, WorkflowEvent

CREATE TABLE "TaskNote" (
    "id"         TEXT NOT NULL,
    "taskId"     TEXT NOT NULL,
    "authorId"   TEXT NOT NULL,
    "content"    TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskNote_taskId_idx"   ON "TaskNote"("taskId");
CREATE INDEX "TaskNote_authorId_idx" ON "TaskNote"("authorId");

CREATE TABLE "TaskEscalation" (
    "id"            TEXT NOT NULL,
    "taskId"        TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "escalateTo"    TEXT NOT NULL,
    "reason"        TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'open',
    "resolvedById"  TEXT,
    "resolvedNote"  TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskEscalation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskEscalation_taskId_idx"        ON "TaskEscalation"("taskId");
CREATE INDEX "TaskEscalation_requestedById_idx" ON "TaskEscalation"("requestedById");
CREATE INDEX "TaskEscalation_status_idx"        ON "TaskEscalation"("status");

CREATE TABLE "WorkflowEvent" (
    "id"        TEXT NOT NULL,
    "taskId"    TEXT NOT NULL,
    "actorId"   TEXT,
    "eventType" TEXT NOT NULL,
    "payload"   JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowEvent_taskId_idx"    ON "WorkflowEvent"("taskId");
CREATE INDEX "WorkflowEvent_actorId_idx"   ON "WorkflowEvent"("actorId");
CREATE INDEX "WorkflowEvent_eventType_idx" ON "WorkflowEvent"("eventType");
CREATE INDEX "WorkflowEvent_createdAt_idx" ON "WorkflowEvent"("createdAt");
