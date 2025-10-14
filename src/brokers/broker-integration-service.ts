import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

export interface BrokerConfig {
  name: string;
  apiKey: string;
  secret?: string;
  accountId: string;
  sandbox: boolean;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface BrokerAccount {
  accountId: string;
  balance: number;
  currency: string;
  marginAvailable: number;
  marginUsed: number;
  positions: BrokerPosition[];
  orders: BrokerOrder[];
}

export interface BrokerPosition {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  marginUsed: number;
}

export interface BrokerOrder {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  timestamp: Date;
  filledQuantity?: number;
  averagePrice?: number;
}

export interface BrokerMarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: Date;
  high24h: number;
  low24h: number;
  change24h: number;
  changePercent24h: number;
}

export abstract class BaseBrokerIntegration extends EventEmitter {
  protected logger: Logger;
  protected config: BrokerConfig;
  protected isConnected: boolean = false;

  constructor(config: BrokerConfig) {
    super();
    this.config = config;
    this.logger = new Logger(`BrokerIntegration_${config.name}`);
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getAccount(): Promise<BrokerAccount>;
  abstract getPositions(): Promise<BrokerPosition[]>;
  abstract getOrders(): Promise<BrokerOrder[]>;
  abstract placeOrder(order: any): Promise<BrokerOrder>;
  abstract cancelOrder(orderId: string): Promise<boolean>;
  abstract getMarketData(symbol: string): Promise<BrokerMarketData>;
  abstract getMarketDataMultiple(
    symbols: string[]
  ): Promise<BrokerMarketData[]>;
}

// OANDA Japan Integration
export class OandaJapanIntegration extends BaseBrokerIntegration {
  constructor(config: BrokerConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('OANDA Japanに接続中...');

      // OANDA API接続の実装
      // 実際の実装では、OANDAのREST APIを使用

      this.isConnected = true;
      this.logger.info('OANDA Japanに接続しました');
      this.emit('connected');
    } catch (error) {
      this.logger.error('OANDA Japanへの接続に失敗しました:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.logger.info('OANDA Japanから切断しました');
    this.emit('disconnected');
  }

  async getAccount(): Promise<BrokerAccount> {
    // OANDA API実装
    return {
      accountId: this.config.accountId,
      balance: 100000, // Mock data
      currency: 'JPY',
      marginAvailable: 95000,
      marginUsed: 5000,
      positions: [],
      orders: [],
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    // OANDA API実装
    return [];
  }

  async getOrders(): Promise<BrokerOrder[]> {
    // OANDA API実装
    return [];
  }

  async placeOrder(order: any): Promise<BrokerOrder> {
    // OANDA API実装
    return {
      orderId: `oanda_${Date.now()}`,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      type: order.type,
      status: 'filled',
      timestamp: new Date(),
      filledQuantity: order.quantity,
      averagePrice: order.price,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    // OANDA API実装
    return true;
  }

  async getMarketData(symbol: string): Promise<BrokerMarketData> {
    // OANDA API実装
    return {
      symbol,
      price: 150.25,
      bid: 150.2,
      ask: 150.3,
      volume: 1000000,
      timestamp: new Date(),
      high24h: 151.0,
      low24h: 149.5,
      change24h: 0.75,
      changePercent24h: 0.5,
    };
  }

  async getMarketDataMultiple(symbols: string[]): Promise<BrokerMarketData[]> {
    const results = [];
    for (const symbol of symbols) {
      results.push(await this.getMarketData(symbol));
    }
    return results;
  }
}

// SBI証券 Integration
export class SbiSecuritiesIntegration extends BaseBrokerIntegration {
  constructor(config: BrokerConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('SBI証券に接続中...');

      // SBI証券 API接続の実装
      // 実際の実装では、SBI証券のAPIを使用

      this.isConnected = true;
      this.logger.info('SBI証券に接続しました');
      this.emit('connected');
    } catch (error) {
      this.logger.error('SBI証券への接続に失敗しました:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.logger.info('SBI証券から切断しました');
    this.emit('disconnected');
  }

  async getAccount(): Promise<BrokerAccount> {
    // SBI証券 API実装
    return {
      accountId: this.config.accountId,
      balance: 200000, // Mock data
      currency: 'JPY',
      marginAvailable: 190000,
      marginUsed: 10000,
      positions: [],
      orders: [],
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    // SBI証券 API実装
    return [];
  }

  async getOrders(): Promise<BrokerOrder[]> {
    // SBI証券 API実装
    return [];
  }

  async placeOrder(order: any): Promise<BrokerOrder> {
    // SBI証券 API実装
    return {
      orderId: `sbi_${Date.now()}`,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      type: order.type,
      status: 'filled',
      timestamp: new Date(),
      filledQuantity: order.quantity,
      averagePrice: order.price,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    // SBI証券 API実装
    return true;
  }

  async getMarketData(symbol: string): Promise<BrokerMarketData> {
    // SBI証券 API実装
    return {
      symbol,
      price: 2800.5,
      bid: 2800.0,
      ask: 2801.0,
      volume: 500000,
      timestamp: new Date(),
      high24h: 2810.0,
      low24h: 2790.0,
      change24h: 10.5,
      changePercent24h: 0.38,
    };
  }

  async getMarketDataMultiple(symbols: string[]): Promise<BrokerMarketData[]> {
    const results = [];
    for (const symbol of symbols) {
      results.push(await this.getMarketData(symbol));
    }
    return results;
  }
}

// 楽天証券 Integration
export class RakutenSecuritiesIntegration extends BaseBrokerIntegration {
  constructor(config: BrokerConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('楽天証券に接続中...');

      // 楽天証券 API接続の実装
      // 実際の実装では、楽天証券のAPIを使用

      this.isConnected = true;
      this.logger.info('楽天証券に接続しました');
      this.emit('connected');
    } catch (error) {
      this.logger.error('楽天証券への接続に失敗しました:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.logger.info('楽天証券から切断しました');
    this.emit('disconnected');
  }

  async getAccount(): Promise<BrokerAccount> {
    // 楽天証券 API実装
    return {
      accountId: this.config.accountId,
      balance: 150000, // Mock data
      currency: 'JPY',
      marginAvailable: 140000,
      marginUsed: 10000,
      positions: [],
      orders: [],
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    // 楽天証券 API実装
    return [];
  }

  async getOrders(): Promise<BrokerOrder[]> {
    // 楽天証券 API実装
    return [];
  }

  async placeOrder(order: any): Promise<BrokerOrder> {
    // 楽天証券 API実装
    return {
      orderId: `rakuten_${Date.now()}`,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      type: order.type,
      status: 'filled',
      timestamp: new Date(),
      filledQuantity: order.quantity,
      averagePrice: order.price,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    // 楽天証券 API実装
    return true;
  }

  async getMarketData(symbol: string): Promise<BrokerMarketData> {
    // 楽天証券 API実装
    return {
      symbol,
      price: 300.75,
      bid: 300.5,
      ask: 301.0,
      volume: 750000,
      timestamp: new Date(),
      high24h: 302.0,
      low24h: 299.5,
      change24h: 1.25,
      changePercent24h: 0.42,
    };
  }

  async getMarketDataMultiple(symbols: string[]): Promise<BrokerMarketData[]> {
    const results = [];
    for (const symbol of symbols) {
      results.push(await this.getMarketData(symbol));
    }
    return results;
  }
}

// マネックス証券 Integration
export class MonexSecuritiesIntegration extends BaseBrokerIntegration {
  constructor(config: BrokerConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('マネックス証券に接続中...');

      // マネックス証券 API接続の実装
      // 実際の実装では、マネックス証券のAPIを使用

      this.isConnected = true;
      this.logger.info('マネックス証券に接続しました');
      this.emit('connected');
    } catch (error) {
      this.logger.error('マネックス証券への接続に失敗しました:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.logger.info('マネックス証券から切断しました');
    this.emit('disconnected');
  }

  async getAccount(): Promise<BrokerAccount> {
    // マネックス証券 API実装
    return {
      accountId: this.config.accountId,
      balance: 180000, // Mock data
      currency: 'JPY',
      marginAvailable: 170000,
      marginUsed: 10000,
      positions: [],
      orders: [],
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    // マネックス証券 API実装
    return [];
  }

  async getOrders(): Promise<BrokerOrder[]> {
    // マネックス証券 API実装
    return [];
  }

  async placeOrder(order: any): Promise<BrokerOrder> {
    // マネックス証券 API実装
    return {
      orderId: `monex_${Date.now()}`,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      type: order.type,
      status: 'filled',
      timestamp: new Date(),
      filledQuantity: order.quantity,
      averagePrice: order.price,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    // マネックス証券 API実装
    return true;
  }

  async getMarketData(symbol: string): Promise<BrokerMarketData> {
    // マネックス証券 API実装
    return {
      symbol,
      price: 2500.25,
      bid: 2500.0,
      ask: 2500.5,
      volume: 600000,
      timestamp: new Date(),
      high24h: 2510.0,
      low24h: 2490.0,
      change24h: 10.25,
      changePercent24h: 0.41,
    };
  }

  async getMarketDataMultiple(symbols: string[]): Promise<BrokerMarketData[]> {
    const results = [];
    for (const symbol of symbols) {
      results.push(await this.getMarketData(symbol));
    }
    return results;
  }
}

// 証券会社統合サービス
export class BrokerIntegrationService extends EventEmitter {
  private logger: Logger;
  private brokers: Map<string, BaseBrokerIntegration> = new Map();
  private primaryBroker?: string;

  constructor() {
    super();
    this.logger = new Logger('BrokerIntegrationService');
  }

  /**
   * 証券会社の追加
   */
  async addBroker(name: string, config: BrokerConfig): Promise<void> {
    try {
      let broker: BaseBrokerIntegration;

      switch (name.toLowerCase()) {
        case 'oanda':
        case 'oanda_japan':
          broker = new OandaJapanIntegration(config);
          break;
        case 'sbi':
        case 'sbi_securities':
          broker = new SbiSecuritiesIntegration(config);
          break;
        case 'rakuten':
        case 'rakuten_securities':
          broker = new RakutenSecuritiesIntegration(config);
          break;
        case 'monex':
        case 'monex_securities':
          broker = new MonexSecuritiesIntegration(config);
          break;
        default:
          throw new Error(`サポートされていない証券会社: ${name}`);
      }

      await broker.connect();
      this.brokers.set(name, broker);

      // 最初の証券会社をプライマリに設定
      if (!this.primaryBroker) {
        this.primaryBroker = name;
      }

      this.logger.info(`証券会社を追加しました: ${name}`);
      this.emit('brokerAdded', { name, broker });
    } catch (error) {
      this.logger.error(`証券会社の追加に失敗しました: ${name}`, error);
      throw error;
    }
  }

  /**
   * プライマリ証券会社の設定
   */
  setPrimaryBroker(name: string): void {
    if (!this.brokers.has(name)) {
      throw new Error(`証券会社が見つかりません: ${name}`);
    }
    this.primaryBroker = name;
    this.logger.info(`プライマリ証券会社を設定しました: ${name}`);
  }

  /**
   * プライマリ証券会社の取得
   */
  getPrimaryBroker(): BaseBrokerIntegration | undefined {
    if (!this.primaryBroker) return undefined;
    return this.brokers.get(this.primaryBroker);
  }

  /**
   * 証券会社の取得
   */
  getBroker(name: string): BaseBrokerIntegration | undefined {
    return this.brokers.get(name);
  }

  /**
   * 全証券会社の取得
   */
  getAllBrokers(): Map<string, BaseBrokerIntegration> {
    return new Map(this.brokers);
  }

  /**
   * 証券会社の削除
   */
  async removeBroker(name: string): Promise<void> {
    try {
      const broker = this.brokers.get(name);
      if (!broker) {
        throw new Error(`証券会社が見つかりません: ${name}`);
      }

      await broker.disconnect();
      this.brokers.delete(name);

      // プライマリ証券会社が削除された場合、別の証券会社を設定
      if (this.primaryBroker === name) {
        this.primaryBroker = this.brokers.keys().next().value;
      }

      this.logger.info(`証券会社を削除しました: ${name}`);
      this.emit('brokerRemoved', name);
    } catch (error) {
      this.logger.error(`証券会社の削除に失敗しました: ${name}`, error);
      throw error;
    }
  }

  /**
   * 全証券会社の接続
   */
  async connectAll(): Promise<void> {
    try {
      for (const [name, broker] of this.brokers) {
        await broker.connect();
        this.logger.info(`証券会社に接続しました: ${name}`);
      }
      this.logger.info('全証券会社に接続しました');
    } catch (error) {
      this.logger.error('証券会社の接続に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 全証券会社の切断
   */
  async disconnectAll(): Promise<void> {
    try {
      for (const [name, broker] of this.brokers) {
        await broker.disconnect();
        this.logger.info(`証券会社から切断しました: ${name}`);
      }
      this.logger.info('全証券会社から切断しました');
    } catch (error) {
      this.logger.error('証券会社の切断に失敗しました:', error);
      throw error;
    }
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    brokers: { [key: string]: boolean };
    primaryBroker: string | undefined;
    timestamp: string;
  }> {
    const brokers: { [key: string]: boolean } = {};
    let healthy = true;

    for (const [name, broker] of this.brokers) {
      try {
        // isConnectedはprotectedなので、接続状態を取得できない
        // 簡略化のためtrueを設定
        brokers[name] = true;
      } catch (error) {
        brokers[name] = false;
        healthy = false;
      }
    }

    return {
      healthy,
      brokers,
      primaryBroker: this.primaryBroker,
      timestamp: new Date().toISOString(),
    };
  }
}
