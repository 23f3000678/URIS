-- Add note field to Task model for intern progress notes
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "note" TEXT;
