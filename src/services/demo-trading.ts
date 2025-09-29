import { FeeCalculator } from './fee-calculator';
import { RiskManager } from './risk-manager';

export interface DemoOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: Date;
  filledAt?: Date;
  commission: number;
  slippage: number;
  netPrice: number;
}

export interface DemoPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export class DemoTradingService {
  private static instance: DemoTradingService;
  private positions: Map<string, DemoPosition> = new Map();
  private orders: Map<string, DemoOrder> = new Map();
  private initialBalance = 1000000; // 100万円のデモ資金
  private currentBalance = this.initialBalance;
  private riskManager: RiskManager;
  private slippage = 0.001; // 0.1%のスリッページ

  private constructor() {
    this.riskManager = new RiskManager({
      maxPositionSize: 100000, // 10万円
      maxPortfolioRisk: 10, // 10%
      stopLossPercent: 5, // 5%
      takeProfitPercent: 10, // 10%
      maxDailyLoss: 50000, // 5万円
      maxDrawdown: 20, // 20%
    });
  }

  public static getInstance(): DemoTradingService {
    if (!DemoTradingService.instance) {
      DemoTradingService.instance = new DemoTradingService();
    }
    return DemoTradingService.instance;
  }

  /**
   * デモ注文を発注
   */
  async placeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): Promise<DemoOrder> {
    const orderId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // スリッページを適用
    const slippageAmount = price * this.slippage;
    const netPrice = side === 'BUY' ? price + slippageAmount : price - slippageAmount;

    // 手数料を計算
    const commission = FeeCalculator.calculateCommission(quantity * netPrice, 'sbi');

    // 買い注文の場合、資金チェック
    if (side === 'BUY') {
      const requiredAmount = quantity * netPrice + commission.total;
      if (requiredAmount > this.currentBalance) {
        throw new Error('Insufficient funds');
      }
    }

    // 売り注文の場合、ポジションチェック
    if (side === 'SELL') {
      const currentPosition = this.positions.get(symbol);
      if (!currentPosition || currentPosition.quantity < quantity) {
        throw new Error('Insufficient position');
      }
    }

    const order: DemoOrder = {
      id: orderId,
      symbol,
      side,
      quantity,
      price,
      status: 'PENDING',
      createdAt: new Date(),
      commission: commission.total,
      slippage: slippageAmount,
      netPrice: netPrice,
    };

    this.orders.set(orderId, order);

    // デモ環境では即座に約定
    setTimeout(() => {
      this.executeOrder(orderId);
    }, 1000);

    return order;
  }

  /**
   * 注文を約定
   */
  private executeOrder(orderId: string): void {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'PENDING') return;

    order.status = 'FILLED';
    order.filledAt = new Date();

    const amount = order.quantity * order.netPrice;

    if (order.side === 'BUY') {
      this.currentBalance -= (amount + order.commission);
      this.updatePosition(order.symbol, order.quantity, order.netPrice, 'BUY');
    } else {
      this.currentBalance += (amount - order.commission);
      this.updatePosition(order.symbol, order.quantity, order.netPrice, 'SELL');
    }
  }

  /**
   * ポジションを更新
   */
  private updatePosition(
    symbol: string,
    quantity: number,
    price: number,
    side: 'BUY' | 'SELL'
  ): void {
    const currentPosition = this.positions.get(symbol) || {
      symbol,
      quantity: 0,
      averagePrice: 0,
      currentPrice: price,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
    };

    if (side === 'BUY') {
      const totalQuantity = currentPosition.quantity + quantity;
      const totalValue =
        currentPosition.quantity * currentPosition.averagePrice +
        quantity * price;
      currentPosition.quantity = totalQuantity;
      currentPosition.averagePrice =
        totalQuantity > 0 ? totalValue / totalQuantity : 0;
    } else {
      currentPosition.quantity -= quantity;
      if (currentPosition.quantity < 0) {
        currentPosition.quantity = 0;
        currentPosition.averagePrice = 0;
      }
    }

    this.positions.set(symbol, currentPosition);
  }

  /**
   * 現在のポジションを取得
   */
  getPositions(): DemoPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * 注文履歴を取得
   */
  getOrders(): DemoOrder[] {
    return Array.from(this.orders.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * 口座残高を取得
   */
  getBalance(): number {
    return this.currentBalance;
  }

  /**
   * 総資産を取得
   */
  getTotalAssets(): number {
    let totalValue = this.currentBalance;

    for (const position of this.positions.values()) {
      totalValue += position.quantity * position.currentPrice;
    }

    return totalValue;
  }

  /**
   * ポジションの現在価格を更新
   */
  updatePositionPrice(symbol: string, currentPrice: number): void {
    const position = this.positions.get(symbol);
    if (position) {
      position.currentPrice = currentPrice;
      position.unrealizedPnl =
        (currentPrice - position.averagePrice) * position.quantity;
      position.unrealizedPnlPercent =
        position.averagePrice > 0
          ? ((currentPrice - position.averagePrice) / position.averagePrice) *
            100
          : 0;
    }
  }

  /**
   * 注文をキャンセル
   */
  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (order && order.status === 'PENDING') {
      order.status = 'CANCELLED';
      return true;
    }
    return false;
  }

  /**
   * リスク管理レポートを生成
   */
  generateRiskReport(): {
    portfolioRisk: any;
    positionRisks: any[];
    dailyLossStatus: boolean;
    recommendations: string[];
  } {
    const positions = Array.from(this.positions.values()).map(p => ({
      symbol: p.symbol,
      size: p.quantity,
      entryPrice: p.averagePrice,
      currentPrice: p.currentPrice,
    }));

    const dailyPnL = this.getTotalAssets() - this.initialBalance;
    
    return this.riskManager.generateRiskReport(
      positions,
      this.currentBalance,
      dailyPnL
    );
  }

  /**
   * ポジションサイジングを計算
   */
  calculatePositionSize(
    symbol: string,
    entryPrice: number,
    stopLossPrice: number,
    riskPercent: number = 2
  ): number {
    return this.riskManager.calculatePositionSize(
      this.currentBalance,
      entryPrice,
      stopLossPrice,
      riskPercent
    );
  }

  /**
   * リスクパラメータを更新
   */
  updateRiskParameters(newParameters: Partial<{
    maxPositionSize: number;
    maxPortfolioRisk: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
    maxDrawdown: number;
  }>): void {
    this.riskManager.updateRiskParameters(newParameters);
  }

  /**
   * デモ環境をリセット
   */
  reset(): void {
    this.positions.clear();
    this.orders.clear();
    this.currentBalance = this.initialBalance;
  }
}

export const demoTradingService = DemoTradingService.getInstance();
