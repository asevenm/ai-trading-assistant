-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" TEXT NOT NULL DEFAULT 'SH',
    "tags" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "impactDirection" TEXT NOT NULL DEFAULT 'neutral',
    "impactDuration" TEXT,
    "sourceUrl" TEXT,
    "sourceTitle" TEXT,
    "rawContent" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiPrompt" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "stockId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "eventId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationIndicator" (
    "id" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "targetValue" TEXT,
    "currentValue" TEXT,
    "disproofCondition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stockId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradePlan" (
    "id" TEXT NOT NULL,
    "entryConditions" TEXT NOT NULL,
    "entryPriceMin" DOUBLE PRECISION,
    "entryPriceMax" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "takeProfit" DOUBLE PRECISION,
    "maxPosition" DOUBLE PRECISION NOT NULL,
    "disproofConditions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "stockId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "realizedPnL" DOUBLE PRECISION,
    "entryReason" TEXT,
    "exitReason" TEXT,
    "resultTag" TEXT,
    "notes" TEXT,
    "tradeTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradePlanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION,
    "totalPnL" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "summary" TEXT,
    "statsByReason" TEXT,
    "improvements" TEXT,
    "userNotes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReview" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "indexSummary" TEXT NOT NULL,
    "sectorSummary" TEXT NOT NULL,
    "marketStats" TEXT NOT NULL,
    "northbound" TEXT,
    "aiSummary" TEXT,
    "aiHotTopics" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenResult" (
    "id" TEXT NOT NULL,
    "strategyName" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION,
    "reason" TEXT,
    "indicators" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeepResearch" (
    "id" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "fundamentals" TEXT,
    "technicals" TEXT,
    "catalysts" TEXT,
    "risks" TEXT,
    "valuation" TEXT,
    "conclusion" TEXT,
    "rating" TEXT,
    "targetPrice" DOUBLE PRECISION,
    "userId" TEXT NOT NULL,
    "stockId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeepResearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MorningBrief" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "limitUpAnalysis" TEXT,
    "premiumData" TEXT,
    "focusSectors" TEXT,
    "focusStocks" TEXT,
    "aiStrategy" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MorningBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSettings" (
    "id" TEXT NOT NULL,
    "maxDailyLoss" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "maxConsecutiveLoss" INTEGER NOT NULL DEFAULT 3,
    "maxSinglePosition" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "maxTotalPosition" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
    "totalCapital" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'watchlist',
    "stockCodes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardSnapshot" (
    "id" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "boardType" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "boardName" TEXT NOT NULL,
    "changePct" DOUBLE PRECISION NOT NULL,
    "limitUpCount" INTEGER NOT NULL,
    "mainNetInflow" DOUBLE PRECISION NOT NULL,
    "topStreak" INTEGER NOT NULL,
    "turnoverRate" DOUBLE PRECISION NOT NULL,
    "newsHeat" INTEGER NOT NULL,
    "strengthScore" DOUBLE PRECISION NOT NULL,
    "deltaScore" DOUBLE PRECISION,
    "accelScore" DOUBLE PRECISION,
    "stage" TEXT,
    "stageReason" TEXT,
    "leaderStocks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationEvent" (
    "id" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT NOT NULL,
    "boardType" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "boardName" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "ruleId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Stock_userId_groupId_idx" ON "Stock"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_userId_code_key" ON "Stock"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StockGroup_userId_name_key" ON "StockGroup"("userId", "name");

-- CreateIndex
CREATE INDEX "Event_stockId_eventDate_idx" ON "Event"("stockId", "eventDate");

-- CreateIndex
CREATE INDEX "Event_userId_createdAt_idx" ON "Event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchNote_stockId_idx" ON "ResearchNote"("stockId");

-- CreateIndex
CREATE INDEX "ValidationIndicator_stockId_idx" ON "ValidationIndicator"("stockId");

-- CreateIndex
CREATE INDEX "TradePlan_stockId_idx" ON "TradePlan"("stockId");

-- CreateIndex
CREATE INDEX "TradePlan_userId_status_idx" ON "TradePlan"("userId", "status");

-- CreateIndex
CREATE INDEX "TradeLog_tradePlanId_idx" ON "TradeLog"("tradePlanId");

-- CreateIndex
CREATE INDEX "TradeLog_userId_tradeTime_idx" ON "TradeLog"("userId", "tradeTime");

-- CreateIndex
CREATE INDEX "WeeklyReview_userId_weekStart_idx" ON "WeeklyReview"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_userId_weekStart_key" ON "WeeklyReview"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "DailyReview_userId_date_idx" ON "DailyReview"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReview_userId_date_key" ON "DailyReview"("userId", "date");

-- CreateIndex
CREATE INDEX "ScreenResult_userId_matchDate_idx" ON "ScreenResult"("userId", "matchDate");

-- CreateIndex
CREATE INDEX "ScreenResult_strategyName_matchDate_idx" ON "ScreenResult"("strategyName", "matchDate");

-- CreateIndex
CREATE INDEX "DeepResearch_userId_createdAt_idx" ON "DeepResearch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DeepResearch_stockCode_idx" ON "DeepResearch"("stockCode");

-- CreateIndex
CREATE INDEX "MorningBrief_userId_date_idx" ON "MorningBrief"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MorningBrief_userId_date_key" ON "MorningBrief"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSettings_userId_key" ON "RiskSettings"("userId");

-- CreateIndex
CREATE INDEX "AlertRule_userId_enabled_idx" ON "AlertRule"("userId", "enabled");

-- CreateIndex
CREATE INDEX "BoardSnapshot_tradeDate_boardType_strengthScore_idx" ON "BoardSnapshot"("tradeDate", "boardType", "strengthScore");

-- CreateIndex
CREATE INDEX "BoardSnapshot_boardType_boardId_tradeDate_timeSlot_idx" ON "BoardSnapshot"("boardType", "boardId", "tradeDate", "timeSlot");

-- CreateIndex
CREATE UNIQUE INDEX "BoardSnapshot_tradeDate_timeSlot_boardType_boardId_key" ON "BoardSnapshot"("tradeDate", "timeSlot", "boardType", "boardId");

-- CreateIndex
CREATE INDEX "RotationEvent_tradeDate_timestamp_idx" ON "RotationEvent"("tradeDate", "timestamp");

-- CreateIndex
CREATE INDEX "RotationEvent_boardType_boardId_tradeDate_idx" ON "RotationEvent"("boardType", "boardId", "tradeDate");

-- CreateIndex
CREATE INDEX "Alert_userId_read_createdAt_idx" ON "Alert"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_userId_createdAt_idx" ON "Alert"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_stockCode_createdAt_idx" ON "Alert"("stockCode", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StockGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockGroup" ADD CONSTRAINT "StockGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationIndicator" ADD CONSTRAINT "ValidationIndicator_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePlan" ADD CONSTRAINT "TradePlan_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePlan" ADD CONSTRAINT "TradePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeLog" ADD CONSTRAINT "TradeLog_tradePlanId_fkey" FOREIGN KEY ("tradePlanId") REFERENCES "TradePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeLog" ADD CONSTRAINT "TradeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReview" ADD CONSTRAINT "DailyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenResult" ADD CONSTRAINT "ScreenResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeepResearch" ADD CONSTRAINT "DeepResearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeepResearch" ADD CONSTRAINT "DeepResearch_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MorningBrief" ADD CONSTRAINT "MorningBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSettings" ADD CONSTRAINT "RiskSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
