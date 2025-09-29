/**
 * 高度化デモトレードサービス
 * 複数市場対応、現実的なシミュレーション、高度なリスク管理
 */

import { TradingIntegrationService, UnifiedOrder, UnifiedPosition, UnifiedQuote } from './trading-integration-service';
import { DataIntegrationService, StockData } from './data-integration-service';
import { FeeCalculator } from './fee-calculator';
import { RiskManager } from './risk-manager';

export interface AdvancedDemoConfig {
  initialCapital: number;
  markets: Array<{
    name: string;
    type: 'FX' | 'US' | 'JP';
    enabled: boolean;
    allocation: number; // 割合（%）
  }>;
  riskManagement: {
    maxPositionSize: number;
    maxPortfolioRisk: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
    maxDrawdown: number;
  };
  simulation: {
    slippage: number; // %
    commissionRate: number; // %
    realisticExecution: boolean;
    liquidityConsideration: boolean;
  };
}

export interface AdvancedDemoOrder {
  id: string;
  symbol: string;
  market: 'FX' | 'US' | 'JP';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT';
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  createTime: Date;
  fillTime?: Date;
  filledQuantity: number;
  filledPrice?: number;
  commission: number;
  slippage: number;
  netPrice: number;
}

export interface AdvancedDemoPosition {
  symbol: string;
  market: 'FX' | 'US' | 'JP';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPercent: number;
  cost: number;
  commission: number;
  lastUpdated: Date;
}

export interface AdvancedDemoAccount {
  totalValue: number;
  cashBalance: number;
  marketValue: number;
  unrealizedPl: number;
  realizedPl: number;
  totalCommission: number;
  dailyPnL: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  lastUpdated: Date;
}

export interface MarketSimulator {
  name: string;
  type: 'FX' | 'US' | 'JP';
  simulateExecution(order: AdvancedDemoOrder, currentPrice: number): Promise<{
    filled: boolean;
    filledPrice: number;
    slippage: number;
    commission: number;
  }>;
  calculateLiquidity(symbol: string, quantity: number): number;
  getMarketHours(): { open: string; close: string; timezone: string };
}

export class AdvancedDemoTradingService {
  private config: AdvancedDemoConfig;
  private tradingService: TradingIntegrationService;
  private dataService: DataIntegrationService;
  private riskManager: RiskManager;
  private positions: Map<string, AdvancedDemoPosition> = new Map();
  private orders: Map<string, AdvancedDemoOrder> = new Map();
  private account: AdvancedDemoAccount;
  private marketSimulators: Map<string, MarketSimulator> = new Map();
  private isRunning: boolean = false;

  constructor(
    config: AdvancedDemoConfig,
    tradingService: TradingIntegrationService,
    dataService: DataIntegrationService
  ) {
    this.config = config;
    this.tradingService = tradingService;
    this.dataService = dataService;
    this.riskManager = new RiskManager(config.riskManagement);
    
    this.account = {
      totalValue: config.initialCapital,
      cashBalance: config.initialCapital,
      marketValue: 0,
      unrealizedPl: 0,
      realizedPl: 0,
      totalCommission: 0,
      dailyPnL: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      lastUpdated: new Date(),
    };

    this.initializeMarketSimulators();
  }

  /**
   * 市場シミュレーターを初期化
   */
  private initializeMarketSimulators(): void {
    this.marketSimulators.set('FX', new FxMarketSimulator());
    this.marketSimulators.set('US', new UsMarketSimulator());
    this.marketSimulators.set('JP', new JpMarketSimulator());
  }

  /**
   * デモトレードを開始
   */
  async startDemoTrading(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ デモトレードは既に開始されています');
      return;
    }

    console.log('🔄 高度化デモトレード開始...');
    this.isRunning = true;

    // 初期化
    await this.initializeDemoTrading();

    // 定期更新を開始
    this.startPeriodicUpdates();

    console.log('✅ 高度化デモトレード開始完了');
  }

  /**
   * デモトレードを停止
   */
  stopDemoTrading(): void {
    if (!this.isRunning) {
      console.log('⚠️ デモトレードは開始されていません');
      return;
    }

    console.log('⏹️ 高度化デモトレード停止');
    this.isRunning = false;
  }

  /**
   * デモトレードを初期化
   */
  private async initializeDemoTrading(): Promise<void> {
    // 口座情報を取得
    await this.updateAccountInfo();
    
    // ポジション情報を取得
    await this.updatePositions();
    
    // 注文履歴を取得
    await this.updateOrders();
  }

  /**
   * 注文を発注
   */
  async placeOrder(order: {
    symbol: string;
    market: 'FX' | 'US' | 'JP';
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT';
    stopPrice?: number;
  }): Promise<AdvancedDemoOrder | null> {
    try {
      // リスクチェック
      const riskCheck = await this.checkRiskLimits(order);
      if (!riskCheck.allowed) {
        console.warn(`❌ リスク制限により注文拒否: ${riskCheck.reason}`);
        return null;
      }

      // 現在価格を取得
      const currentPrice = await this.getCurrentPrice(order.symbol, order.market);
      if (!currentPrice) {
        console.error(`❌ 現在価格取得失敗: ${order.symbol}`);
        return null;
      }

      // 注文を作成
      const demoOrder: AdvancedDemoOrder = {
        id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol: order.symbol,
        market: order.market,
        side: order.side,
        quantity: order.quantity,
        price: order.price || currentPrice.price,
        type: order.type,
        status: 'PENDING',
        createTime: new Date(),
        filledQuantity: 0,
        commission: 0,
        slippage: 0,
        netPrice: 0,
      };

      // 注文を記録
      this.orders.set(demoOrder.id, demoOrder);

      // 約定をシミュレート
      await this.simulateOrderExecution(demoOrder, currentPrice.price);

      return demoOrder;
    } catch (error) {
      console.error('注文発注エラー:', error);
      return null;
    }
  }

  /**
   * 注文の約定をシミュレート
   */
  private async simulateOrderExecution(
    order: AdvancedDemoOrder,
    currentPrice: number
  ): Promise<void> {
    const simulator = this.marketSimulators.get(order.market);
    if (!simulator) {
      order.status = 'REJECTED';
      return;
    }

    try {
      // 約定をシミュレート
      const execution = await simulator.simulateExecution(order, currentPrice);
      
      if (execution.filled) {
        order.status = 'FILLED';
        order.fillTime = new Date();
        order.filledQuantity = order.quantity;
        order.filledPrice = execution.filledPrice;
        order.commission = execution.commission;
        order.slippage = execution.slippage;
        order.netPrice = execution.filledPrice;

        // ポジションを更新
        await this.updatePositionAfterTrade(order);

        // 口座情報を更新
        await this.updateAccountInfo();
      } else {
        order.status = 'REJECTED';
      }
    } catch (error) {
      console.error('約定シミュレーションエラー:', error);
      order.status = 'REJECTED';
    }
  }

  /**
   * 取引後のポジションを更新
   */
  private async updatePositionAfterTrade(order: AdvancedDemoOrder): Promise<void> {
    const positionKey = `${order.symbol}_${order.market}`;
    const existingPosition = this.positions.get(positionKey);

    if (existingPosition) {
      // 既存ポジションを更新
      const totalQuantity = existingPosition.quantity + (order.side === 'BUY' ? order.quantity : -order.quantity);
      const totalCost = existingPosition.cost + (order.side === 'BUY' ? order.netPrice * order.quantity : -order.netPrice * order.quantity);
      
      if (totalQuantity === 0) {
        // ポジションクローズ
        this.positions.delete(positionKey);
      } else {
        // ポジション更新
        existingPosition.quantity = totalQuantity;
        existingPosition.cost = totalCost;
        existingPosition.averagePrice = totalCost / totalQuantity;
        existingPosition.commission += order.commission;
        existingPosition.lastUpdated = new Date();
      }
    } else if (order.side === 'BUY') {
      // 新しいポジション
      const newPosition: AdvancedDemoPosition = {
        symbol: order.symbol,
        market: order.market,
        quantity: order.quantity,
        averagePrice: order.netPrice,
        currentPrice: order.netPrice,
        marketValue: order.netPrice * order.quantity,
        unrealizedPl: 0,
        unrealizedPlPercent: 0,
        cost: order.netPrice * order.quantity,
        commission: order.commission,
        lastUpdated: new Date(),
      };
      this.positions.set(positionKey, newPosition);
    }

    // 手数料を口座に反映
    this.account.totalCommission += order.commission;
    this.account.cashBalance -= order.commission;
  }

  /**
   * リスク制限をチェック
   */
  private async checkRiskLimits(order: {
    symbol: string;
    market: 'FX' | 'US' | 'JP';
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
  }): Promise<{ allowed: boolean; reason?: string }> {
    // ポジションサイズチェック
    const positionValue = order.quantity * (order.price || 0);
    if (positionValue > this.config.riskManagement.maxPositionSize) {
      return { allowed: false, reason: 'ポジションサイズが制限を超えています' };
    }

    // ポートフォリオリスクチェック
    const currentPositions = Array.from(this.positions.values());
    const portfolioRisk = this.riskManager.analyzePortfolioRisk(
      currentPositions.map(p => ({
        symbol: p.symbol,
        size: p.quantity,
        entryPrice: p.averagePrice,
        currentPrice: p.currentPrice,
      })),
      this.account.totalValue
    );

    if (!portfolioRisk.isWithinRiskLimit) {
      return { allowed: false, reason: 'ポートフォリオリスクが制限を超えています' };
    }

    // 日次損失チェック
    if (this.account.dailyPnL < -this.config.riskManagement.maxDailyLoss) {
      return { allowed: false, reason: '日次損失制限に達しています' };
    }

    return { allowed: true };
  }

  /**
   * 現在価格を取得
   */
  private async getCurrentPrice(symbol: string, market: 'FX' | 'US' | 'JP'): Promise<StockData | null> {
    try {
      if (market === 'FX' || market === 'US') {
        const quote = await this.tradingService.getCurrentPrice(symbol, market);
        if (quote) {
          return {
            symbol: quote.symbol,
            market: market,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            timestamp: quote.timestamp,
            source: quote.broker,
          };
        }
      } else if (market === 'JP') {
        return await this.dataService.getStockData(symbol, 'JP');
      }
      return null;
    } catch (error) {
      console.error('現在価格取得エラー:', error);
      return null;
    }
  }

  /**
   * 口座情報を更新
   */
  private async updateAccountInfo(): Promise<void> {
    let marketValue = 0;
    let unrealizedPl = 0;

    // ポジションの現在価値を計算
    for (const position of this.positions.values()) {
      const currentPrice = await this.getCurrentPrice(position.symbol, position.market);
      if (currentPrice) {
        position.currentPrice = currentPrice.price;
        position.marketValue = position.quantity * currentPrice.price;
        position.unrealizedPl = position.marketValue - position.cost;
        position.unrealizedPlPercent = (position.unrealizedPl / position.cost) * 100;
        position.lastUpdated = new Date();

        marketValue += position.marketValue;
        unrealizedPl += position.unrealizedPl;
      }
    }

    // 口座情報を更新
    this.account.marketValue = marketValue;
    this.account.unrealizedPl = unrealizedPl;
    this.account.totalValue = this.account.cashBalance + marketValue;
    this.account.totalReturn = this.account.totalValue - this.config.initialCapital;
    this.account.totalReturnPercent = (this.account.totalReturn / this.config.initialCapital) * 100;
    this.account.lastUpdated = new Date();
  }

  /**
   * ポジション情報を更新
   */
  private async updatePositions(): Promise<void> {
    // 実取引のポジションを取得
    const realPositions = await this.tradingService.getAllPositions();
    
    // デモポジションと統合
    for (const realPosition of realPositions) {
      const positionKey = `${realPosition.symbol}_${realPosition.market}`;
      const demoPosition: AdvancedDemoPosition = {
        symbol: realPosition.symbol,
        market: realPosition.market,
        quantity: realPosition.quantity,
        averagePrice: realPosition.averagePrice,
        currentPrice: realPosition.currentPrice,
        marketValue: realPosition.marketValue,
        unrealizedPl: realPosition.unrealizedPl,
        unrealizedPlPercent: realPosition.unrealizedPlPercent,
        cost: realPosition.marketValue - realPosition.unrealizedPl,
        commission: 0, // 実取引の手数料は別途管理
        lastUpdated: new Date(),
      };
      this.positions.set(positionKey, demoPosition);
    }
  }

  /**
   * 注文履歴を更新
   */
  private async updateOrders(): Promise<void> {
    // 実取引の注文を取得
    const realOrders = await this.tradingService.getAllOrders();
    
    // デモ注文と統合
    for (const realOrder of realOrders) {
      const demoOrder: AdvancedDemoOrder = {
        id: realOrder.id,
        symbol: realOrder.symbol,
        market: realOrder.market,
        side: realOrder.side,
        quantity: realOrder.quantity,
        price: realOrder.price,
        type: realOrder.type,
        status: realOrder.status,
        createTime: realOrder.createTime,
        fillTime: realOrder.fillTime,
        filledQuantity: realOrder.filledQuantity,
        filledPrice: realOrder.filledPrice,
        commission: 0, // 実取引の手数料は別途管理
        slippage: 0,
        netPrice: realOrder.filledPrice || realOrder.price,
      };
      this.orders.set(demoOrder.id, demoOrder);
    }
  }

  /**
   * 定期更新を開始
   */
  private startPeriodicUpdates(): void {
    setInterval(async () => {
      if (this.isRunning) {
        await this.updateAccountInfo();
        await this.updatePositions();
      }
    }, 5000); // 5秒ごとに更新
  }

  /**
   * 口座情報を取得
   */
  getAccount(): AdvancedDemoAccount {
    return { ...this.account };
  }

  /**
   * ポジション一覧を取得
   */
  getPositions(): AdvancedDemoPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * 注文履歴を取得
   */
  getOrders(): AdvancedDemoOrder[] {
    return Array.from(this.orders.values()).sort(
      (a, b) => b.createTime.getTime() - a.createTime.getTime()
    );
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<AdvancedDemoConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.riskManager.updateRiskParameters(newConfig.riskManagement || {});
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): AdvancedDemoConfig {
    return { ...this.config };
  }

  /**
   * デモトレード状態を取得
   */
  isDemoTradingActive(): boolean {
    return this.isRunning;
  }
}

/**
 * FX市場シミュレーター
 */
class FxMarketSimulator implements MarketSimulator {
  name = 'FX';
  type = 'FX' as const;

  async simulateExecution(order: AdvancedDemoOrder, currentPrice: number): Promise<{
    filled: boolean;
    filledPrice: number;
    slippage: number;
    commission: number;
  }> {
    // FXは流動性が高いため、約定率は高い
    const fillProbability = 0.95;
    const filled = Math.random() < fillProbability;

    if (!filled) {
      return { filled: false, filledPrice: 0, slippage: 0, commission: 0 };
    }

    // スリッページ計算（FXは小さい）
    const slippage = currentPrice * 0.0001 * (Math.random() - 0.5);
    const filledPrice = currentPrice + slippage;

    // 手数料計算（FXはスプレッドのみ）
    const commission = 0;

    return { filled: true, filledPrice, slippage, commission };
  }

  calculateLiquidity(symbol: string, quantity: number): number {
    // FXは流動性が高い
    return 0.95;
  }

  getMarketHours(): { open: string; close: string; timezone: string } {
    return { open: '00:00', close: '23:59', timezone: 'UTC' };
  }
}

/**
 * 米国株市場シミュレーター
 */
class UsMarketSimulator implements MarketSimulator {
  name = 'US';
  type = 'US' as const;

  async simulateExecution(order: AdvancedDemoOrder, currentPrice: number): Promise<{
    filled: boolean;
    filledPrice: number;
    slippage: number;
    commission: number;
  }> {
    // 米国株の約定率
    const fillProbability = 0.90;
    const filled = Math.random() < fillProbability;

    if (!filled) {
      return { filled: false, filledPrice: 0, slippage: 0, commission: 0 };
    }

    // スリッページ計算
    const slippage = currentPrice * 0.001 * (Math.random() - 0.5);
    const filledPrice = currentPrice + slippage;

    // 手数料計算（米国株は無料が多い）
    const commission = 0;

    return { filled: true, filledPrice, slippage, commission };
  }

  calculateLiquidity(symbol: string, quantity: number): number {
    // 米国株は流動性が高い
    return 0.90;
  }

  getMarketHours(): { open: string; close: string; timezone: string } {
    return { open: '09:30', close: '16:00', timezone: 'EST' };
  }
}

/**
 * 日本株市場シミュレーター
 */
class JpMarketSimulator implements MarketSimulator {
  name = 'JP';
  type = 'JP' as const;

  async simulateExecution(order: AdvancedDemoOrder, currentPrice: number): Promise<{
    filled: boolean;
    filledPrice: number;
    slippage: number;
    commission: number;
  }> {
    // 日本株の約定率
    const fillProbability = 0.85;
    const filled = Math.random() < fillProbability;

    if (!filled) {
      return { filled: false, filledPrice: 0, slippage: 0, commission: 0 };
    }

    // スリッページ計算
    const slippage = currentPrice * 0.002 * (Math.random() - 0.5);
    const filledPrice = currentPrice + slippage;

    // 手数料計算（日本株は手数料あり）
    const commission = FeeCalculator.calculateCommission(order.quantity * filledPrice, 'sbi').total;

    return { filled: true, filledPrice, slippage, commission };
  }

  calculateLiquidity(symbol: string, quantity: number): number {
    // 日本株は流動性が中程度
    return 0.80;
  }

  getMarketHours(): { open: string; close: string; timezone: string } {
    return { open: '09:00', close: '15:00', timezone: 'JST' };
  }
}
