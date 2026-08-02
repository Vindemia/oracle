-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "starredOn" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastRitualOn" TEXT;

-- CreateTable
CREATE TABLE "ActivityDay" (
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,

    CONSTRAINT "ActivityDay_pkey" PRIMARY KEY ("userId","dateKey")
);

-- CreateIndex
CREATE INDEX "Task_userId_starredOn_idx" ON "Task"("userId", "starredOn");

-- AddForeignKey
ALTER TABLE "ActivityDay" ADD CONSTRAINT "ActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
