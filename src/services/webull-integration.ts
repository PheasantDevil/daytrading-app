/**
 * ウィブル証券統合サービス
 * 米国株取引の自動化とリアルタイムデータ取得
 */

export interface WebullConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  environment: 'sandbox' | 'live';
}

export interface WebullAccount {
  accountId: string;
  currency: string;
  totalValue: number;
  buyingPower: number;
  cashBalance: number;
  marketValue: number;
  dayTradingBuyingPower: number;
}

export interface WebullPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPercent: number;
  cost: number;
}

export interface WebullOrder {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT';
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  createTime: Date;
  fillTime?: Date;
  filledQuantity: number;
  filledPrice?: number;
}

export interface WebullQuote {
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

export interface WebullCandle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class WebullIntegrationService {
  private config: WebullConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private isConnected: boolean = false;

  constructor(config: WebullConfig) {
    this.config = config;
  }

  /**
   * 認証を実行
   */
  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          secret_key: this.config.secretKey,
          grant_type: 'client_credentials',
        }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
      this.isConnected = true;

      return true;
    } catch (error) {
      console.error('ウィブル認証エラー:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * トークンの有効性をチェック
   */
  private async checkTokenValidity(): Promise<boolean> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      return await this.authenticate();
    }
    return true;
  }

  /**
   * 接続をテスト
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!(await this.checkTokenValidity())) return false;

      const response = await this.makeRequest('GET', '/user/account');
      this.isConnected = response.ok;
      return this.isConnected;
    } catch (error) {
      console.error('ウィブル接続テストエラー:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 口座情報を取得
   */
  async getAccount(): Promise<WebullAccount | null> {
    try {
      if (!(await this.checkTokenValidity())) return null;

      const response = await this.makeRequest('GET', '/user/account');
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      return {
        accountId: data.accountId,
        currency: data.currency || 'USD',
        totalValue: parseFloat(data.totalValue),
        buyingPower: parseFloat(data.buyingPower),
        cashBalance: parseFloat(data.cashBalance),
        marketValue: parseFloat(data.marketValue),
        dayTradingBuyingPower: parseFloat(data.dayTradingBuyingPower),
      };
    } catch (error) {
      console.error('口座情報取得エラー:', error);
      return null;
    }
  }

  /**
   * ポジション情報を取得
   */
  async getPositions(): Promise<WebullPosition[]> {
    try {
      if (!(await this.checkTokenValidity())) return [];

      const response = await this.makeRequest('GET', '/user/positions');
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.positions.map((position: any) => ({
        symbol: position.symbol,
        quantity: parseFloat(position.quantity),
        averagePrice: parseFloat(position.averagePrice),
        currentPrice: parseFloat(position.currentPrice),
        marketValue: parseFloat(position.marketValue),
        unrealizedPl: parseFloat(position.unrealizedPl),
        unrealizedPlPercent: parseFloat(position.unrealizedPlPercent),
        cost: parseFloat(position.cost),
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
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT';
    stopPrice?: number;
  }): Promise<WebullOrder | null> {
    try {
      if (!(await this.checkTokenValidity())) return null;

      const orderData = {
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        orderType: order.type,
        ...(order.price && { price: order.price }),
        ...(order.stopPrice && { stopPrice: order.stopPrice }),
        timeInForce: 'DAY',
      };

      const response = await this.makeRequest('POST', '/order', orderData);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      return {
        orderId: data.orderId,
        symbol: data.symbol,
        side: data.side,
        quantity: parseFloat(data.quantity),
        price: parseFloat(data.price),
        type: data.orderType,
        status: data.status,
        createTime: new Date(data.createTime),
        fillTime: data.fillTime ? new Date(data.fillTime) : undefined,
        filledQuantity: parseFloat(data.filledQuantity || '0'),
        filledPrice: data.filledPrice ? parseFloat(data.filledPrice) : undefined,
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
      if (!(await this.checkTokenValidity())) return false;

      const response = await this.makeRequest('DELETE', `/order/${orderId}`);
      return response.ok;
    } catch (error) {
      console.error('注文キャンセルエラー:', error);
      return false;
    }
  }

  /**
   * 注文履歴を取得
   */
  async getOrders(): Promise<WebullOrder[]> {
    try {
      if (!(await this.checkTokenValidity())) return [];

      const response = await this.makeRequest('GET', '/user/orders');
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.orders.map((order: any) => ({
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side,
        quantity: parseFloat(order.quantity),
        price: parseFloat(order.price),
        type: order.orderType,
        status: order.status,
        createTime: new Date(order.createTime),
        fillTime: order.fillTime ? new Date(order.fillTime) : undefined,
        filledQuantity: parseFloat(order.filledQuantity || '0'),
        filledPrice: order.filledPrice ? parseFloat(order.filledPrice) : undefined,
      }));
    } catch (error) {
      console.error('注文履歴取得エラー:', error);
      return [];
    }
  }

  /**
   * 現在価格を取得
   */
  async getCurrentPrice(symbol: string): Promise<WebullQuote | null> {
    try {
      if (!(await this.checkTokenValidity())) return null;

      const response = await this.makeRequest('GET', `/quote/${symbol}`);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      return {
        symbol: data.symbol,
        price: parseFloat(data.price),
        change: parseFloat(data.change),
        changePercent: parseFloat(data.changePercent),
        volume: parseInt(data.volume),
        high: parseFloat(data.high),
        low: parseFloat(data.low),
        open: parseFloat(data.open),
        close: parseFloat(data.close),
        timestamp: new Date(data.timestamp),
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
    symbol: string,
    interval: '1m' | '5m' | '15m' | '30m' | '1h' | '1d',
    count: number = 100
  ): Promise<WebullCandle[]> {
    try {
      if (!(await this.checkTokenValidity())) return [];

      const response = await this.makeRequest('GET', `/chart/${symbol}?interval=${interval}&count=${count}`);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.candles.map((candle: any) => ({
        time: new Date(candle.time),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseInt(candle.volume),
      }));
    } catch (error) {
      console.error('履歴データ取得エラー:', error);
      return [];
    }
  }

  /**
   * 複数銘柄の価格を一括取得
   */
  async getMultipleQuotes(symbols: string[]): Promise<Map<string, WebullQuote>> {
    const results = new Map<string, WebullQuote>();
    
    const promises = symbols.map(async (symbol) => {
      try {
        const quote = await this.getCurrentPrice(symbol);
        if (quote) {
          results.set(symbol, quote);
        }
      } catch (error) {
        console.error(`${symbol} 価格取得エラー:`, error);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * リアルタイム価格ストリームを開始
   */
  async startPriceStream(
    symbols: string[],
    callback: (quote: WebullQuote) => void
  ): Promise<void> {
    try {
      if (!(await this.checkTokenValidity())) return;

      const symbolsParam = symbols.join(',');
      const response = await fetch(`${this.config.baseUrl}/quote/stream?symbols=${symbolsParam}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
        },
      });

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
            if (data.type === 'QUOTE') {
              const quote: WebullQuote = {
                symbol: data.symbol,
                price: parseFloat(data.price),
                change: parseFloat(data.change),
                changePercent: parseFloat(data.changePercent),
                volume: parseInt(data.volume),
                high: parseFloat(data.high),
                low: parseFloat(data.low),
                open: parseFloat(data.open),
                close: parseFloat(data.close),
                timestamp: new Date(data.timestamp),
              };
              callback(quote);
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
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
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
  updateConfig(newConfig: Partial<WebullConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): WebullConfig {
    return { ...this.config };
  }

  /**
   * 接続状態を取得
   */
  isConnectedToWebull(): boolean {
    return this.isConnected;
  }
}
