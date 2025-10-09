import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import {
  BaseBrokerIntegration,
  BrokerAccount,
  BrokerOrder,
  BrokerPosition,
  BrokerMarketData,
} from './broker-integration-service';

export interface IBContract {
  symbol: string;
  secType: 'STK' | 'OPT' | 'FUT' | 'CASH' | 'CFD';
  exchange: string;
  currency: string;
  primaryExchange?: string;
}

export interface IBOrder {
  action: 'BUY' | 'SELL';
  totalQuantity: number;
  orderType: 'MKT' | 'LMT' | 'STP' | 'STP LMT';
  lmtPrice?: number;
  auxPrice?: number;
  tif?: 'DAY' | 'GTC' | 'IOC' | 'GTD';
}

export interface IBConfig {
  name: string;
  host: string;
  port: number;
  clientId: number;
  accountId: string;
  timeout: number;
  retryAttempts: number;
  paperTrading: boolean;
  baseUrl: string;
}

/**
 * Interactive Brokers統合サービス
 * TWS API (Trader Workstation API) を使用した取引統合
 */
export class InteractiveBrokersIntegration extends BaseBrokerIntegration {
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private orderId: number = 1;
  private positions: Map<string, BrokerPosition> = new Map();
  private orders: Map<string, BrokerOrder> = new Map();

  constructor(config: IBConfig) {
    super(config);
  }

  /**
   * Interactive Brokersへの接続
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Interactive Brokersに接続中...');
      this.connectionStatus = 'connecting';

      // TWS/IB Gateway接続の実装
      // 実際の実装では、@stoqey/ib や ib パッケージを使用
      // const ib = new IBApi({
      //   host: this.config.host,
      //   port: this.config.port,
      //   clientId: this.config.clientId,
      // });
      //
      // await ib.connect();

      // シミュレーション
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.isConnected = true;
      this.connectionStatus = 'connected';
      this.logger.info('Interactive Brokersに接続しました');
      this.logger.info(
        `モード: ${this.config.paperTrading ? 'ペーパートレーディング' : '本番取引'}`
      );
      this.emit('connected');
    } catch (error) {
      this.connectionStatus = 'disconnected';
      this.logger.error('Interactive Brokersへの接続に失敗しました:', error);
      throw error;
    }
  }

  /**
   * Interactive Brokersから切断
   */
  async disconnect(): Promise<void> {
    try {
      this.logger.info('Interactive Brokersから切断中...');

      // 実際の実装では、ib.disconnect()を呼び出し

      this.isConnected = false;
      this.connectionStatus = 'disconnected';
      this.logger.info('Interactive Brokersから切断しました');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('切断処理でエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * アカウント情報の取得
   */
  async getAccount(): Promise<BrokerAccount> {
    if (!this.isConnected) {
      throw new Error('Interactive Brokersに接続されていません');
    }

    try {
      // 実際の実装では、ib.reqAccountSummary()を呼び出し
      const account: BrokerAccount = {
        accountId: this.config.accountId,
        balance: this.config.paperTrading ? 100000 : 50000, // Mock data
        currency: 'USD',
        marginAvailable: this.config.paperTrading ? 95000 : 45000,
        marginUsed: 5000,
        positions: Array.from(this.positions.values()),
        orders: Array.from(this.orders.values()),
      };

      return account;
    } catch (error) {
      this.logger.error('アカウント情報の取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * ポジション情報の取得
   */
  async getPositions(): Promise<BrokerPosition[]> {
    if (!this.isConnected) {
      throw new Error('Interactive Brokersに接続されていません');
    }

    try {
      // 実際の実装では、ib.reqPositions()を呼び出し
      return Array.from(this.positions.values());
    } catch (error) {
      this.logger.error('ポジション情報の取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 注文履歴の取得
   */
  async getOrders(): Promise<BrokerOrder[]> {
    if (!this.isConnected) {
      throw new Error('Interactive Brokersに接続されていません');
    }

    try {
      // 実際の実装では、ib.reqOpenOrders()を呼び出し
      return Array.from(this.orders.values());
    } catch (error) {
      this.logger.error('注文履歴の取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 注文の発注
   */
  async placeOrder(orderRequest: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price?: number;
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
  }): Promise<BrokerOrder> {
    if (!this.isConnected) {
      throw new Error('Interactive Brokersに接続されていません');
    }

    try {
      this.logger.info(
        `注文発注: ${orderRequest.symbol} ${orderRequest.side} ${orderRequest.quantity}`
      );

      // Contract定義
      const contract: IBContract = {
        symbol: orderRequest.symbol,
        secType: 'STK',
        exchange: 'SMART',
        currency: 'USD',
      };

      // Order定義
      const order: IBOrder = {
        action: orderRequest.side.toUpperCase() as 'BUY' | 'SELL',
        totalQuantity: orderRequest.quantity,
        orderType: this.mapOrderType(orderRequest.type),
        lmtPrice: orderRequest.price,
        tif: 'DAY',
      };

      // 実際の実装では、ib.placeOrder(orderId, contract, order)を呼び出し

      const brokerOrder: BrokerOrder = {
        orderId: `ib_${this.orderId++}`,
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        quantity: orderRequest.quantity,
        price: orderRequest.price || 0,
        type: orderRequest.type,
        status: 'filled',
        timestamp: new Date(),
        filledQuantity: orderRequest.quantity,
        averagePrice: orderRequest.price || 0,
      };

      this.orders.set(brokerOrder.orderId, brokerOrder);
      this.emit('orderPlaced', brokerOrder);

      return brokerOrder;
    } catch (error) {
      this.logger.error('注文の発注に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 注文のキャンセル
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Interactive Brokersに接続されていません');
    }

    try {
      // 実際の実装では、ib.cancelOrder(orderId)を呼び出し
      const order = this.orders.get(orderId);
      if (order) {
        order.status = 'cancelled';
        this.logger.info(`注文をキャンセルしました: ${orderId}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('注文のキャンセルに失敗しました:', error);
      throw error;
    }
  }

  /**
   * 市場データの取得
   */
  async getMarketData(symbol: string): Promise<BrokerMarketData> {
    if (!this.isConnected) {
      throw new Error('Interactive Brokersに接続されていません');
    }

    try {
      // 実際の実装では、ib.reqMktData()を呼び出し
      const marketData: BrokerMarketData = {
        symbol,
        price: 150.25 + Math.random() * 10,
        bid: 150.2 + Math.random() * 10,
        ask: 150.3 + Math.random() * 10,
        volume: Math.floor(1000000 + Math.random() * 500000),
        timestamp: new Date(),
        high24h: 155.0,
        low24h: 148.5,
        change24h: 1.75,
        changePercent24h: 1.17,
      };

      return marketData;
    } catch (error) {
      this.logger.error('市場データの取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 複数銘柄の市場データ取得
   */
  async getMarketDataMultiple(symbols: string[]): Promise<BrokerMarketData[]> {
    const results: BrokerMarketData[] = [];

    for (const symbol of symbols) {
      try {
        const data = await this.getMarketData(symbol);
        results.push(data);
      } catch (error) {
        this.logger.error(`${symbol}の市場データ取得に失敗:`, error);
      }
    }

    return results;
  }

  /**
   * リアルタイムバーの取得（5秒足など）
   */
  async getRealTimeBars(
    symbol: string,
    barSize: number = 5
  ): Promise<{
    time: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> {
    if (!this.isConnected) {
      throw new Error('Interactive Brokersに接続されていません');
    }

    try {
      // 実際の実装では、ib.reqRealTimeBars()を呼び出し
      return {
        time: new Date(),
        open: 150.0,
        high: 151.0,
        low: 149.5,
        close: 150.5,
        volume: 100000,
      };
    } catch (error) {
      this.logger.error('リアルタイムバーの取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 履歴データの取得
   */
  async getHistoricalData(
    symbol: string,
    duration: string = '1 D',
    barSize: string = '1 min'
  ): Promise<
    Array<{
      time: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>
  > {
    if (!this.isConnected) {
      throw new Error('Interactive Brokersに接続されていません');
    }

    try {
      // 実際の実装では、ib.reqHistoricalData()を呼び出し
      const data = [];
      for (let i = 0; i < 10; i++) {
        data.push({
          time: new Date(Date.now() - i * 60000),
          open: 150.0 + Math.random() * 2,
          high: 151.0 + Math.random() * 2,
          low: 149.0 + Math.random() * 2,
          close: 150.5 + Math.random() * 2,
          volume: Math.floor(50000 + Math.random() * 50000),
        });
      }
      return data;
    } catch (error) {
      this.logger.error('履歴データの取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 口座サマリーの取得
   */
  async getAccountSummary(): Promise<{
    netLiquidation: number;
    totalCashValue: number;
    grossPositionValue: number;
    buyingPower: number;
    currency: string;
  }> {
    if (!this.isConnected) {
      throw new Error('Interactive Brokersに接続されていません');
    }

    try {
      // 実際の実装では、ib.reqAccountSummary()を呼び出し
      return {
        netLiquidation: 100000,
        totalCashValue: 95000,
        grossPositionValue: 5000,
        buyingPower: 190000,
        currency: 'USD',
      };
    } catch (error) {
      this.logger.error('口座サマリーの取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 注文タイプのマッピング
   */
  private mapOrderType(
    type: 'market' | 'limit' | 'stop' | 'stop_limit'
  ): 'MKT' | 'LMT' | 'STP' | 'STP LMT' {
    const typeMap = {
      market: 'MKT' as const,
      limit: 'LMT' as const,
      stop: 'STP' as const,
      stop_limit: 'STP LMT' as const,
    };
    return typeMap[type];
  }

  /**
   * 接続状態の取得
   */
  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.connectionStatus;
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    connected: boolean;
    accountId: string;
    mode: string;
    timestamp: string;
  }> {
    return {
      healthy: this.isConnected,
      connected: this.isConnected,
      accountId: this.config.accountId,
      mode: this.config.paperTrading ? 'paper' : 'live',
      timestamp: new Date().toISOString(),
    };
  }
}
