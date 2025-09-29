/**
 * OANDA Japan統合サービス
 * FX取引の自動化とリアルタイムデータ取得
 */

export interface OandaConfig {
  apiKey: string;
  accountId: string;
  environment: 'sandbox' | 'live';
  baseUrl: string;
}

export interface OandaAccount {
  id: string;
  currency: string;
  balance: number;
  unrealizedPl: number;
  realizedPl: number;
  marginUsed: number;
  marginAvailable: number;
}

export interface OandaPosition {
  instrument: string;
  long: {
    units: number;
    averagePrice: number;
    unrealizedPl: number;
  };
  short: {
    units: number;
    averagePrice: number;
    unrealizedPl: number;
  };
  unrealizedPl: number;
  marginUsed: number;
}

export interface OandaOrder {
  id: string;
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  type:
    | 'MARKET'
    | 'LIMIT'
    | 'STOP'
    | 'MARKET_IF_TOUCHED'
    | 'TAKE_PROFIT'
    | 'STOP_LOSS';
  price?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  timeInForce: 'GTC' | 'GFD' | 'GTD' | 'IOC' | 'FOK';
  state: 'PENDING' | 'FILLED' | 'CANCELLED' | 'TRIGGERED';
  createTime: Date;
  fillTime?: Date;
}

export interface OandaPrice {
  instrument: string;
  time: Date;
  bid: number;
  ask: number;
  spread: number;
}

export interface OandaCandle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class OandaIntegrationService {
  private config: OandaConfig;
  private isConnected: boolean = false;

  constructor(config: OandaConfig) {
    this.config = config;
  }

  /**
   * 接続をテスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/v3/accounts');
      this.isConnected = response.ok;
      return this.isConnected;
    } catch (error) {
      console.error('OANDA接続テストエラー:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 口座情報を取得
   */
  async getAccount(): Promise<OandaAccount | null> {
    try {
      const response = await this.makeRequest(
        'GET',
        `/v3/accounts/${this.config.accountId}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      const account = data.account;

      return {
        id: account.id,
        currency: account.currency,
        balance: parseFloat(account.balance),
        unrealizedPl: parseFloat(account.unrealizedPL),
        realizedPl: parseFloat(account.realizedPL),
        marginUsed: parseFloat(account.marginUsed),
        marginAvailable: parseFloat(account.marginAvailable),
      };
    } catch (error) {
      console.error('口座情報取得エラー:', error);
      return null;
    }
  }

  /**
   * ポジション情報を取得
   */
  async getPositions(): Promise<OandaPosition[]> {
    try {
      const response = await this.makeRequest(
        'GET',
        `/v3/accounts/${this.config.accountId}/positions`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.positions.map((position: any) => ({
        instrument: position.instrument,
        long: {
          units: parseFloat(position.long.units),
          averagePrice: parseFloat(position.long.averagePrice),
          unrealizedPl: parseFloat(position.long.unrealizedPL),
        },
        short: {
          units: parseFloat(position.short.units),
          averagePrice: parseFloat(position.short.averagePrice),
          unrealizedPl: parseFloat(position.short.unrealizedPL),
        },
        unrealizedPl: parseFloat(position.unrealizedPL),
        marginUsed: parseFloat(position.marginUsed),
      }));
    } catch (error) {
      console.error('ポジション情報取得エラー:', error);
      return [];
    }
  }

  /**
   * 注文を発注
   */
  async placeOrder(order: {
    instrument: string;
    units: number;
    side: 'buy' | 'sell';
    type: 'MARKET' | 'LIMIT' | 'STOP';
    price?: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
  }): Promise<OandaOrder | null> {
    try {
      const orderData = {
        order: {
          type: order.type,
          instrument: order.instrument,
          units: order.units.toString(),
          side: order.side.toUpperCase(),
          timeInForce: 'GTC',
          ...(order.price && { price: order.price.toString() }),
          ...(order.stopLossPrice && {
            stopLossOnFill: { price: order.stopLossPrice.toString() },
          }),
          ...(order.takeProfitPrice && {
            takeProfitOnFill: { price: order.takeProfitPrice.toString() },
          }),
        },
      };

      const response = await this.makeRequest(
        'POST',
        `/v3/accounts/${this.config.accountId}/orders`,
        orderData
      );

      if (!response.ok) return null;

      const data = await response.json();
      const orderResult =
        data.orderFillTransaction || data.orderCreateTransaction;

      return {
        id: orderResult.id,
        instrument: orderResult.instrument,
        units: parseFloat(orderResult.units),
        side: orderResult.side.toLowerCase(),
        type: orderResult.type,
        price: orderResult.price ? parseFloat(orderResult.price) : undefined,
        stopLossPrice: orderResult.stopLossOnFill?.price
          ? parseFloat(orderResult.stopLossOnFill.price)
          : undefined,
        takeProfitPrice: orderResult.takeProfitOnFill?.price
          ? parseFloat(orderResult.takeProfitOnFill.price)
          : undefined,
        timeInForce: orderResult.timeInForce,
        state: orderResult.state,
        createTime: new Date(orderResult.time),
        fillTime: orderResult.fillTime
          ? new Date(orderResult.fillTime)
          : undefined,
      };
    } catch (error) {
      console.error('注文発注エラー:', error);
      return null;
    }
  }

  /**
   * 注文をキャンセル
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        'PUT',
        `/v3/accounts/${this.config.accountId}/orders/${orderId}/cancel`
      );
      return response.ok;
    } catch (error) {
      console.error('注文キャンセルエラー:', error);
      return false;
    }
  }

  /**
   * 注文履歴を取得
   */
  async getOrders(): Promise<OandaOrder[]> {
    try {
      const response = await this.makeRequest(
        'GET',
        `/v3/accounts/${this.config.accountId}/orders`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.orders.map((order: any) => ({
        id: order.id,
        instrument: order.instrument,
        units: parseFloat(order.units),
        side: order.side.toLowerCase(),
        type: order.type,
        price: order.price ? parseFloat(order.price) : undefined,
        stopLossPrice: order.stopLossOnFill?.price
          ? parseFloat(order.stopLossOnFill.price)
          : undefined,
        takeProfitPrice: order.takeProfitOnFill?.price
          ? parseFloat(order.takeProfitOnFill.price)
          : undefined,
        timeInForce: order.timeInForce,
        state: order.state,
        createTime: new Date(order.createTime),
        fillTime: order.fillTime ? new Date(order.fillTime) : undefined,
      }));
    } catch (error) {
      console.error('注文履歴取得エラー:', error);
      return [];
    }
  }

  /**
   * 現在価格を取得
   */
  async getCurrentPrice(instrument: string): Promise<OandaPrice | null> {
    try {
      const response = await this.makeRequest(
        'GET',
        `/v3/accounts/${this.config.accountId}/pricing?instruments=${instrument}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      const price = data.prices[0];

      return {
        instrument: price.instrument,
        time: new Date(price.time),
        bid: parseFloat(price.bids[0].price),
        ask: parseFloat(price.asks[0].price),
        spread:
          parseFloat(price.asks[0].price) - parseFloat(price.bids[0].price),
      };
    } catch (error) {
      console.error('現在価格取得エラー:', error);
      return null;
    }
  }

  /**
   * 履歴データを取得
   */
  async getHistoricalData(
    instrument: string,
    granularity: 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1',
    count: number = 100
  ): Promise<OandaCandle[]> {
    try {
      const response = await this.makeRequest(
        'GET',
        `/v3/instruments/${instrument}/candles?granularity=${granularity}&count=${count}`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.candles.map((candle: any) => ({
        time: new Date(candle.time),
        open: parseFloat(candle.mid.o),
        high: parseFloat(candle.mid.h),
        low: parseFloat(candle.mid.l),
        close: parseFloat(candle.mid.c),
        volume: candle.volume,
      }));
    } catch (error) {
      console.error('履歴データ取得エラー:', error);
      return [];
    }
  }

  /**
   * リアルタイム価格ストリームを開始
   */
  async startPriceStream(
    instruments: string[],
    callback: (price: OandaPrice) => void
  ): Promise<void> {
    try {
      const instrumentsParam = instruments.join(',');
      const response = await fetch(
        `${this.config.baseUrl}/v3/accounts/${this.config.accountId}/pricing/stream?instruments=${instrumentsParam}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            const data = JSON.parse(line);
            if (data.type === 'PRICE') {
              const price: OandaPrice = {
                instrument: data.instrument,
                time: new Date(data.time),
                bid: parseFloat(data.bids[0].price),
                ask: parseFloat(data.asks[0].price),
                spread:
                  parseFloat(data.asks[0].price) -
                  parseFloat(data.bids[0].price),
              };
              callback(price);
            }
          } catch (parseError) {
            console.error('価格ストリーム解析エラー:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('価格ストリーム開始エラー:', error);
    }
  }

  /**
   * HTTPリクエストを実行
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    return await fetch(url, options);
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<OandaConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): OandaConfig {
    return { ...this.config };
  }

  /**
   * 接続状態を取得
   */
  isConnectedToOanda(): boolean {
    return this.isConnected;
  }
}
