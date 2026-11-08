-- CreateTable
CREATE TABLE "PokerNowAlias" (
    "pokerNowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,

    CONSTRAINT "PokerNowAlias_pkey" PRIMARY KEY ("pokerNowId")
);

-- CreateTable
CREATE TABLE "HandLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "heroPokerNowId" TEXT,
    "heroUserId" TEXT,
    "players" JSONB NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hand" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "pokerNowId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "pot" INTEGER NOT NULL,
    "showdown" BOOLEAN NOT NULL,
    "heroCards" TEXT[],
    "data" JSONB NOT NULL,

    CONSTRAINT "Hand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PokerNowAlias_userId_idx" ON "PokerNowAlias"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HandLog_sessionId_key" ON "HandLog"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Hand_pokerNowId_key" ON "Hand"("pokerNowId");

-- CreateIndex
CREATE UNIQUE INDEX "Hand_logId_number_key" ON "Hand"("logId", "number");

-- AddForeignKey
ALTER TABLE "PokerNowAlias" ADD CONSTRAINT "PokerNowAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandLog" ADD CONSTRAINT "HandLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandLog" ADD CONSTRAINT "HandLog_heroUserId_fkey" FOREIGN KEY ("heroUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandLog" ADD CONSTRAINT "HandLog_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hand" ADD CONSTRAINT "Hand_logId_fkey" FOREIGN KEY ("logId") REFERENCES "HandLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
