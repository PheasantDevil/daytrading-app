export interface DemoOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: Date;
  filledAt?: Date;
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

  private constructor() {}

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

    // 買い注文の場合、資金チェック
    if (side === 'BUY') {
      const requiredAmount = quantity * price;
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

    const amount = order.quantity * order.price;

    if (order.side === 'BUY') {
      this.currentBalance -= amount;
      this.updatePosition(order.symbol, order.quantity, order.price, 'BUY');
    } else {
      this.currentBalance += amount;
      this.updatePosition(order.symbol, order.quantity, order.price, 'SELL');
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
   * デモ環境をリセット
   */
  reset(): void {
    this.positions.clear();
    this.orders.clear();
    this.currentBalance = this.initialBalance;
  }
}

export const demoTradingService = DemoTradingService.getInstance();
