-- Migration: add_game_participants
-- Allow multiple games of same type per round and add participant tracking

-- Drop the unique constraint on (roundId, type) to allow multiple games of same type
DROP INDEX IF EXISTS "Game_roundId_type_key";

-- Add new columns for participant tracking
ALTER TABLE "Game" ADD COLUMN "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Game" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Game" ADD COLUMN "name" TEXT;

-- Add foreign key for createdById -> User
ALTER TABLE "Game" ADD CONSTRAINT "Game_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "Game_type_idx" ON "Game"("type");
CREATE INDEX "Game_createdById_idx" ON "Game"("createdById");
