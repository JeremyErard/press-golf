-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "logoUrl" TEXT,
    "website" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tee" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "slopeRating" INTEGER,
    "courseRating" DECIMAL(4,1),
    "totalYardage" INTEGER,

    CONSTRAINT "Tee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hole" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "par" INTEGER NOT NULL,
    "handicapRank" INTEGER NOT NULL,

    CONSTRAINT "Hole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoleYardage" (
    "id" TEXT NOT NULL,
    "holeId" TEXT NOT NULL,
    "teeId" TEXT NOT NULL,
    "yardage" INTEGER NOT NULL,

    CONSTRAINT "HoleYardage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Course_name_idx" ON "Course"("name");

-- CreateIndex
CREATE INDEX "Course_state_idx" ON "Course"("state");

-- CreateIndex
CREATE INDEX "Tee_courseId_idx" ON "Tee"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Tee_courseId_name_key" ON "Tee"("courseId", "name");

-- CreateIndex
CREATE INDEX "Hole_courseId_idx" ON "Hole"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Hole_courseId_holeNumber_key" ON "Hole"("courseId", "holeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HoleYardage_holeId_teeId_key" ON "HoleYardage"("holeId", "teeId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tee" ADD CONSTRAINT "Tee_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hole" ADD CONSTRAINT "Hole_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoleYardage" ADD CONSTRAINT "HoleYardage_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "Hole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoleYardage" ADD CONSTRAINT "HoleYardage_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "Tee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
