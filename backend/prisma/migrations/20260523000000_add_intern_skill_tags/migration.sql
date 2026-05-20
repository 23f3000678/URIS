-- Add skillTags array to Intern for assignment skill-matching
ALTER TABLE "Intern" ADD COLUMN "skillTags" TEXT[] NOT NULL DEFAULT '{}';
