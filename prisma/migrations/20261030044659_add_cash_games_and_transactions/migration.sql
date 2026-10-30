-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('CUP', 'CASH');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- DropIndex
DROP INDEX "GameSession_playedAt_idx";

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "type" "GameType" NOT NULL DEFAULT 'CUP';

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "happenedAt" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_happenedAt_idx" ON "Transaction"("happenedAt");

-- CreateIndex
CREATE INDEX "GameSession_type_playedAt_idx" ON "GameSession"("type", "playedAt");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
