import { KabuApiCredentials } from '@/types/securities';
import { DemoOrder, DemoPosition, demoTradingService } from './demo-trading';
import { KabuApiClient } from '@/integrations/kabu-api';

export interface TradingApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'kabu' | 'demo';
}

export class TradingApiManager {
  private static instance: TradingApiManager;
  private kabuClient: KabuApiClient | null = null;
  private isKabuAvailable = false;

  private constructor() {}

  public static getInstance(): TradingApiManager {
    if (!TradingApiManager.instance) {
      TradingApiManager.instance = new TradingApiManager();
    }
    return TradingApiManager.instance;
  }

  /**
   * kabuステーションAPIを初期化
   */
  async initializeKabuApi(credentials: KabuApiCredentials): Promise<boolean> {
    try {
      this.kabuClient = new KabuApiClient(credentials);
      this.isKabuAvailable = await this.kabuClient.testConnection();
      return this.isKabuAvailable;
    } catch (error) {
      console.error('Failed to initialize kabu API:', error);
      this.isKabuAvailable = false;
      return false;
    }
  }

  /**
   * 注文を発注
   */
  async placeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): Promise<TradingApiResponse<DemoOrder>> {
    if (this.isKabuAvailable && this.kabuClient) {
      try {
        // kabuステーションAPIを使用
        const kabuOrder = {
          Password: 'demo', // 実際の実装では適切なパスワードを使用
          Symbol: symbol,
          Exchange: 1, // 東証
          SecurityType: 101, // 現物
          Side: side === 'BUY' ? '2' : '1',
          CashMargin: 1, // 現物
          DelivType: 0,
          FundType: 'AA',
          AccountType: 1,
          Qty: quantity,
          Price: price,
          FrontOrderType: 20, // 指値
        };

        const result = await this.kabuClient.placeOrder(kabuOrder);

        if (result.IsOK) {
          return {
            success: true,
            data: {
              id: result.data?.OrderId || `kabu_${Date.now()}`,
              symbol,
              side,
              quantity,
              price,
              status: 'FILLED',
              createdAt: new Date(),
              filledAt: new Date(),
            },
            source: 'kabu',
          };
        } else {
          throw new Error(result.Message);
        }
      } catch (error) {
        console.error('kabu API order failed, falling back to demo:', error);
        // フォールバック: デモトレードを使用
        return this.placeDemoOrder(symbol, side, quantity, price);
      }
    } else {
      // kabuステーションAPIが利用できない場合、デモトレードを使用
      return this.placeDemoOrder(symbol, side, quantity, price);
    }
  }

  /**
   * デモ注文を発注
   */
  private async placeDemoOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): Promise<TradingApiResponse<DemoOrder>> {
    try {
      const order = await demoTradingService.placeOrder(
        symbol,
        side,
        quantity,
        price
      );
      return {
        success: true,
        data: order,
        source: 'demo',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'demo',
      };
    }
  }

  /**
   * ポジションを取得
   */
  async getPositions(): Promise<TradingApiResponse<DemoPosition[]>> {
    if (this.isKabuAvailable && this.kabuClient) {
      try {
        // kabuステーションAPIを使用
        const result = await this.kabuClient.getPositions();

        if (result.IsOK) {
          const positions: DemoPosition[] =
            result.data?.map((pos: any) => ({
              symbol: pos.StockCode,
              quantity: pos.Qty,
              averagePrice: pos.StockPrice,
              currentPrice: pos.StockPrice,
              unrealizedPnl: pos.ValCmp,
              unrealizedPnlPercent:
                (pos.ValCmp / (pos.StockPrice * pos.Qty)) * 100,
            })) || [];

          return {
            success: true,
            data: positions,
            source: 'kabu',
          };
        } else {
          throw new Error(result.Message);
        }
      } catch (error) {
        console.error(
          'kabu API positions failed, falling back to demo:',
          error
        );
        // フォールバック: デモトレードを使用
        return this.getDemoPositions();
      }
    } else {
      // kabuステーションAPIが利用できない場合、デモトレードを使用
      return this.getDemoPositions();
    }
  }

  /**
   * デモポジションを取得
   */
  private async getDemoPositions(): Promise<
    TradingApiResponse<DemoPosition[]>
  > {
    try {
      const positions = demoTradingService.getPositions();
      return {
        success: true,
        data: positions,
        source: 'demo',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'demo',
      };
    }
  }

  /**
   * 口座残高を取得
   */
  async getBalance(): Promise<TradingApiResponse<number>> {
    if (this.isKabuAvailable && this.kabuClient) {
      try {
        // kabuステーションAPIを使用
        const result = await this.kabuClient.getAccountInfo();

        if (result.IsOK) {
          return {
            success: true,
            data: result.data?.Balance || 0,
            source: 'kabu',
          };
        } else {
          throw new Error(result.Message);
        }
      } catch (error) {
        console.error('kabu API balance failed, falling back to demo:', error);
        // フォールバック: デモトレードを使用
        return this.getDemoBalance();
      }
    } else {
      // kabuステーションAPIが利用できない場合、デモトレードを使用
      return this.getDemoBalance();
    }
  }

  /**
   * デモ残高を取得
   */
  private async getDemoBalance(): Promise<TradingApiResponse<number>> {
    try {
      const balance = demoTradingService.getBalance();
      return {
        success: true,
        data: balance,
        source: 'demo',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'demo',
      };
    }
  }

  /**
   * kabuステーションAPIの利用可能性を確認
   */
  isKabuApiAvailable(): boolean {
    return this.isKabuAvailable;
  }

  /**
   * 現在のAPIソースを取得
   */
  getCurrentSource(): 'kabu' | 'demo' {
    return this.isKabuAvailable ? 'kabu' : 'demo';
  }
}

export const tradingApiManager = TradingApiManager.getInstance();
