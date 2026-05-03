import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Stock, StockGroup } from "@prisma/client";
import { StockQuote } from "@/lib/stock-api";

interface StockState {
  stocks: Stock[];
  groups: StockGroup[];
  activeGroupId: string | null;
  selectedStockCode: string | null;
  searchText: string;
  selectedTags: string[];
  quotes: Record<string, StockQuote>;
  isLoading: boolean;
}

interface StockActions {
  setStocks: (stocks: Stock[]) => void;
  setGroups: (groups: StockGroup[]) => void;
  setActiveGroup: (groupId: string | null) => void;
  selectStock: (code: string | null) => void;
  setSearchText: (text: string) => void;
  setSelectedTags: (tags: string[]) => void;
  updateQuote: (code: string, quote: StockQuote) => void;
  updateQuotes: (quotes: Record<string, StockQuote>) => void;
  setLoading: (loading: boolean) => void;
  addStock: (stock: Stock) => void;
  removeStock: (stockId: string) => void;
  updateStock: (stockId: string, data: Partial<Stock>) => void;
}

export const useStockStore = create<StockState & StockActions>()(
  immer((set) => ({
    stocks: [],
    groups: [],
    activeGroupId: null,
    selectedStockCode: null,
    searchText: "",
    selectedTags: [],
    quotes: {},
    isLoading: false,

    setStocks: (stocks) =>
      set((state) => {
        state.stocks = stocks;
      }),

    setGroups: (groups) =>
      set((state) => {
        state.groups = groups;
      }),

    setActiveGroup: (groupId) =>
      set((state) => {
        state.activeGroupId = groupId;
      }),

    selectStock: (code) =>
      set((state) => {
        state.selectedStockCode = code;
      }),

    setSearchText: (text) =>
      set((state) => {
        state.searchText = text;
      }),

    setSelectedTags: (tags) =>
      set((state) => {
        state.selectedTags = tags;
      }),

    updateQuote: (code, quote) =>
      set((state) => {
        state.quotes[code] = quote;
      }),

    updateQuotes: (quotes) =>
      set((state) => {
        Object.entries(quotes).forEach(([code, quote]) => {
          state.quotes[code] = quote;
        });
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    addStock: (stock) =>
      set((state) => {
        state.stocks.push(stock);
      }),

    removeStock: (stockId) =>
      set((state) => {
        state.stocks = state.stocks.filter((s) => s.id !== stockId);
      }),

    updateStock: (stockId, data) =>
      set((state) => {
        const index = state.stocks.findIndex((s) => s.id === stockId);
        if (index !== -1) {
          Object.assign(state.stocks[index], data);
        }
      }),
  }))
);
