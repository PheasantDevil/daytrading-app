/**
 * データ統合サービス
 * 複数のデータソース（J-Quants、Yahoo Finance、Alpha Vantage、IEX Cloud）を統合
 */

export interface StockData {
  symbol: string;
  market: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
  source: string;
}

export interface HistoricalData {
  symbol: string;
  market: string;
  data: Array<{
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  source: string;
}

export interface DataApi {
  name: string;
  priority: number;
  isAvailable: boolean;
  getStockData(symbol: string, market: string): Promise<StockData | null>;
  getHistoricalData(
    symbol: string,
    market: string,
    days: number
  ): Promise<HistoricalData | null>;
  getRealTimeData(symbol: string): Promise<StockData | null>;
}

export interface DataIntegrationConfig {
  cacheEnabled: boolean;
  cacheExpiry: number; // ミリ秒
  fallbackEnabled: boolean;
  maxRetries: number;
  retryDelay: number; // ミリ秒
}

export class DataIntegrationService {
  private apis: Map<string, DataApi> = new Map();
  private config: DataIntegrationConfig;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private fallbackOrder: string[] = [];

  constructor(config: DataIntegrationConfig) {
    this.config = config;
    this.initializeApis();
  }

  /**
   * APIを初期化
   */
  private initializeApis(): void {
    // J-Quants API（日本株データ）
    this.apis.set('jquants', new JQuantsApi());

    // Yahoo Finance API（米国株データ）
    this.apis.set('yahoo', new YahooFinanceApi());

    // Alpha Vantage API（補完データ）
    this.apis.set('alphavantage', new AlphaVantageApi());

    // IEX Cloud API（高品質米国株データ）
    this.apis.set('iex', new IexCloudApi());

    // フォールバック順序を設定
    this.fallbackOrder = ['jquants', 'yahoo', 'alphavantage', 'iex'];
  }

  /**
   * 株価データを取得
   */
  async getStockData(
    symbol: string,
    market: string
  ): Promise<StockData | null> {
    const cacheKey = `stock_${symbol}_${market}`;

    // キャッシュチェック
    if (this.config.cacheEnabled) {
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // APIからデータ取得
    for (const apiName of this.fallbackOrder) {
      const api = this.apis.get(apiName);
      if (!api || !api.isAvailable) continue;

      try {
        const data = await api.getStockData(symbol, market);
        if (data) {
          // キャッシュに保存
          if (this.config.cacheEnabled) {
            this.setCachedData(cacheKey, data);
          }
          return data;
        }
      } catch (error) {
        console.error(`❌ ${apiName} API エラー:`, error);
        continue;
      }
    }

    console.error(`❌ 全APIでデータ取得失敗: ${symbol} (${market})`);
    return null;
  }

  /**
   * 履歴データを取得
   */
  async getHistoricalData(
    symbol: string,
    market: string,
    days: number = 30
  ): Promise<HistoricalData | null> {
    const cacheKey = `historical_${symbol}_${market}_${days}`;

    // キャッシュチェック
    if (this.config.cacheEnabled) {
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // APIからデータ取得
    for (const apiName of this.fallbackOrder) {
      const api = this.apis.get(apiName);
      if (!api || !api.isAvailable) continue;

      try {
        const data = await api.getHistoricalData(symbol, market, days);
        if (data) {
          // キャッシュに保存
          if (this.config.cacheEnabled) {
            this.setCachedData(cacheKey, data);
          }
          return data;
        }
      } catch (error) {
        console.error(`❌ ${apiName} API エラー:`, error);
        continue;
      }
    }

    console.error(`❌ 全APIで履歴データ取得失敗: ${symbol} (${market})`);
    return null;
  }

  /**
   * リアルタイムデータを取得
   */
  async getRealTimeData(symbol: string): Promise<StockData | null> {
    const cacheKey = `realtime_${symbol}`;

    // リアルタイムデータはキャッシュしない
    for (const apiName of this.fallbackOrder) {
      const api = this.apis.get(apiName);
      if (!api || !api.isAvailable) continue;

      try {
        const data = await api.getRealTimeData(symbol);
        if (data) {
          return data;
        }
      } catch (error) {
        console.error(`❌ ${apiName} API エラー:`, error);
        continue;
      }
    }

    console.error(`❌ 全APIでリアルタイムデータ取得失敗: ${symbol}`);
    return null;
  }

  /**
   * 複数銘柄のデータを一括取得
   */
  async getMultipleStockData(
    symbols: string[],
    market: string
  ): Promise<Map<string, StockData>> {
    const results = new Map<string, StockData>();

    const promises = symbols.map(async (symbol) => {
      try {
        const data = await this.getStockData(symbol, market);
        if (data) {
          results.set(symbol, data);
        }
      } catch (error) {
        console.error(`❌ ${symbol} データ取得エラー:`, error);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * APIの可用性をチェック
   */
  async checkApiAvailability(): Promise<Map<string, boolean>> {
    const availability = new Map<string, boolean>();

    for (const [name, api] of this.apis) {
      try {
        // テスト用のデータ取得
        await api.getStockData('AAPL', 'US');
        availability.set(name, true);
      } catch (error) {
        availability.set(name, false);
      }
    }

    return availability;
  }

  /**
   * キャッシュデータを取得
   */
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    return null;
  }

  /**
   * キャッシュデータを設定
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.config.cacheExpiry,
    });
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<DataIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): DataIntegrationConfig {
    return { ...this.config };
  }
}

/**
 * J-Quants API実装
 */
class JQuantsApi implements DataApi {
  name = 'J-Quants';
  priority = 1;
  isAvailable = true;
  private baseUrl = 'https://api.jquants.com/v1';
  private apiKey = process.env.JQUANTS_API_KEY || '';

  async getStockData(
    symbol: string,
    market: string
  ): Promise<StockData | null> {
    if (market !== 'JP') return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/prices/daily_quotes?code=${symbol}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data.daily_quotes && data.daily_quotes.length > 0) {
        const quote = data.daily_quotes[0];
        return {
          symbol,
          market,
          price: quote.Close,
          change: quote.Close - quote.Open,
          changePercent: ((quote.Close - quote.Open) / quote.Open) * 100,
          volume: quote.Volume,
          timestamp: new Date(quote.Date),
          source: this.name,
        };
      }
    } catch (error) {
      console.error('J-Quants API エラー:', error);
    }

    return null;
  }

  async getHistoricalData(
    symbol: string,
    market: string,
    days: number
  ): Promise<HistoricalData | null> {
    if (market !== 'JP') return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/prices/daily_quotes?code=${symbol}&date_from=${this.getDateFrom(days)}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data.daily_quotes) {
        return {
          symbol,
          market,
          data: data.daily_quotes.map((quote: any) => ({
            date: new Date(quote.Date),
            open: quote.Open,
            high: quote.High,
            low: quote.Low,
            close: quote.Close,
            volume: quote.Volume,
          })),
          source: this.name,
        };
      }
    } catch (error) {
      console.error('J-Quants API エラー:', error);
    }

    return null;
  }

  async getRealTimeData(symbol: string): Promise<StockData | null> {
    // J-Quantsはリアルタイムデータを提供しない
    return null;
  }

  private getDateFrom(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}

/**
 * Yahoo Finance API実装
 */
class YahooFinanceApi implements DataApi {
  name = 'Yahoo Finance';
  priority = 2;
  isAvailable = true;
  private baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';

  async getStockData(
    symbol: string,
    market: string
  ): Promise<StockData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${symbol}`);

      if (!response.ok) return null;

      const data = await response.json();
      if (data.chart && data.chart.result && data.chart.result.length > 0) {
        const result = data.chart.result[0];
        const meta = result.meta;
        const quote = result.indicators.quote[0];

        return {
          symbol,
          market,
          price: meta.regularMarketPrice,
          change: meta.regularMarketPrice - meta.previousClose,
          changePercent:
            ((meta.regularMarketPrice - meta.previousClose) /
              meta.previousClose) *
            100,
          volume: meta.regularMarketVolume,
          timestamp: new Date(meta.regularMarketTime * 1000),
          source: this.name,
        };
      }
    } catch (error) {
      console.error('Yahoo Finance API エラー:', error);
    }

    return null;
  }

  async getHistoricalData(
    symbol: string,
    market: string,
    days: number
  ): Promise<HistoricalData | null> {
    try {
      const period1 = Math.floor(
        (Date.now() - days * 24 * 60 * 60 * 1000) / 1000
      );
      const period2 = Math.floor(Date.now() / 1000);

      const response = await fetch(
        `${this.baseUrl}/${symbol}?period1=${period1}&period2=${period2}&interval=1d`
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data.chart && data.chart.result && data.chart.result.length > 0) {
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];

        return {
          symbol,
          market,
          data: timestamps.map((timestamp: number, index: number) => ({
            date: new Date(timestamp * 1000),
            open: quotes.open[index],
            high: quotes.high[index],
            low: quotes.low[index],
            close: quotes.close[index],
            volume: quotes.volume[index],
          })),
          source: this.name,
        };
      }
    } catch (error) {
      console.error('Yahoo Finance API エラー:', error);
    }

    return null;
  }

  async getRealTimeData(symbol: string): Promise<StockData | null> {
    return await this.getStockData(symbol, 'US');
  }
}

/**
 * Alpha Vantage API実装
 */
class AlphaVantageApi implements DataApi {
  name = 'Alpha Vantage';
  priority = 3;
  isAvailable = true;
  private baseUrl = 'https://www.alphavantage.co/query';
  private apiKey = process.env.ALPHA_VANTAGE_API_KEY || '';

  async getStockData(
    symbol: string,
    market: string
  ): Promise<StockData | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data['Global Quote']) {
        const quote = data['Global Quote'];
        return {
          symbol,
          market,
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: parseFloat(
            quote['10. change percent'].replace('%', '')
          ),
          volume: parseInt(quote['06. volume']),
          timestamp: new Date(),
          source: this.name,
        };
      }
    } catch (error) {
      console.error('Alpha Vantage API エラー:', error);
    }

    return null;
  }

  async getHistoricalData(
    symbol: string,
    market: string,
    days: number
  ): Promise<HistoricalData | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${this.apiKey}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data['Time Series (Daily)']) {
        const timeSeries = data['Time Series (Daily)'];
        const dates = Object.keys(timeSeries).slice(0, days);

        return {
          symbol,
          market,
          data: dates.map((date) => ({
            date: new Date(date),
            open: parseFloat(timeSeries[date]['1. open']),
            high: parseFloat(timeSeries[date]['2. high']),
            low: parseFloat(timeSeries[date]['3. low']),
            close: parseFloat(timeSeries[date]['4. close']),
            volume: parseInt(timeSeries[date]['5. volume']),
          })),
          source: this.name,
        };
      }
    } catch (error) {
      console.error('Alpha Vantage API エラー:', error);
    }

    return null;
  }

  async getRealTimeData(symbol: string): Promise<StockData | null> {
    return await this.getStockData(symbol, 'US');
  }
}

/**
 * IEX Cloud API実装
 */
class IexCloudApi implements DataApi {
  name = 'IEX Cloud';
  priority = 4;
  isAvailable = true;
  private baseUrl = 'https://cloud.iexapis.com/stable';
  private apiKey = process.env.IEX_CLOUD_API_KEY || '';

  async getStockData(
    symbol: string,
    market: string
  ): Promise<StockData | null> {
    if (market !== 'US') return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/stock/${symbol}/quote?token=${this.apiKey}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      return {
        symbol,
        market,
        price: data.latestPrice,
        change: data.change,
        changePercent: data.changePercent * 100,
        volume: data.latestVolume,
        timestamp: new Date(data.latestUpdate),
        source: this.name,
      };
    } catch (error) {
      console.error('IEX Cloud API エラー:', error);
    }

    return null;
  }

  async getHistoricalData(
    symbol: string,
    market: string,
    days: number
  ): Promise<HistoricalData | null> {
    if (market !== 'US') return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/stock/${symbol}/chart/${days}d?token=${this.apiKey}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      return {
        symbol,
        market,
        data: data.map((item: any) => ({
          date: new Date(item.date),
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume,
        })),
        source: this.name,
      };
    } catch (error) {
      console.error('IEX Cloud API エラー:', error);
    }

    return null;
  }

  async getRealTimeData(symbol: string): Promise<StockData | null> {
    return await this.getStockData(symbol, 'US');
  }
}
