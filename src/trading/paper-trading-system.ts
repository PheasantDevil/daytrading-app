import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { MockIBApi, MockIBContract, MockIBOrder } from '../brokers/mock-ib-api';

export interface PaperTradingConfig {
  initialBalance: number;
  currency: string;
  leverage: number;
  commissionRate: number;
  minCommission: number;
  enableRealTimeSimulation: boolean;
}

export interface VirtualPosition {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  marketValue: number;
}

export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export class PaperTradingSystem extends EventEmitter {
  private logger: Logger;
  private config: PaperTradingConfig;
  private mockApi: MockIBApi;
  private isRunning: boolean = false;
  private currentBalance: number;
  private initialBalance: number;
  private positions: Map<string, VirtualPosition> = new Map();
  private tradeHistory: Array<{
    timestamp: Date;
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    commission: number;
    pnl: number;
  }> = [];
  private nextOrderId: number = 1;

  constructor(config: PaperTradingConfig) {
    super();
    this.config = config;
    this.logger = new Logger('PaperTradingSystem');
    this.currentBalance = config.initialBalance;
    this.initialBalance = config.initialBalance;

    // モックIB APIの初期化
    this.mockApi = new MockIBApi({
      host: '127.0.0.1',
      port: 7497,
      clientId: 1,
      accountId: 'PAPER123456',
    });
  }

  /**
   * ペーパートレーディングシステムの初期化
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('ペーパートレーディングシステムを初期化中...');
      this.logger.info(`初期資金: $${this.config.initialBalance.toLocaleString()}`);

      // モックAPIに接続
      await this.mockApi.connect();

      // イベントハンドラーの設定
      this.setupEventHandlers();

      this.logger.info('✅ ペーパートレーディングシステムの初期化が完了しました');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('ペーパートレーディングシステムの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * イベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    this.mockApi.on('connected', () => {
      this.logger.info('モックAPIに接続されました');
    });

    this.mockApi.on('orderStatus', (data) => {
      this.logger.info(`注文ステータス: ${data.status}`, data);
      this.emit('orderStatus', data);
    });

    this.mockApi.on('execDetails', (data) => {
      this.logger.info('約定詳細:', data);
      this.emit('execution', data);
    });

    this.mockApi.on('error', (error) => {
      this.logger.error('モックAPIエラー:', error);
      this.emit('error', error);
    });
  }

  /**
   * ペーパートレーディングの開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('ペーパートレーディングは既に実行中です');
      return;
    }

    try {
      this.logger.info('ペーパートレーディングを開始します...');
      this.isRunning = true;
      this.logger.info('✅ ペーパートレーディングが開始されました');
      this.emit('started');
    } catch (error) {
      this.logger.error('ペーパートレーディングの開始に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 注文の発注
   */
  async placeOrder(
    symbol: string,
    action: 'BUY' | 'SELL',
    quantity: number,
    orderType: 'MKT' | 'LMT' = 'MKT',
    limitPrice?: number
  ): Promise<number> {
    if (!this.isRunning) {
      throw new Error('ペーパートレーディングが開始されていません');
    }

    const orderId = this.nextOrderId++;

    const contract: MockIBContract = {
      symbol,
      secType: 'STK',
      exchange: 'SMART',
      currency: 'USD',
    };

    const order: MockIBOrder = {
      orderId,
      action,
      totalQuantity: quantity,
      orderType,
      lmtPrice: limitPrice,
      tif: 'DAY',
    };

    this.logger.info(
      `注文発注: ${symbol} ${action} ${quantity}株 @ ${orderType}${limitPrice ? ` $${limitPrice}` : ''}`
    );

    await this.mockApi.placeOrder(orderId, contract, order);

    return orderId;
  }

  /**
   * 注文のキャンセル
   */
  async cancelOrder(orderId: number): Promise<void> {
    await this.mockApi.cancelOrder(orderId);
    this.logger.info(`注文をキャンセルしました: ${orderId}`);
  }

  /**
   * ポジション情報の取得
   */
  async getPositions(): Promise<VirtualPosition[]> {
    const virtualAccount = this.mockApi.getVirtualAccount();
    const positions: VirtualPosition[] = [];

    for (const [symbol, position] of virtualAccount.positions.entries()) {
      positions.push({
        symbol,
        quantity: position.position,
        averageCost: position.averageCost,
        currentPrice: position.marketPrice,
        unrealizedPnL: position.unrealizedPnL,
        realizedPnL: position.realizedPnL,
        marketValue: position.marketValue,
      });
    }

    return positions;
  }

  /**
   * 口座情報の取得
   */
  async getAccountInfo(): Promise<{
    balance: number;
    netLiquidation: number;
    totalPnL: number;
    unrealizedPnL: number;
    realizedPnL: number;
    buyingPower: number;
    marginUsed: number;
  }> {
    const virtualAccount = this.mockApi.getVirtualAccount();
    const positions = Array.from(virtualAccount.positions.values());
    
    const unrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    const realizedPnL = positions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
    const grossPositionValue = positions.reduce((sum, pos) => sum + Math.abs(pos.marketValue), 0);
    const netLiquidation = virtualAccount.balance + grossPositionValue + unrealizedPnL;
    const totalPnL = netLiquidation - this.initialBalance;

    return {
      balance: virtualAccount.balance,
      netLiquidation,
      totalPnL,
      unrealizedPnL,
      realizedPnL,
      buyingPower: netLiquidation * this.config.leverage,
      marginUsed: grossPositionValue,
    };
  }

  /**
   * 市場データの取得
   */
  async getMarketData(symbol: string): Promise<{
    symbol: string;
    price: number;
    bid: number;
    ask: number;
    high: number;
    low: number;
    volume: number;
  }> {
    const price = this.mockApi.getMarketPrice(symbol);
    const bid = price - 0.05;
    const ask = price + 0.05;
    const high = price * 1.02;
    const low = price * 0.98;
    const volume = Math.floor(Math.random() * 1000000);

    return {
      symbol,
      price,
      bid,
      ask,
      high,
      low,
      volume,
    };
  }

  /**
   * 取引統計の取得
   */
  getTradingStats(): TradingStats {
    const virtualAccount = this.mockApi.getVirtualAccount();
    const trades = virtualAccount.trades;
    
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl < 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    
    const averageWin = wins.length > 0 
      ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length 
      : 0;
    const averageLoss = losses.length > 0 
      ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length 
      : 0;

    // 最大ドローダウンの計算
    let peak = this.initialBalance;
    let maxDrawdown = 0;
    let currentBalance = this.initialBalance;

    for (const trade of trades) {
      currentBalance += trade.pnl;
      if (currentBalance > peak) {
        peak = currentBalance;
      }
      const drawdown = (peak - currentBalance) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // シャープレシオの簡易計算
    const returns = trades.map(t => t.pnl / this.initialBalance);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    return {
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      totalPnL,
      winRate: trades.length > 0 ? winningTrades / trades.length : 0,
      averageWin,
      averageLoss,
      maxDrawdown,
      sharpeRatio,
    };
  }

  /**
   * 取引履歴の取得
   */
  getTradeHistory(): Array<{
    timestamp: Date;
    symbol: string;
    action: string;
    quantity: number;
    price: number;
    pnl: number;
  }> {
    const virtualAccount = this.mockApi.getVirtualAccount();
    return [...virtualAccount.trades];
  }

  /**
   * ペーパートレーディングの停止
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('ペーパートレーディングを停止します...');
      
      await this.mockApi.disconnect();
      this.isRunning = false;
      
      this.logger.info('✅ ペーパートレーディングが停止されました');
      this.logger.info('📊 最終結果:');
      
      const accountInfo = await this.getAccountInfo();
      const stats = this.getTradingStats();
      
      this.logger.info(`純資産: $${accountInfo.netLiquidation.toFixed(2)}`);
      this.logger.info(`総損益: $${accountInfo.totalPnL.toFixed(2)}`);
      this.logger.info(`勝率: ${(stats.winRate * 100).toFixed(2)}%`);
      this.logger.info(`総取引数: ${stats.totalTrades}`);
      
      this.emit('stopped', { accountInfo, stats });
    } catch (error) {
      this.logger.error('ペーパートレーディングの停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 状態の取得
   */
  getStatus(): {
    running: boolean;
    balance: number;
    positions: number;
    trades: number;
  } {
    const virtualAccount = this.mockApi.getVirtualAccount();
    
    return {
      running: this.isRunning,
      balance: virtualAccount.balance,
      positions: virtualAccount.positions.size,
      trades: virtualAccount.trades.length,
    };
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    status: string;
    connected: boolean;
    balance: number;
    timestamp: string;
  }> {
    const connected = this.mockApi.isConnectedToIB();
    const virtualAccount = this.mockApi.getVirtualAccount();
    
    return {
      healthy: connected && this.isRunning,
      status: this.isRunning ? 'running' : 'stopped',
      connected,
      balance: virtualAccount.balance,
      timestamp: new Date().toISOString(),
    };
  }
}
