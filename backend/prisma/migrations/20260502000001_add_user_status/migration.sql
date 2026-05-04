-- Add status column to User table
-- 'active'  = can log in (default for all existing users and new interns)
-- 'pending' = awaiting admin approval (new admin-role registrations)

ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- Create index for fast pending-user lookups
CREATE INDEX "User_status_idx" ON "User"("status");
