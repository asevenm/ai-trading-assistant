import { Stock, StockGroup, Event } from "@prisma/client";
import { StockQuote } from "@/lib/stock-api";

export type StockWithRelations = Stock & {
  group?: StockGroup | null;
  events?: Event[];
};

export interface StockCardData extends StockWithRelations {
  quote?: StockQuote | null;
  todayEvents?: Event[];
}

export type EventType = "earnings" | "order" | "policy" | "announcement" | "other";
export type ImpactDirection = "positive" | "negative" | "neutral";
export type ImpactDuration = "short" | "medium" | "long";

export interface EventCardInput {
  newsTitle: string;
  newsContent: string;
  stockCode: string;
  stockName: string;
}

export interface EventCardOutput {
  title: string;
  summary: string;
  type: EventType;
  impactDirection: ImpactDirection;
  impactDuration: ImpactDuration;
}

export interface TradeStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  totalPnL: number;
  maxDrawdown: number;
  tradesByReason: Record<
    string,
    {
      count: number;
      winRate: number;
      totalPnL: number;
    }
  >;
}

export interface WeeklyReviewOutput {
  summary: string;
  analysis: string;
  improvements: string[];
}
