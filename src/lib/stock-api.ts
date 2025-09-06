import axios from 'axios';
import yahooFinance from 'yahoo-finance2';

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
      await new Promise(resolve => 
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Yahoo Finance APIを使用してリアルタイム株価を取得
   */
  async getRealTimePrice(symbol: string): Promise<StockApiResponse | null> {
    try {
      await this.rateLimit();
      
      const result = await yahooFinance.quote(symbol);
      
      if (!result) {
        return null;
      }

      return {
        symbol: result.symbol || symbol,
        price: result.regularMarketPrice || 0,
        change: result.regularMarketChange || 0,
        changePercent: result.regularMarketChangePercent || 0,
        volume: result.regularMarketVolume || 0,
        high: result.regularMarketDayHigh || 0,
        low: result.regularMarketDayLow || 0,
        open: result.regularMarketOpen || 0,
        close: result.previousClose || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`Error fetching real-time price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * 履歴データを取得
   */
  async getHistoricalData(
    symbol: string,
    period1: Date,
    period2: Date,
    interval: '1d' | '1h' | '5m' | '1m' = '1d'
  ): Promise<HistoricalData[]> {
    try {
      await this.rateLimit();
      
      const result = await yahooFinance.historical(symbol, {
        period1,
        period2,
        interval,
      });

      return result.map(item => ({
        symbol: symbol,
        date: item.date.toISOString().split('T')[0],
        open: item.open || 0,
        high: item.high || 0,
        low: item.low || 0,
        close: item.close || 0,
        volume: item.volume || 0,
      }));
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * 複数銘柄のリアルタイム価格を取得
   */
  async getMultipleRealTimePrices(symbols: string[]): Promise<StockApiResponse[]> {
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
