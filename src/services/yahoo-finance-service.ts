import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

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

      // Yahoo Finance APIから取得（簡易実装）
      // 実際の実装では、公式APIまたはスクレイピングを使用
      // ここではダミーデータを返す
      const result: YahooQuote = {
        symbol,
        price: 150 + Math.random() * 50,
        change: (Math.random() - 0.5) * 10,
        changePercent: (Math.random() - 0.5) * 5,
        volume: Math.floor(1000000 + Math.random() * 5000000),
        marketCap: Math.floor(100000000000 + Math.random() * 900000000000),
        open: 150 + Math.random() * 50,
        high: 155 + Math.random() * 50,
        low: 145 + Math.random() * 50,
        previousClose: 150 + Math.random() * 50,
        timestamp: new Date(),
      };

      // キャッシュに保存
      this.setCache(symbol, result);

      this.logger.info(`✅ ${symbol}の株価を取得: $${result.price.toFixed(2)}`);
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

      // 簡易実装: 過去30日分のダミーデータを生成
      const start = typeof period1 === 'string' ? new Date(period1) : period1;
      const end = typeof period2 === 'string' ? new Date(period2) : period2;
      const days = Math.floor(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );

      const result: YahooHistoricalData[] = [];
      const basePrice = 150 + Math.random() * 50;

      for (let i = 0; i < Math.min(days, 30); i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);

        const variation = (Math.random() - 0.5) * basePrice * 0.05;
        const open = basePrice + variation;
        const close = basePrice + (Math.random() - 0.5) * basePrice * 0.05;
        const high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        const low = Math.min(open, close) - Math.random() * basePrice * 0.02;

        result.push({
          date,
          open,
          high,
          low,
          close,
          volume: Math.floor(1000000 + Math.random() * 5000000),
          adjustedClose: close,
        });
      }

      this.logger.info(`✅ ${symbol}の履歴データを取得: ${result.length}件`);
      return result;
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

      // 簡易実装: 主要銘柄のリストから検索
      const knownSymbols = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          exchange: 'NASDAQ',
          type: 'EQUITY',
        },
        {
          symbol: 'GOOGL',
          name: 'Alphabet Inc.',
          exchange: 'NASDAQ',
          type: 'EQUITY',
        },
        {
          symbol: 'MSFT',
          name: 'Microsoft Corporation',
          exchange: 'NASDAQ',
          type: 'EQUITY',
        },
        {
          symbol: 'TSLA',
          name: 'Tesla, Inc.',
          exchange: 'NASDAQ',
          type: 'EQUITY',
        },
        {
          symbol: 'AMZN',
          name: 'Amazon.com, Inc.',
          exchange: 'NASDAQ',
          type: 'EQUITY',
        },
        {
          symbol: 'META',
          name: 'Meta Platforms, Inc.',
          exchange: 'NASDAQ',
          type: 'EQUITY',
        },
        {
          symbol: 'NVDA',
          name: 'NVIDIA Corporation',
          exchange: 'NASDAQ',
          type: 'EQUITY',
        },
      ];

      const results = knownSymbols.filter(
        (s) =>
          s.symbol.toLowerCase().includes(query.toLowerCase()) ||
          s.name.toLowerCase().includes(query.toLowerCase())
      );

      this.logger.info(`✅ ${results.length}件の検索結果`);
      return results;
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

      // 簡易実装: 主要銘柄をトレンドとして返す
      const trending = [
        'AAPL',
        'GOOGL',
        'MSFT',
        'TSLA',
        'AMZN',
        'META',
        'NVDA',
      ];

      this.logger.info(`✅ ${trending.length}件のトレンド銘柄`);
      return trending;
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

      // 簡易実装: 主要企業の情報を返す
      const companyData: { [key: string]: any } = {
        AAPL: {
          name: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          description:
            'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.',
          website: 'https://www.apple.com',
          employees: 161000,
        },
        GOOGL: {
          name: 'Alphabet Inc.',
          sector: 'Communication Services',
          industry: 'Internet Content & Information',
          description:
            'Alphabet Inc. offers various products and platforms in the United States, Europe, the Middle East, Africa, the Asia-Pacific, Canada, and Latin America.',
          website: 'https://www.abc.xyz',
          employees: 190234,
        },
        MSFT: {
          name: 'Microsoft Corporation',
          sector: 'Technology',
          industry: 'Software - Infrastructure',
          description:
            'Microsoft Corporation develops, licenses, and supports software, services, devices, and solutions worldwide.',
          website: 'https://www.microsoft.com',
          employees: 221000,
        },
      };

      const data = companyData[symbol] || {
        name: `${symbol} Corporation`,
        sector: 'Unknown',
        industry: 'Unknown',
        description: 'Company information not available',
        website: '',
        employees: 0,
      };

      const result = {
        symbol,
        ...data,
      };

      this.logger.info(`✅ ${symbol}の企業情報を取得`);
      return result;
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
