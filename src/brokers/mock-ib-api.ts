import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

/**
 * Interactive Brokers APIのモック実装
 * 実際のTWS APIを使用せずに、仮想取引をシミュレート
 */

export interface MockIBContract {
  symbol: string;
  secType: 'STK' | 'OPT' | 'FUT' | 'CASH';
  exchange: string;
  currency: string;
  primaryExchange?: string;
}

export interface MockIBOrder {
  orderId: number;
  action: 'BUY' | 'SELL';
  totalQuantity: number;
  orderType: 'MKT' | 'LMT' | 'STP' | 'STP LMT';
  lmtPrice?: number;
  auxPrice?: number;
  tif: 'DAY' | 'GTC' | 'IOC';
}

export interface MockIBPosition {
  contract: MockIBContract;
  position: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

export interface MockIBAccountSummary {
  netLiquidation: number;
  totalCashValue: number;
  grossPositionValue: number;
  buyingPower: number;
  availableFunds: number;
  excessLiquidity: number;
  currency: string;
}

export class MockIBApi extends EventEmitter {
  private logger: Logger;
  private isConnected: boolean = false;
  private accountId: string;
  private nextOrderId: number = 1;

  // 仮想口座データ
  private virtualAccount: {
    balance: number;
    positions: Map<string, MockIBPosition>;
    orders: Map<
      number,
      MockIBOrder & { contract: MockIBContract; status: string }
    >;
    trades: Array<{
      timestamp: Date;
      symbol: string;
      action: string;
      quantity: number;
      price: number;
      pnl: number;
    }>;
  };

  // 市場データシミュレーター
  private marketPrices: Map<string, number> = new Map();
  private marketDataInterval?: NodeJS.Timeout;

  constructor(config: {
    host: string;
    port: number;
    clientId: number;
    accountId: string;
  }) {
    super();
    this.logger = new Logger('MockIBApi');
    this.accountId = config.accountId || 'DU1234567';

    // 初期仮想口座設定
    this.virtualAccount = {
      balance: 100000, // 初期資金 $100,000
      positions: new Map(),
      orders: new Map(),
      trades: [],
    };

    // 初期市場価格の設定
    this.initializeMarketPrices();
  }

  /**
   * 初期市場価格の設定
   */
  private initializeMarketPrices(): void {
    // 米国株（Yahoo Financeからのリアルタイム価格で初期化される）
    this.marketPrices.set('AAPL', 175.5);
    this.marketPrices.set('GOOGL', 140.25);
    this.marketPrices.set('MSFT', 380.75);
    this.marketPrices.set('TSLA', 245.3);
    this.marketPrices.set('AMZN', 155.8);
    this.marketPrices.set('META', 485.2);
    this.marketPrices.set('NVDA', 875.6);

    // 日本株（円建て）
    this.marketPrices.set('7203', 2850); // トヨタ自動車
    this.marketPrices.set('6758', 13500); // ソニー
    this.marketPrices.set('9984', 9800); // ソフトバンクグループ
  }

  /**
   * Yahoo Financeからのリアルタイム価格で初期化
   */
  async initializeWithYahooFinance(
    yahooQuotes: Map<string, number>
  ): Promise<void> {
    this.logger.info('Yahoo Financeのリアルタイム価格で初期化中...');

    for (const [symbol, price] of yahooQuotes.entries()) {
      this.marketPrices.set(symbol, price);
      this.logger.debug(`${symbol}: $${price}`);
    }

    this.logger.info(`✅ ${yahooQuotes.size}銘柄の価格を設定しました`);
  }

  /**
   * 接続
   */
  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.info('モックIBApiに接続中...');

      setTimeout(() => {
        this.isConnected = true;
        this.logger.info(
          'モックIBApiに接続しました（ペーパートレーディングモード）'
        );
        this.emit('connected');

        // 市場価格のシミュレーション開始
        this.startMarketSimulation();

        resolve();
      }, 500);
    });
  }

  /**
   * 市場シミュレーションの開始
   */
  private startMarketSimulation(): void {
    this.marketDataInterval = setInterval(() => {
      // 全銘柄の価格を±0.5%の範囲でランダムに変動
      for (const [symbol, price] of this.marketPrices.entries()) {
        const change = (Math.random() - 0.5) * price * 0.01; // ±0.5%
        const newPrice = Math.max(price + change, 0.01);
        this.marketPrices.set(symbol, newPrice);

        // ポジションの時価評価を更新
        this.updatePositionValue(symbol, newPrice);
      }
    }, 1000); // 1秒ごとに更新
  }

  /**
   * ポジションの時価評価更新
   */
  private updatePositionValue(symbol: string, newPrice: number): void {
    const position = this.virtualAccount.positions.get(symbol);
    if (position) {
      position.marketPrice = newPrice;
      position.marketValue = position.position * newPrice;
      position.unrealizedPnL =
        (newPrice - position.averageCost) * position.position;
    }
  }

  /**
   * 切断
   */
  async disconnect(): Promise<void> {
    if (this.marketDataInterval) {
      clearInterval(this.marketDataInterval);
    }

    this.isConnected = false;
    this.logger.info('モックIBApiから切断しました');
    this.emit('disconnected');
  }

  /**
   * 注文の発注
   */
  async placeOrder(
    orderId: number,
    contract: MockIBContract,
    order: MockIBOrder
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('モックIBApiに接続されていません');
    }

    this.logger.info(
      `注文発注: ${contract.symbol} ${order.action} ${order.totalQuantity} @ ${order.orderType}`
    );

    // 市場価格を取得
    const marketPrice = this.marketPrices.get(contract.symbol) || 100;
    const executionPrice =
      order.orderType === 'LMT' ? order.lmtPrice || marketPrice : marketPrice;

    // 注文を保存
    this.virtualAccount.orders.set(orderId, {
      ...order,
      contract,
      status: 'Filled',
    });

    // ポジションを更新
    await this.updatePosition(contract, order, executionPrice);

    // 約定通知
    this.emit('orderStatus', {
      orderId,
      status: 'Filled',
      filled: order.totalQuantity,
      remaining: 0,
      avgFillPrice: executionPrice,
    });

    this.emit('execDetails', {
      orderId,
      contract,
      execution: {
        execId: `exec_${Date.now()}`,
        time: new Date().toISOString(),
        side: order.action,
        shares: order.totalQuantity,
        price: executionPrice,
      },
    });
  }

  /**
   * ポジションの更新
   */
  private async updatePosition(
    contract: MockIBContract,
    order: MockIBOrder,
    executionPrice: number
  ): Promise<void> {
    const symbol = contract.symbol;
    const quantity =
      order.action === 'BUY' ? order.totalQuantity : -order.totalQuantity;
    const cost = executionPrice * order.totalQuantity;

    // 既存ポジションを取得
    let position = this.virtualAccount.positions.get(symbol);

    if (!position) {
      // 新規ポジション
      position = {
        contract,
        position: quantity,
        averageCost: executionPrice,
        marketPrice: executionPrice,
        marketValue: quantity * executionPrice,
        unrealizedPnL: 0,
        realizedPnL: 0,
      };
      this.virtualAccount.positions.set(symbol, position);
    } else {
      // ポジション更新
      const newQuantity = position.position + quantity;

      if (newQuantity === 0) {
        // ポジションクローズ - 実現損益を計算
        const realizedPnL =
          (executionPrice - position.averageCost) * Math.abs(quantity);
        position.realizedPnL += realizedPnL;
        this.virtualAccount.balance += realizedPnL;

        // ポジション削除
        this.virtualAccount.positions.delete(symbol);
      } else if (
        (position.position > 0 && quantity > 0) ||
        (position.position < 0 && quantity < 0)
      ) {
        // ポジション追加
        const totalCost =
          position.averageCost * Math.abs(position.position) + cost;
        const totalQuantity = Math.abs(position.position) + Math.abs(quantity);
        position.averageCost = totalCost / totalQuantity;
        position.position = newQuantity;
        position.marketValue = position.position * position.marketPrice;
        position.unrealizedPnL =
          (position.marketPrice - position.averageCost) * position.position;
      } else {
        // 部分決済
        const closedQuantity = Math.min(
          Math.abs(position.position),
          Math.abs(quantity)
        );
        const realizedPnL =
          (executionPrice - position.averageCost) *
          closedQuantity *
          (position.position > 0 ? 1 : -1);
        position.realizedPnL += realizedPnL;
        this.virtualAccount.balance += realizedPnL;
        position.position = newQuantity;

        if (newQuantity === 0) {
          this.virtualAccount.positions.delete(symbol);
        } else {
          position.marketValue = position.position * position.marketPrice;
          position.unrealizedPnL =
            (position.marketPrice - position.averageCost) * position.position;
        }
      }
    }

    // 取引履歴に追加
    this.virtualAccount.trades.push({
      timestamp: new Date(),
      symbol,
      action: order.action,
      quantity: order.totalQuantity,
      price: executionPrice,
      pnl: position?.realizedPnL || 0,
    });

    // 残高更新（手数料控除）
    const commission = this.calculateCommission(
      order.totalQuantity,
      executionPrice
    );
    this.virtualAccount.balance -= cost + commission;
  }

  /**
   * 手数料の計算
   */
  private calculateCommission(quantity: number, price: number): number {
    // Interactive Brokersの手数料: 1株あたり$0.005、最低$1
    const commission = Math.max(quantity * 0.005, 1);
    return commission;
  }

  /**
   * 注文のキャンセル
   */
  async cancelOrder(orderId: number): Promise<void> {
    const order = this.virtualAccount.orders.get(orderId);
    if (order) {
      order.status = 'Cancelled';
      this.logger.info(`注文をキャンセルしました: ${orderId}`);
      this.emit('orderStatus', {
        orderId,
        status: 'Cancelled',
      });
    }
  }

  /**
   * ポジション情報の取得
   */
  async reqPositions(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('モックIBApiに接続されていません');
    }

    for (const [symbol, position] of this.virtualAccount.positions.entries()) {
      this.emit('position', {
        account: this.accountId,
        contract: position.contract,
        pos: position.position,
        avgCost: position.averageCost,
      });
    }

    this.emit('positionEnd');
  }

  /**
   * アカウントサマリーの取得
   */
  async reqAccountSummary(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('モックIBApiに接続されていません');
    }

    const positions = Array.from(this.virtualAccount.positions.values());
    const grossPositionValue = positions.reduce(
      (sum, pos) => sum + Math.abs(pos.marketValue),
      0
    );
    const unrealizedPnL = positions.reduce(
      (sum, pos) => sum + pos.unrealizedPnL,
      0
    );
    const netLiquidation =
      this.virtualAccount.balance + grossPositionValue + unrealizedPnL;

    const summary: MockIBAccountSummary = {
      netLiquidation,
      totalCashValue: this.virtualAccount.balance,
      grossPositionValue,
      buyingPower: netLiquidation * 4, // 4倍レバレッジ（デイトレード）
      availableFunds: this.virtualAccount.balance,
      excessLiquidity: this.virtualAccount.balance,
      currency: 'USD',
    };

    this.emit('accountSummary', {
      reqId: 1,
      account: this.accountId,
      tag: 'NetLiquidation',
      value: summary.netLiquidation.toString(),
      currency: 'USD',
    });

    this.emit('accountSummary', {
      reqId: 1,
      account: this.accountId,
      tag: 'TotalCashValue',
      value: summary.totalCashValue.toString(),
      currency: 'USD',
    });

    this.emit('accountSummaryEnd', { reqId: 1 });
  }

  /**
   * 市場データの取得
   */
  async reqMktData(
    tickerId: number,
    contract: MockIBContract,
    genericTickList: string = '',
    snapshot: boolean = false
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('モックIBApiに接続されていません');
    }

    const price = this.marketPrices.get(contract.symbol) || 100;
    const bid = price - 0.05;
    const ask = price + 0.05;
    const high = price * 1.02;
    const low = price * 0.98;

    // Tick price events
    this.emit('tickPrice', { tickerId, tickType: 1, price: bid }); // Bid
    this.emit('tickPrice', { tickerId, tickType: 2, price: ask }); // Ask
    this.emit('tickPrice', { tickerId, tickType: 4, price }); // Last
    this.emit('tickPrice', { tickerId, tickType: 6, price: high }); // High
    this.emit('tickPrice', { tickerId, tickType: 7, price: low }); // Low
    this.emit('tickPrice', { tickerId, tickType: 9, price }); // Close

    // Tick size events
    const volume = Math.floor(Math.random() * 1000000);
    this.emit('tickSize', { tickerId, tickType: 0, size: bid * 100 }); // Bid size
    this.emit('tickSize', { tickerId, tickType: 3, size: ask * 100 }); // Ask size
    this.emit('tickSize', { tickerId, tickType: 8, size: volume }); // Volume
  }

  /**
   * 履歴データの取得
   */
  async reqHistoricalData(
    tickerId: number,
    contract: MockIBContract,
    endDateTime: string,
    durationStr: string,
    barSizeSetting: string,
    whatToShow: string,
    useRTH: number
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('モックIBApiに接続されていません');
    }

    const basePrice = this.marketPrices.get(contract.symbol) || 100;
    const bars = [];

    // 過去10本のバーデータを生成
    for (let i = 9; i >= 0; i--) {
      const time = new Date(Date.now() - i * 60000); // 1分ごと
      const variation = (Math.random() - 0.5) * basePrice * 0.02;
      const open = basePrice + variation;
      const close = basePrice + (Math.random() - 0.5) * basePrice * 0.02;
      const high = Math.max(open, close) + Math.random() * basePrice * 0.01;
      const low = Math.min(open, close) - Math.random() * basePrice * 0.01;
      const volume = Math.floor(Math.random() * 100000);

      this.emit('historicalData', {
        reqId: tickerId,
        time: time.toISOString(),
        open,
        high,
        low,
        close,
        volume,
        count: volume / 100,
        WAP: (open + high + low + close) / 4,
      });
    }

    this.emit('historicalDataEnd', { reqId: tickerId, start: '', end: '' });
  }

  /**
   * リアルタイムバーの取得
   */
  async reqRealTimeBars(
    tickerId: number,
    contract: MockIBContract,
    barSize: number,
    whatToShow: string,
    useRTH: boolean
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('モックIBApiに接続されていません');
    }

    // 5秒ごとにリアルタイムバーを送信
    const interval = setInterval(() => {
      const price = this.marketPrices.get(contract.symbol) || 100;
      const variation = (Math.random() - 0.5) * price * 0.01;
      const open = price;
      const close = price + variation;
      const high = Math.max(open, close) + Math.random() * price * 0.005;
      const low = Math.min(open, close) - Math.random() * price * 0.005;
      const volume = Math.floor(Math.random() * 10000);

      this.emit('realtimeBar', {
        reqId: tickerId,
        time: Math.floor(Date.now() / 1000),
        open,
        high,
        low,
        close,
        volume,
        wap: (open + high + low + close) / 4,
        count: volume / 100,
      });
    }, 5000);

    // クリーンアップ用
    this.once('disconnect', () => clearInterval(interval));
  }

  /**
   * 次の有効な注文IDを取得
   */
  reqIds(): void {
    this.emit('nextValidId', { orderId: this.nextOrderId });
  }

  /**
   * 仮想口座情報の取得（デバッグ用）
   */
  getVirtualAccount(): {
    balance: number;
    positions: Map<string, MockIBPosition>;
    orders: Map<
      number,
      MockIBOrder & { contract: MockIBContract; status: string }
    >;
    trades: Array<{
      timestamp: Date;
      symbol: string;
      action: string;
      quantity: number;
      price: number;
      pnl: number;
    }>;
  } {
    return this.virtualAccount;
  }

  /**
   * 市場価格の取得（デバッグ用）
   */
  getMarketPrice(symbol: string): number {
    return this.marketPrices.get(symbol) || 0;
  }

  /**
   * 接続状態の確認
   */
  isConnectedToIB(): boolean {
    return this.isConnected;
  }
}
