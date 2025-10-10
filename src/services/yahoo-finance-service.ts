import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import yahooFinance from 'yahoo-finance2';

export interface YahooQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  timestamp: Date;
}

export interface YahooHistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;
}

export interface ScreeningCriteria {
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  sector?: string;
  industry?: string;
}

export class YahooFinanceService extends EventEmitter {
  private logger: Logger;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL: number = 60000; // 1分

  constructor() {
    super();
    this.logger = new Logger('YahooFinanceService');
  }

  /**
   * リアルタイム株価の取得
   */
  async getQuote(symbol: string): Promise<YahooQuote> {
    try {
      this.logger.debug(`株価取得: ${symbol}`);

      // キャッシュチェック
      const cached = this.getFromCache(symbol);
      if (cached) {
        return cached;
      }

      const quote = await yahooFinance.quote(symbol);

      const result: YahooQuote = {
        symbol: quote.symbol,
        price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        marketCap: quote.marketCap || 0,
        open: quote.regularMarketOpen || 0,
        high: quote.regularMarketDayHigh || 0,
        low: quote.regularMarketDayLow || 0,
        previousClose: quote.regularMarketPreviousClose || 0,
        timestamp: new Date(),
      };

      // キャッシュに保存
      this.setCache(symbol, result);

      return result;
    } catch (error) {
      this.logger.error(`株価取得エラー (${symbol}):`, error);
      throw error;
    }
  }

  /**
   * 複数銘柄の株価取得
   */
  async getQuotes(symbols: string[]): Promise<YahooQuote[]> {
    try {
      this.logger.info(`複数株価取得: ${symbols.length}銘柄`);

      const results: YahooQuote[] = [];

      for (const symbol of symbols) {
        try {
          const quote = await this.getQuote(symbol);
          results.push(quote);
        } catch (error) {
          this.logger.warn(`${symbol}の取得をスキップ:`, error);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('複数株価取得エラー:', error);
      throw error;
    }
  }

  /**
   * 履歴データの取得
   */
  async getHistoricalData(
    symbol: string,
    period1: Date | string,
    period2: Date | string = new Date(),
    interval: '1d' | '1wk' | '1mo' = '1d'
  ): Promise<YahooHistoricalData[]> {
    try {
      this.logger.info(`履歴データ取得: ${symbol}`);

      const result = await yahooFinance.historical(symbol, {
        period1,
        period2,
        interval,
      });

      return result.map((bar) => ({
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        adjustedClose: bar.adjClose || bar.close,
      }));
    } catch (error) {
      this.logger.error(`履歴データ取得エラー (${symbol}):`, error);
      throw error;
    }
  }

  /**
   * 銘柄検索
   */
  async search(query: string): Promise<
    Array<{
      symbol: string;
      name: string;
      exchange: string;
      type: string;
    }>
  > {
    try {
      this.logger.info(`銘柄検索: ${query}`);

      const results = await yahooFinance.search(query);

      return results.quotes.map((quote) => ({
        symbol: quote.symbol,
        name: quote.longname || quote.shortname || '',
        exchange: quote.exchange || '',
        type: quote.quoteType || '',
      }));
    } catch (error) {
      this.logger.error(`銘柄検索エラー (${query}):`, error);
      throw error;
    }
  }

  /**
   * 人気銘柄の取得（トレンド）
   */
  async getTrendingStocks(): Promise<string[]> {
    try {
      this.logger.info('トレンド銘柄取得');

      const trending = await yahooFinance.trendingSymbols('US');

      return trending.quotes.map((quote) => quote.symbol);
    } catch (error) {
      this.logger.error('トレンド銘柄取得エラー:', error);
      throw error;
    }
  }

  /**
   * 企業情報の取得
   */
  async getCompanyInfo(symbol: string): Promise<{
    symbol: string;
    name: string;
    sector: string;
    industry: string;
    description: string;
    website: string;
    employees: number;
  }> {
    try {
      this.logger.info(`企業情報取得: ${symbol}`);

      const quote = await yahooFinance.quote(symbol);

      return {
        symbol: quote.symbol,
        name: quote.longName || quote.shortName || '',
        sector: quote.sector || '',
        industry: quote.industry || '',
        description: quote.longBusinessSummary || '',
        website: quote.website || '',
        employees: quote.fullTimeEmployees || 0,
      };
    } catch (error) {
      this.logger.error(`企業情報取得エラー (${symbol}):`, error);
      throw error;
    }
  }

  /**
   * キャッシュから取得
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    this.logger.debug(`キャッシュヒット: ${key}`);
    return cached.data;
  }

  /**
   * キャッシュに保存
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * キャッシュクリア
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('キャッシュをクリアしました');
  }

  /**
   * キャッシュTTLの設定
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
    this.logger.info(`キャッシュTTLを${ttl}msに設定しました`);
  }
}

