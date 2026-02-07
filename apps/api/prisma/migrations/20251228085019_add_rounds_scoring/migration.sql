-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('SETUP', 'ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RoundStatus" NOT NULL DEFAULT 'SETUP',
    "inviteCode" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundPlayer" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseHandicap" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoundPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoleScore" (
    "id" TEXT NOT NULL,
    "roundPlayerId" TEXT NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "strokes" INTEGER,
    "putts" INTEGER,

    CONSTRAINT "HoleScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Round_inviteCode_key" ON "Round"("inviteCode");

-- CreateIndex
CREATE INDEX "Round_courseId_idx" ON "Round"("courseId");

-- CreateIndex
CREATE INDEX "Round_createdById_idx" ON "Round"("createdById");

-- CreateIndex
CREATE INDEX "Round_inviteCode_idx" ON "Round"("inviteCode");

-- CreateIndex
CREATE INDEX "Round_status_idx" ON "Round"("status");

-- CreateIndex
CREATE INDEX "RoundPlayer_roundId_idx" ON "RoundPlayer"("roundId");

-- CreateIndex
CREATE INDEX "RoundPlayer_userId_idx" ON "RoundPlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundPlayer_roundId_userId_key" ON "RoundPlayer"("roundId", "userId");

-- CreateIndex
CREATE INDEX "HoleScore_roundPlayerId_idx" ON "HoleScore"("roundPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "HoleScore_roundPlayerId_holeNumber_key" ON "HoleScore"("roundPlayerId", "holeNumber");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "Tee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundPlayer" ADD CONSTRAINT "RoundPlayer_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundPlayer" ADD CONSTRAINT "RoundPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoleScore" ADD CONSTRAINT "HoleScore_roundPlayerId_fkey" FOREIGN KEY ("roundPlayerId") REFERENCES "RoundPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
