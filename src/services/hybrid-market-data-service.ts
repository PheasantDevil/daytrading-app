import { EventEmitter } from 'events';
import { InteractiveBrokersIntegration } from '../brokers/interactive-brokers-integration';
import { Logger } from '../utils/logger';
import {
  YahooFinanceService,
  YahooHistoricalData,
} from './yahoo-finance-service';

export interface HybridMarketDataConfig {
  mode: 'development' | 'production';
  dataSource: {
    screening: 'yahoo' | 'ib';
    historical: 'yahoo' | 'ib';
    realtime: 'yahoo' | 'ib' | 'both';
    trading: 'ib';
  };
  yahoo: {
    enabled: boolean;
    cacheTTL: number;
  };
  ib: {
    enabled: boolean;
    useRealAPI: boolean; // false = モックAPI使用
  };
}

export interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  source: 'yahoo' | 'ib';
}

export class HybridMarketDataService extends EventEmitter {
  private logger: Logger;
  private config: HybridMarketDataConfig;
  private yahooFinanceService: YahooFinanceService;
  private ibIntegration?: InteractiveBrokersIntegration;

  constructor(
    config: HybridMarketDataConfig,
    ibIntegration?: InteractiveBrokersIntegration
  ) {
    super();
    this.config = config;
    this.logger = new Logger('HybridMarketDataService');
    this.yahooFinanceService = new YahooFinanceService();
    this.ibIntegration = ibIntegration;
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('ハイブリッド市場データサービスを初期化中...');
      this.logger.info(`モード: ${this.config.mode}`);
      this.logger.info(
        `データソース - スクリーニング: ${this.config.dataSource.screening}, リアルタイム: ${this.config.dataSource.realtime}`
      );

      // Yahoo Finance設定
      if (this.config.yahoo.enabled) {
        this.yahooFinanceService.setCacheTTL(this.config.yahoo.cacheTTL);
        this.logger.info('✅ Yahoo Financeサービスを有効化');
      }

      // Interactive Brokers設定
      if (this.config.ib.enabled && this.ibIntegration) {
        this.logger.info(
          `✅ Interactive Brokersサービスを有効化 (${this.config.ib.useRealAPI ? '実API' : 'モックAPI'})`
        );
      }

      this.logger.info('✅ ハイブリッド市場データサービスの初期化完了');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('初期化エラー:', error);
      throw error;
    }
  }

  /**
   * 市場データの取得（ハイブリッド）
   */
  async getMarketData(symbol: string): Promise<MarketData> {
    try {
      // リアルタイムデータソースの選択
      if (
        this.config.dataSource.realtime === 'ib' &&
        this.ibIntegration &&
        this.config.ib.enabled
      ) {
        return await this.getMarketDataFromIB(symbol);
      } else if (
        this.config.dataSource.realtime === 'yahoo' ||
        this.config.dataSource.realtime === 'both'
      ) {
        return await this.getMarketDataFromYahoo(symbol);
      } else {
        // デフォルトはYahoo Finance
        return await this.getMarketDataFromYahoo(symbol);
      }
    } catch (error) {
      this.logger.error(`市場データ取得エラー (${symbol}):`, error);
      throw error;
    }
  }

  /**
   * Yahoo Financeから市場データ取得
   */
  private async getMarketDataFromYahoo(symbol: string): Promise<MarketData> {
    const quote = await this.yahooFinanceService.getQuote(symbol);

    return {
      symbol: quote.symbol,
      price: quote.price,
      bid: quote.price - 0.05, // Yahooには板情報がないため推定
      ask: quote.price + 0.05,
      volume: quote.volume,
      high: quote.high,
      low: quote.low,
      open: quote.open,
      previousClose: quote.previousClose,
      change: quote.change,
      changePercent: quote.changePercent,
      timestamp: quote.timestamp,
      source: 'yahoo',
    };
  }

  /**
   * Interactive Brokersから市場データ取得
   */
  private async getMarketDataFromIB(symbol: string): Promise<MarketData> {
    if (!this.ibIntegration) {
      throw new Error('Interactive Brokersが初期化されていません');
    }

    const ibData = await this.ibIntegration.getMarketData(symbol);

    return {
      symbol: ibData.symbol,
      price: ibData.price,
      bid: ibData.bid,
      ask: ibData.ask,
      volume: ibData.volume,
      high: ibData.high24h,
      low: ibData.low24h,
      open: ibData.price, // IBモックには開始価格がないため現在価格を使用
      previousClose: ibData.price - ibData.change24h,
      change: ibData.change24h,
      changePercent: ibData.changePercent24h,
      timestamp: ibData.timestamp,
      source: 'ib',
    };
  }

  /**
   * 複数銘柄の市場データ取得
   */
  async getMultipleMarketData(symbols: string[]): Promise<MarketData[]> {
    try {
      this.logger.info(`複数市場データ取得: ${symbols.length}銘柄`);

      const results: MarketData[] = [];

      for (const symbol of symbols) {
        try {
          const data = await this.getMarketData(symbol);
          results.push(data);
        } catch (error) {
          this.logger.warn(`${symbol}の取得をスキップ:`, error);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('複数市場データ取得エラー:', error);
      throw error;
    }
  }

  /**
   * 履歴データの取得（Yahoo Finance使用）
   */
  async getHistoricalData(
    symbol: string,
    startDate: Date | string,
    endDate: Date | string = new Date(),
    interval: '1d' | '1wk' | '1mo' = '1d'
  ): Promise<YahooHistoricalData[]> {
    return this.yahooFinanceService.getHistoricalData(
      symbol,
      startDate,
      endDate,
      interval
    );
  }

  /**
   * 銘柄検索（Yahoo Finance使用）
   */
  async searchSymbols(query: string): Promise<
    Array<{
      symbol: string;
      name: string;
      exchange: string;
      type: string;
    }>
  > {
    return this.yahooFinanceService.search(query);
  }

  /**
   * トレンド銘柄の取得（Yahoo Finance使用）
   */
  async getTrendingStocks(): Promise<string[]> {
    return this.yahooFinanceService.getTrendingStocks();
  }

  /**
   * 企業情報の取得（Yahoo Finance使用）
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
    return this.yahooFinanceService.getCompanyInfo(symbol);
  }

  /**
   * 銘柄スクリーニング（Yahoo Finance使用）
   */
  async screenStocks(criteria: {
    minPrice?: number;
    maxPrice?: number;
    minVolume?: number;
    symbols?: string[];
  }): Promise<string[]> {
    try {
      this.logger.info('銘柄スクリーニング実行');

      const symbols = criteria.symbols || [
        'AAPL',
        'GOOGL',
        'MSFT',
        'TSLA',
        'AMZN',
        'META',
        'NVDA',
      ];
      const quotes = await this.yahooFinanceService.getQuotes(symbols);

      const filtered = quotes.filter((quote) => {
        if (criteria.minPrice && quote.price < criteria.minPrice) return false;
        if (criteria.maxPrice && quote.price > criteria.maxPrice) return false;
        if (criteria.minVolume && quote.volume < criteria.minVolume)
          return false;
        return true;
      });

      return filtered.map((q) => q.symbol);
    } catch (error) {
      this.logger.error('銘柄スクリーニングエラー:', error);
      throw error;
    }
  }

  /**
   * データソースの切り替え
   */
  switchDataSource(
    source: 'yahoo' | 'ib',
    type: 'realtime' | 'historical' | 'screening'
  ): void {
    if (type === 'realtime') {
      this.config.dataSource.realtime = source;
    } else if (type === 'historical') {
      this.config.dataSource.historical = source;
    } else if (type === 'screening') {
      this.config.dataSource.screening = source;
    }

    this.logger.info(`データソースを切り替え: ${type} -> ${source}`);
    this.emit('dataSourceChanged', { type, source });
  }

  /**
   * 統計情報の取得
   */
  getStats(): {
    cacheSize: number;
    yahooEnabled: boolean;
    ibEnabled: boolean;
    mode: string;
  } {
    return {
      cacheSize: 0, // cache property does not exist
      yahooEnabled: this.config.yahoo.enabled,
      ibEnabled: this.config.ib.enabled,
      mode: this.config.mode,
    };
  }
}
