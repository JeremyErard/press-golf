-- CreateEnum
CREATE TYPE "HandicapSource" AS ENUM ('GHIN', 'USGA', 'CLUB', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "handicapVerifiedAt" TIMESTAMP(3),
                   ADD COLUMN "handicapSource" "HandicapSource",
                   ADD COLUMN "handicapPendingApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HandicapApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "handicap" DECIMAL(3,1) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandicapApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HandicapApproval_userId_idx" ON "HandicapApproval"("userId");

-- CreateIndex
CREATE INDEX "HandicapApproval_roundId_idx" ON "HandicapApproval"("roundId");

-- CreateIndex
CREATE INDEX "HandicapApproval_status_idx" ON "HandicapApproval"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HandicapApproval_userId_roundId_key" ON "HandicapApproval"("userId", "roundId");

-- AddForeignKey
ALTER TABLE "HandicapApproval" ADD CONSTRAINT "HandicapApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandicapApproval" ADD CONSTRAINT "HandicapApproval_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
