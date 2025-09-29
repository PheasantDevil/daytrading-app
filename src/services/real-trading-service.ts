/**
 * リアル取引サービス
 * 実際の取引APIとの統合を管理
 */

import { TradingIntegrationService } from './trading-integration-service';
import { DataIntegrationService } from './data-integration-service';
import { RiskManager } from './risk-manager';
import { FeeCalculator } from './fee-calculator';

export interface RealTradingConfig {
  tradingIntegration: {
    oanda: {
      apiKey: string;
      accountId: string;
      environment: 'sandbox' | 'live';
      baseUrl: string;
    };
    webull: {
      apiKey: string;
      secretKey: string;
      baseUrl: string;
      environment: 'sandbox' | 'live';
    };
    autoReconnect: boolean;
    reconnectInterval: number;
    maxRetries: number;
  };
  dataIntegration: {
    cacheEnabled: boolean;
    cacheExpiry: number;
    fallbackEnabled: boolean;
    maxRetries: number;
    retryDelay: number;
  };
  riskManagement: {
    maxPositionSize: number;
    maxPortfolioRisk: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
    maxDrawdown: number;
  };
  feeCalculation: {
    commissionRate: number;
    slippageRate: number;
    taxRate: number;
  };
}

export interface RealOrder {
  id: string;
  symbol: string;
  market: 'FX' | 'US' | 'JP';
  side: 'BUY' | 'SELL';
  quantity: number;
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  price?: number;
  stopPrice?: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  clientOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';
  filledQuantity: number;
  averagePrice: number;
  commission: number;
  slippage: number;
  netPrice: number;
  totalCost: number;
  broker: string;
}

export interface RealPosition {
  id: string;
  symbol: string;
  market: 'FX' | 'US' | 'JP';
  side: 'LONG' | 'SHORT';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  marketValue: number;
  costBasis: number;
  createdAt: Date;
  updatedAt: Date;
  broker: string;
}

export interface RealAccount {
  id: string;
  broker: string;
  accountType: 'CASH' | 'MARGIN' | 'OPTIONS';
  currency: string;
  totalValue: number;
  availableCash: number;
  buyingPower: number;
  marginUsed: number;
  marginAvailable: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  dayPnL: number;
  totalReturn: number;
  totalReturnPercent: number;
  positions: RealPosition[];
  orders: RealOrder[];
  lastUpdated: Date;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  order?: RealOrder;
}

export interface PositionResult {
  success: boolean;
  position?: RealPosition;
  error?: string;
}

export interface AccountResult {
  success: boolean;
  account?: RealAccount;
  error?: string;
}

export class RealTradingService {
  private config: RealTradingConfig;
  private tradingIntegration: TradingIntegrationService;
  private dataIntegration: DataIntegrationService;
  private riskManager: RiskManager;
  private feeCalculator: FeeCalculator;
  private isInitialized: boolean = false;
  private accounts: Map<string, RealAccount> = new Map();
  private orders: Map<string, RealOrder> = new Map();
  private positions: Map<string, RealPosition> = new Map();

  constructor(config: RealTradingConfig) {
    this.config = config;
    this.tradingIntegration = new TradingIntegrationService(config.tradingIntegration);
    this.dataIntegration = new DataIntegrationService(config.dataIntegration);
    this.riskManager = new RiskManager(config.riskManagement);
    this.feeCalculator = new FeeCalculator(config.feeCalculation);
  }

  /**
   * サービスを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 リアル取引サービス初期化中...');

      // 取引統合サービスの初期化
      const tradingInitialized = await this.tradingIntegration.initialize();
      if (!tradingInitialized) {
        console.log('❌ 取引統合サービス初期化失敗');
        return false;
      }

      // データ統合サービスの初期化
      const dataInitialized = await this.dataIntegration.initialize();
      if (!dataInitialized) {
        console.log('❌ データ統合サービス初期化失敗');
        return false;
      }

      // リスク管理の初期化
      await this.riskManager.initialize();

      // 口座情報の取得
      await this.loadAccounts();

      this.isInitialized = true;
      console.log('✅ リアル取引サービス初期化完了');
      return true;
    } catch (error) {
      console.error('❌ リアル取引サービス初期化エラー:', error);
      return false;
    }
  }

  /**
   * 口座情報を読み込み
   */
  private async loadAccounts(): Promise<void> {
    try {
      // OANDA口座情報取得
      const oandaAccount = await this.tradingIntegration.getAccount('OANDA');
      if (oandaAccount) {
        this.accounts.set('OANDA', this.convertToRealAccount(oandaAccount, 'OANDA'));
      }

      // ウィブル口座情報取得
      const webullAccount = await this.tradingIntegration.getAccount('WEBULL');
      if (webullAccount) {
        this.accounts.set('WEBULL', this.convertToRealAccount(webullAccount, 'WEBULL'));
      }

      console.log(`✅ 口座情報読み込み完了: ${this.accounts.size}口座`);
    } catch (error) {
      console.error('❌ 口座情報読み込みエラー:', error);
    }
  }

  /**
   * 統一口座情報をリアル口座情報に変換
   */
  private convertToRealAccount(unifiedAccount: any, broker: string): RealAccount {
    return {
      id: unifiedAccount.id || `${broker}_${Date.now()}`,
      broker,
      accountType: unifiedAccount.accountType || 'CASH',
      currency: unifiedAccount.currency || 'USD',
      totalValue: unifiedAccount.totalValue || 0,
      availableCash: unifiedAccount.availableCash || 0,
      buyingPower: unifiedAccount.buyingPower || 0,
      marginUsed: unifiedAccount.marginUsed || 0,
      marginAvailable: unifiedAccount.marginAvailable || 0,
      unrealizedPnL: unifiedAccount.unrealizedPnL || 0,
      realizedPnL: unifiedAccount.realizedPnL || 0,
      totalPnL: unifiedAccount.totalPnL || 0,
      dayPnL: unifiedAccount.dayPnL || 0,
      totalReturn: unifiedAccount.totalReturn || 0,
      totalReturnPercent: unifiedAccount.totalReturnPercent || 0,
      positions: [],
      orders: [],
      lastUpdated: new Date(),
    };
  }

  /**
   * リアル注文を発注
   */
  async placeOrder(order: Omit<RealOrder, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'filledQuantity' | 'averagePrice' | 'commission' | 'slippage' | 'netPrice' | 'totalCost'>): Promise<OrderResult> {
    try {
      if (!this.isInitialized) {
        return { success: false, error: 'サービスが初期化されていません' };
      }

      // リスクチェック
      const riskCheck = await this.riskManager.checkOrderRisk(order);
      if (!riskCheck.allowed) {
        return { success: false, error: riskCheck.reason };
      }

      // ブローカーを決定
      const broker = this.determineBroker(order.market);
      if (!broker) {
        return { success: false, error: '対応していない市場です' };
      }

      // 統一注文形式に変換
      const unifiedOrder = this.convertToUnifiedOrder(order, broker);

      // 注文発注
      const result = await this.tradingIntegration.placeOrder(unifiedOrder);
      if (!result.success || !result.order) {
        return { success: false, error: result.error || '注文発注に失敗しました' };
      }

      // リアル注文形式に変換
      const realOrder = this.convertToRealOrder(result.order, broker);

      // 注文を保存
      this.orders.set(realOrder.id, realOrder);

      // 口座情報を更新
      await this.updateAccount(broker);

      console.log(`✅ リアル注文発注成功: ${realOrder.symbol} ${realOrder.side} ${realOrder.quantity}${this.getQuantityUnit(order.market)}`);
      return { success: true, orderId: realOrder.id, order: realOrder };
    } catch (error) {
      console.error('❌ リアル注文発注エラー:', error);
      return { success: false, error: error instanceof Error ? error.message : '不明なエラー' };
    }
  }

  /**
   * 市場に基づいてブローカーを決定
   */
  private determineBroker(market: 'FX' | 'US' | 'JP'): string | null {
    switch (market) {
      case 'FX':
        return 'OANDA';
      case 'US':
        return 'WEBULL';
      case 'JP':
        return 'WEBULL'; // 日本株もウィブルで対応（実際は別のブローカーが必要）
      default:
        return null;
    }
  }

  /**
   * リアル注文を統一注文形式に変換
   */
  private convertToUnifiedOrder(order: any, broker: string): any {
    return {
      symbol: order.symbol,
      market: order.market,
      side: order.side,
      quantity: order.quantity,
      type: order.type,
      price: order.price,
      stopPrice: order.stopPrice,
      timeInForce: order.timeInForce,
      clientOrderId: order.clientOrderId,
      broker,
    };
  }

  /**
   * 統一注文をリアル注文形式に変換
   */
  private convertToRealOrder(unifiedOrder: any, broker: string): RealOrder {
    const now = new Date();
    const orderId = `${broker}_${unifiedOrder.id || Date.now()}`;

    // 手数料計算
    const commission = this.feeCalculator.calculateCommission(unifiedOrder);
    const slippage = this.feeCalculator.calculateSlippage(unifiedOrder);
    const netPrice = unifiedOrder.price || 0;
    const totalCost = unifiedOrder.quantity * netPrice + commission;

    return {
      id: orderId,
      symbol: unifiedOrder.symbol,
      market: unifiedOrder.market,
      side: unifiedOrder.side,
      quantity: unifiedOrder.quantity,
      type: unifiedOrder.type,
      price: unifiedOrder.price,
      stopPrice: unifiedOrder.stopPrice,
      timeInForce: unifiedOrder.timeInForce,
      clientOrderId: unifiedOrder.clientOrderId,
      createdAt: now,
      updatedAt: now,
      status: 'PENDING',
      filledQuantity: 0,
      averagePrice: 0,
      commission,
      slippage,
      netPrice,
      totalCost,
      broker,
    };
  }

  /**
   * 数量の単位を取得
   */
  private getQuantityUnit(market: 'FX' | 'US' | 'JP'): string {
    switch (market) {
      case 'FX':
        return '通貨単位';
      case 'US':
        return '株';
      case 'JP':
        return '株';
      default:
        return '単位';
    }
  }

  /**
   * 口座情報を更新
   */
  private async updateAccount(broker: string): Promise<void> {
    try {
      const account = await this.tradingIntegration.getAccount(broker);
      if (account) {
        this.accounts.set(broker, this.convertToRealAccount(account, broker));
      }
    } catch (error) {
      console.error(`❌ 口座情報更新エラー (${broker}):`, error);
    }
  }

  /**
   * リアルポジションを取得
   */
  async getPositions(broker?: string): Promise<RealPosition[]> {
    try {
      if (!this.isInitialized) {
        return [];
      }

      const positions: RealPosition[] = [];
      const brokers = broker ? [broker] : Array.from(this.accounts.keys());

      for (const b of brokers) {
        const unifiedPositions = await this.tradingIntegration.getPositions(b);
        for (const pos of unifiedPositions) {
          const realPosition = this.convertToRealPosition(pos, b);
          positions.push(realPosition);
          this.positions.set(realPosition.id, realPosition);
        }
      }

      return positions;
    } catch (error) {
      console.error('❌ リアルポジション取得エラー:', error);
      return [];
    }
  }

  /**
   * 統一ポジションをリアルポジション形式に変換
   */
  private convertToRealPosition(unifiedPosition: any, broker: string): RealPosition {
    const positionId = `${broker}_${unifiedPosition.id || Date.now()}`;
    const now = new Date();

    return {
      id: positionId,
      symbol: unifiedPosition.symbol,
      market: unifiedPosition.market,
      side: unifiedPosition.side,
      quantity: unifiedPosition.quantity,
      averagePrice: unifiedPosition.averagePrice,
      currentPrice: unifiedPosition.currentPrice,
      unrealizedPnL: unifiedPosition.unrealizedPnL,
      realizedPnL: unifiedPosition.realizedPnL,
      totalPnL: unifiedPosition.totalPnL,
      marketValue: unifiedPosition.marketValue,
      costBasis: unifiedPosition.costBasis,
      createdAt: unifiedPosition.createdAt || now,
      updatedAt: now,
      broker,
    };
  }

  /**
   * リアル注文を取得
   */
  async getOrders(broker?: string): Promise<RealOrder[]> {
    try {
      if (!this.isInitialized) {
        return [];
      }

      const orders: RealOrder[] = [];
      const brokers = broker ? [broker] : Array.from(this.accounts.keys());

      for (const b of brokers) {
        const unifiedOrders = await this.tradingIntegration.getOrders(b);
        for (const order of unifiedOrders) {
          const realOrder = this.convertToRealOrder(order, b);
          orders.push(realOrder);
          this.orders.set(realOrder.id, realOrder);
        }
      }

      return orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('❌ リアル注文取得エラー:', error);
      return [];
    }
  }

  /**
   * リアル口座情報を取得
   */
  async getAccount(broker?: string): Promise<RealAccount | null> {
    try {
      if (!this.isInitialized) {
        return null;
      }

      if (broker) {
        return this.accounts.get(broker) || null;
      }

      // 全口座の統合情報を返す
      const totalValue = Array.from(this.accounts.values()).reduce((sum, account) => sum + account.totalValue, 0);
      const totalPnL = Array.from(this.accounts.values()).reduce((sum, account) => sum + account.totalPnL, 0);
      const totalReturn = Array.from(this.accounts.values()).reduce((sum, account) => sum + account.totalReturn, 0);

      return {
        id: 'COMBINED',
        broker: 'COMBINED',
        accountType: 'CASH',
        currency: 'USD',
        totalValue,
        availableCash: Array.from(this.accounts.values()).reduce((sum, account) => sum + account.availableCash, 0),
        buyingPower: Array.from(this.accounts.values()).reduce((sum, account) => sum + account.buyingPower, 0),
        marginUsed: Array.from(this.accounts.values()).reduce((sum, account) => sum + account.marginUsed, 0),
        marginAvailable: Array.from(this.accounts.values()).reduce((sum, account) => sum + account.marginAvailable, 0),
        unrealizedPnL: Array.from(this.accounts.values()).reduce((sum, account) => sum + account.unrealizedPnL, 0),
        realizedPnL: Array.from(this.accounts.values()).reduce((sum, account) => sum + account.realizedPnL, 0),
        totalPnL,
        dayPnL: Array.from(this.accounts.values()).reduce((sum, account) => sum + account.dayPnL, 0),
        totalReturn,
        totalReturnPercent: totalValue > 0 ? (totalReturn / totalValue) * 100 : 0,
        positions: [],
        orders: [],
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('❌ リアル口座情報取得エラー:', error);
      return null;
    }
  }

  /**
   * 注文をキャンセル
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        console.log(`❌ 注文が見つかりません: ${orderId}`);
        return false;
      }

      const result = await this.tradingIntegration.cancelOrder(orderId, order.broker);
      if (result) {
        order.status = 'CANCELLED';
        order.updatedAt = new Date();
        this.orders.set(orderId, order);
        console.log(`✅ 注文キャンセル成功: ${orderId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ 注文キャンセルエラー:', error);
      return false;
    }
  }

  /**
   * 現在価格を取得
   */
  async getCurrentPrice(symbol: string, market: 'FX' | 'US' | 'JP'): Promise<number | null> {
    try {
      const price = await this.dataIntegration.getStockData(symbol, market);
      return price?.price || null;
    } catch (error) {
      console.error('❌ 現在価格取得エラー:', error);
      return null;
    }
  }

  /**
   * 接続状態をチェック
   */
  async checkConnectionStatus(): Promise<{ overall: boolean; brokers: Record<string, boolean> }> {
    try {
      const status = await this.tradingIntegration.checkConnectionStatus();
      return {
        overall: status.overall,
        brokers: {
          OANDA: status.oanda,
          WEBULL: status.webull,
        },
      };
    } catch (error) {
      console.error('❌ 接続状態チェックエラー:', error);
      return { overall: false, brokers: {} };
    }
  }

  /**
   * サービスを停止
   */
  stop(): void {
    this.tradingIntegration.stop();
    this.isInitialized = false;
    console.log('⏹️ リアル取引サービス停止');
  }
}
