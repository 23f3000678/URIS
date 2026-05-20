-- DB integrity fixes: foreign keys and indexes applied directly to the database.

-- Activity: FK on userId
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Alert: composite index and FK on taskId
CREATE INDEX "Alert_internId_resolved_idx" ON "Alert"("internId", "resolved");
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuditLog: FK on userId
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InternDigest: FK on internId
ALTER TABLE "InternDigest" ADD CONSTRAINT "InternDigest_internId_fkey" FOREIGN KEY ("internId") REFERENCES "Intern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ScoreHistory: additional indexes
CREATE INDEX "ScoreHistory_createdAt_idx" ON "ScoreHistory"("createdAt");
CREATE INDEX "ScoreHistory_internId_type_createdAt_idx" ON "ScoreHistory"("internId", "type", "createdAt");

-- SyncLog: FK on internId
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_internId_fkey" FOREIGN KEY ("internId") REFERENCES "Intern"("id") ON DELETE SET NULL ON UPDATE CASCADE;
