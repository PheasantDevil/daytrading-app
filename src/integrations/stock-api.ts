// yahoo-finance2の代わりにモックデータを使用
// import * as yahooFinance from 'yahoo-finance2';

export interface StockApiResponse {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: Date;
}

export interface HistoricalData {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class StockApiService {
  private static instance: StockApiService;
  private rateLimitDelay = 1000; // 1秒間隔
  private lastRequestTime = 0;

  private constructor() {}

  public static getInstance(): StockApiService {
    if (!StockApiService.instance) {
      StockApiService.instance = new StockApiService();
    }
    return StockApiService.instance;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * モックデータを使用してリアルタイム株価を取得
   */
  async getRealTimePrice(symbol: string): Promise<StockApiResponse | null> {
    try {
      await this.rateLimit();

      // モックデータを生成
      const basePrice = 100 + Math.random() * 200;
      const change = (Math.random() - 0.5) * 20;
      const changePercent = (change / basePrice) * 100;

      return {
        symbol: symbol,
        price: basePrice,
        change: change,
        changePercent: changePercent,
        volume: Math.floor(Math.random() * 1000000),
        high: basePrice + Math.random() * 10,
        low: basePrice - Math.random() * 10,
        open: basePrice + (Math.random() - 0.5) * 5,
        close: basePrice,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`Error fetching real-time price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * モックデータを使用して履歴データを取得
   */
  async getHistoricalData(
    symbol: string,
    period1: Date,
    period2: Date,
    interval: '1d' | '1h' | '5m' | '1m' = '1d'
  ): Promise<HistoricalData[]> {
    try {
      await this.rateLimit();

      // モック履歴データを生成
      const days = Math.ceil(
        (period2.getTime() - period1.getTime()) / (1000 * 60 * 60 * 24)
      );
      const data: HistoricalData[] = [];
      const basePrice = 100 + Math.random() * 200;

      for (let i = 0; i < Math.min(days, 30); i++) {
        const date = new Date(period1.getTime() + i * 24 * 60 * 60 * 1000);
        const price = basePrice + (Math.random() - 0.5) * 40;

        data.push({
          symbol: symbol,
          date: date.toISOString().split('T')[0],
          open: price + (Math.random() - 0.5) * 5,
          high: price + Math.random() * 10,
          low: price - Math.random() * 10,
          close: price,
          volume: Math.floor(Math.random() * 100000),
        });
      }

      return data;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * 複数銘柄のリアルタイム価格を取得
   */
  async getMultipleRealTimePrices(
    symbols: string[]
  ): Promise<StockApiResponse[]> {
    const results: StockApiResponse[] = [];

    for (const symbol of symbols) {
      const price = await this.getRealTimePrice(symbol);
      if (price) {
        results.push(price);
      }
    }

    return results;
  }

  /**
   * 日本株のシンボルを変換（例: 7203.T -> 7203）
   */
  convertJapaneseSymbol(symbol: string): string {
    if (symbol.endsWith('.T')) {
      return symbol.slice(0, -2);
    }
    return symbol;
  }

  /**
   * 日本株のシンボルをYahoo Finance形式に変換
   */
  toYahooSymbol(symbol: string): string {
    if (!symbol.includes('.')) {
      return `${symbol}.T`;
    }
    return symbol;
  }
}

export const stockApiService = StockApiService.getInstance();
