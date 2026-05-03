export interface StockQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: Date;
}

export interface KlineItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  changePercent: number;
  turnoverRate: number;
}

export type KlinePeriod = "daily" | "weekly" | "monthly";

export interface TimelinePoint {
  time: string;
  price: number;
  avgPrice: number;
  volume: number;
}

export interface TimelineData {
  preClose: number;
  points: TimelinePoint[];
}

export interface StockInfo {
  code: string;
  name: string;
  market: "SH" | "SZ" | "HK";
}

// 东方财富 API 返回数据接口
interface EastMoneyQuoteData {
  f43: number; // 现价 (需除以100)
  f44: number; // 最高价 (需除以100)
  f45: number; // 最低价 (需除以100)
  f46: number; // 开盘价 (需除以100)
  f47: number; // 成交量 (手)
  f48: number; // 成交额 (元)
  f57: string; // 股票代码
  f58: string; // 股票名称
  f60: number; // 昨收 (需除以100)
  f169: number; // 涨跌额 (需除以100)
  f170: number; // 涨跌幅 (需除以100, %)
}

interface EastMoneyResponse {
  rc: number;
  rt: number;
  svr: number;
  lt: number;
  full: number;
  data: EastMoneyQuoteData | null;
}

// 获取东方财富 secid: 沪市=1, 深市=0, 港股=116
export function getSecId(code: string, market?: string): string {
  if (market === "HK" || isHKCode(code)) {
    return `116.${code}`;
  }
  const m = code.startsWith("6") ? "1" : "0";
  return `${m}.${code}`;
}

// 判断是否为港股代码 (5位纯数字)
export function isHKCode(code: string): boolean {
  return /^\d{5}$/.test(code);
}

// 解析东方财富返回数据
function parseEastMoneyQuote(data: EastMoneyQuoteData): StockQuote {
  const price = data.f43 / 100;
  const prevClose = data.f60 / 100;

  return {
    code: data.f57,
    name: data.f58,
    price,
    open: data.f46 / 100,
    high: data.f44 / 100,
    low: data.f45 / 100,
    prevClose,
    volume: data.f47, // 成交量(手)
    turnover: data.f48, // 成交额(元)
    change: data.f169 / 100,
    changePercent: data.f170 / 100,
    timestamp: new Date(),
  };
}

export async function getStockQuote(code: string): Promise<StockQuote | null> {
  try {
    const secid = getSecId(code);
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170`;

    const response = await fetch(url, {
      headers: {
        Referer: "https://quote.eastmoney.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 5 },
    });

    const result: EastMoneyResponse = await response.json();

    if (result.rc !== 0 || !result.data) {
      return null;
    }

    return parseEastMoneyQuote(result.data);
  } catch (error) {
    console.error("Failed to fetch stock quote:", error);
    return null;
  }
}

export async function getMultipleQuotes(
  codes: string[]
): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>();

  if (codes.length === 0) return results;

  try {
    // 使用并发请求获取多个股票行情
    const promises = codes.map(async (code) => {
      const quote = await getStockQuote(code);
      if (quote) {
        return { code, quote };
      }
      return null;
    });

    const responses = await Promise.all(promises);

    responses.forEach((item) => {
      if (item) {
        results.set(item.code, item.quote);
      }
    });
  } catch (error) {
    console.error("Failed to fetch multiple quotes:", error);
  }

  return results;
}

// 新浪K线 scale 映射: 240=日K, 1680=周K, 7200=月K
const KLINE_SCALE_MAP: Record<KlinePeriod, string> = {
  daily: "240",
  weekly: "1680",
  monthly: "7200",
};

interface SinaKlineItem {
  day: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export async function getKlineData(
  code: string,
  period: KlinePeriod = "daily",
  limit: number = 120
): Promise<KlineItem[]> {
  // 港股使用东方财富 kline API (新浪不支持港股)
  if (isHKCode(code)) {
    return getKlineDataFromEastMoney(code, period, limit);
  }

  try {
    const symbol = code.startsWith("6") ? `sh${code}` : `sz${code}`;
    const scale = KLINE_SCALE_MAP[period];
    const url =
      `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData` +
      `?symbol=${symbol}&scale=${scale}&ma=no&datalen=${limit}`;

    const response = await fetch(url, {
      headers: {
        Referer: "https://finance.sina.com.cn/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 60 },
    });

    const result: SinaKlineItem[] = await response.json();

    if (!Array.isArray(result)) return [];

    return result.map((item, i) => {
      const close = parseFloat(item.close);
      const prevClose = i > 0 ? parseFloat(result[i - 1].close) : close;
      const changePercent =
        i > 0 ? ((close - prevClose) / prevClose) * 100 : 0;

      return {
        date: item.day,
        open: parseFloat(item.open),
        close,
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        volume: parseFloat(item.volume),
        turnover: 0,
        changePercent,
        turnoverRate: 0,
      };
    });
  } catch (error) {
    console.error("Failed to fetch kline data:", error);
    return [];
  }
}

// 港股 K线: 使用东方财富 kline API
const KLT_MAP: Record<KlinePeriod, string> = {
  daily: "101",
  weekly: "102",
  monthly: "103",
};

async function getKlineDataFromEastMoney(
  code: string,
  period: KlinePeriod,
  limit: number
): Promise<KlineItem[]> {
  try {
    const secid = getSecId(code);
    const klt = KLT_MAP[period];
    const url =
      `https://push2his.eastmoney.com/api/qt/stock/kline/get` +
      `?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6` +
      `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
      `&klt=${klt}&fqt=1&end=20500101&lmt=${limit}`;

    const response = await fetch(url, {
      headers: {
        Referer: "https://quote.eastmoney.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 60 },
    });
    const result = await response.json();

    if (!result.data?.klines) return [];

    return (result.data.klines as string[]).map((line) => {
      const parts = line.split(",");
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseFloat(parts[5]),
        turnover: parseFloat(parts[6]),
        changePercent: parseFloat(parts[8]) || 0,
        turnoverRate: 0,
      };
    });
  } catch (error) {
    console.error("Failed to fetch HK kline data:", error);
    return [];
  }
}

// 东方财富分时数据 (trends2 API)
// 格式: "时间,开,收,高,低,成交量(手),成交额,均价"
export async function getTimelineData(
  code: string
): Promise<TimelineData | null> {
  try {
    const secid = getSecId(code);
    const url =
      `https://push2.eastmoney.com/api/qt/stock/trends2/get` +
      `?secid=${secid}` +
      `&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13` +
      `&fields2=f51,f52,f53,f54,f55,f56,f57,f58` +
      `&iscr=0&ndays=1` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b`;

    const response = await fetch(url, {
      headers: {
        Referer: "https://quote.eastmoney.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 10 },
    });

    const result = await response.json();

    if (result.rc !== 0 || !result.data?.trends) return null;

    const preClose: number = result.data.preClose;
    const points: TimelinePoint[] = (result.data.trends as string[]).map(
      (line: string) => {
        const parts = line.split(",");
        return {
          time: parts[0],
          price: parseFloat(parts[2]),
          avgPrice: parseFloat(parts[7]),
          volume: parseFloat(parts[5]),
        };
      }
    );

    return { preClose, points };
  } catch (error) {
    console.error("Failed to fetch timeline data:", error);
    return null;
  }
}

export async function searchStocks(keyword: string): Promise<StockInfo[]> {
  try {
    const response = await fetch(
      `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(
        keyword
      )}&type=14&count=20`,
      { next: { revalidate: 60 } }
    );

    const data = await response.json();

    if (!data.QuotationCodeTable?.Data) return [];

    return data.QuotationCodeTable.Data.filter(
      (item: { QuoteID: string }) =>
        item.QuoteID?.startsWith("1.") ||
        item.QuoteID?.startsWith("0.") ||
        item.QuoteID?.startsWith("116.")
    ).map((item: { Code: string; Name: string; QuoteID: string }) => {
      const quoteId = item.QuoteID || "";
      let market: "SH" | "SZ" | "HK";
      if (quoteId.startsWith("116.")) {
        market = "HK";
      } else if (quoteId.startsWith("1.")) {
        market = "SH";
      } else {
        market = "SZ";
      }
      return {
        code: item.Code,
        name: item.Name,
        market,
      };
    });
  } catch (error) {
    console.error("Failed to search stocks:", error);
    return [];
  }
}
