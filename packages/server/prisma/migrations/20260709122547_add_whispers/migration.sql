-- CreateTable
CREATE TABLE "Whisper" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Whisper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Whisper_userId_idx" ON "Whisper"("userId");

-- AddForeignKey
ALTER TABLE "Whisper" ADD CONSTRAINT "Whisper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
