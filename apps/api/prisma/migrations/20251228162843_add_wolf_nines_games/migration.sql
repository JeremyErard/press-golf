-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GameType" ADD VALUE 'WOLF';
ALTER TYPE "GameType" ADD VALUE 'NINES';

-- CreateTable
CREATE TABLE "WolfDecision" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "wolfUserId" TEXT NOT NULL,
    "partnerUserId" TEXT,
    "isLoneWolf" BOOLEAN NOT NULL DEFAULT false,
    "isBlind" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WolfDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WolfDecision_gameId_idx" ON "WolfDecision"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "WolfDecision_gameId_holeNumber_key" ON "WolfDecision"("gameId", "holeNumber");

-- AddForeignKey
ALTER TABLE "WolfDecision" ADD CONSTRAINT "WolfDecision_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
