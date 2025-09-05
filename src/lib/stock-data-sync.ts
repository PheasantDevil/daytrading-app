import { prisma } from './database';
import { redis } from './redis';
import { stockApiService, StockApiResponse } from './stock-api';

export class StockDataSyncService {
  private static instance: StockDataSyncService;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): StockDataSyncService {
    if (!StockDataSyncService.instance) {
      StockDataSyncService.instance = new StockDataSyncService();
    }
    return StockDataSyncService.instance;
  }

  /**
   * 全銘柄の株価データを同期
   */
  async syncAllStockPrices(): Promise<void> {
    if (this.isRunning) {
      console.log('Stock data sync is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting stock data sync...');

    try {
      // データベースから全銘柄を取得
      const stocks = await prisma.stock.findMany({
        select: {
          id: true,
          symbol: true,
        },
      });

      console.log(`Found ${stocks.length} stocks to sync`);

      // バッチ処理で株価を取得
      const batchSize = 10;
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        await this.syncBatch(batch);
        
        // レート制限を考慮して待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('Stock data sync completed');
    } catch (error) {
      console.error('Error during stock data sync:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * バッチで株価データを同期
   */
  private async syncBatch(stocks: { id: number; symbol: string }[]): Promise<void> {
    const symbols = stocks.map(stock => stockApiService.toYahooSymbol(stock.symbol));
    
    try {
      const prices = await stockApiService.getMultipleRealTimePrices(symbols);
      
      for (const price of prices) {
        const originalSymbol = stockApiService.convertJapaneseSymbol(price.symbol);
        const stock = stocks.find(s => s.symbol === originalSymbol);
        
        if (stock) {
          await this.saveStockPrice(stock.id, price);
        }
      }
    } catch (error) {
      console.error('Error syncing batch:', error);
    }
  }

  /**
   * 株価データをデータベースに保存
   */
  private async saveStockPrice(stockId: number, price: StockApiResponse): Promise<void> {
    try {
      await prisma.stockPrice.create({
        data: {
          stockId,
          price: price.price,
          volume: BigInt(price.volume),
          high: price.high,
          low: price.low,
          open: price.open,
          close: price.close,
          timestamp: price.timestamp,
        },
      });

      // Redisにキャッシュ
      await redis.setex(
        `stock:${stockId}:latest`,
        300, // 5分間キャッシュ
        JSON.stringify(price)
      );

      console.log(`Saved price for stock ${stockId}: ${price.price}`);
    } catch (error) {
      console.error(`Error saving price for stock ${stockId}:`, error);
    }
  }

  /**
   * 特定銘柄の株価データを同期
   */
  async syncStockPrice(stockId: number, symbol: string): Promise<StockApiResponse | null> {
    try {
      const yahooSymbol = stockApiService.toYahooSymbol(symbol);
      const price = await stockApiService.getRealTimePrice(yahooSymbol);
      
      if (price) {
        await this.saveStockPrice(stockId, price);
      }
      
      return price;
    } catch (error) {
      console.error(`Error syncing price for stock ${stockId}:`, error);
      return null;
    }
  }

  /**
   * 履歴データを同期
   */
  async syncHistoricalData(
    stockId: number,
    symbol: string,
    days: number = 30
  ): Promise<void> {
    try {
      const yahooSymbol = stockApiService.toYahooSymbol(symbol);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const historicalData = await stockApiService.getHistoricalData(
        yahooSymbol,
        startDate,
        endDate,
        '1d'
      );

      for (const data of historicalData) {
        await prisma.stockPrice.upsert({
          where: {
            stockId_timestamp: {
              stockId,
              timestamp: new Date(data.date),
            },
          },
          update: {
            price: data.close,
            volume: BigInt(data.volume),
            high: data.high,
            low: data.low,
            open: data.open,
            close: data.close,
          },
          create: {
            stockId,
            price: data.close,
            volume: BigInt(data.volume),
            high: data.high,
            low: data.low,
            open: data.open,
            close: data.close,
            timestamp: new Date(data.date),
          },
        });
      }

      console.log(`Synced ${historicalData.length} historical records for stock ${stockId}`);
    } catch (error) {
      console.error(`Error syncing historical data for stock ${stockId}:`, error);
    }
  }

  /**
   * キャッシュから最新価格を取得
   */
  async getCachedPrice(stockId: number): Promise<StockApiResponse | null> {
    try {
      const cached = await redis.get(`stock:${stockId}:latest`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error(`Error getting cached price for stock ${stockId}:`, error);
      return null;
    }
  }

  /**
   * 定期同期を開始
   */
  startPeriodicSync(intervalMinutes: number = 5): void {
    console.log(`Starting periodic sync every ${intervalMinutes} minutes`);
    
    setInterval(async () => {
      await this.syncAllStockPrices();
    }, intervalMinutes * 60 * 1000);
  }
}

export const stockDataSyncService = StockDataSyncService.getInstance();
