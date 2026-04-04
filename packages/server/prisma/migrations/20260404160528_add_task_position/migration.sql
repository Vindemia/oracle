-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Task_userId_quadrant_position_idx" ON "Task"("userId", "quadrant", "position");
