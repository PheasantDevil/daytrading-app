/**
 * 取引戦略基盤クラス
 * 全ての取引戦略の基底クラス
 */

import { RealTradingService } from '../services/real-trading-service';
import { DataIntegrationService } from '../services/data-integration-service';
import { TechnicalAnalyzer } from '../agents/technical-analyzer';
import { RiskManager } from '../services/risk-manager';

export interface StrategyConfig {
  name: string;
  description: string;
  symbols: string[];
  markets: ('FX' | 'US' | 'JP')[];
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  lookbackPeriod: number;
  riskManagement: {
    maxPositionSize: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
  };
  technicalIndicators: {
    sma: { periods: number[] };
    ema: { periods: number[] };
    rsi: { period: number; oversold: number; overbought: number };
    macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
    bollinger: { period: number; stdDev: number };
  };
  enabled: boolean;
}

export interface Signal {
  id: string;
  symbol: string;
  market: 'FX' | 'US' | 'JP';
  side: 'BUY' | 'SELL';
  strength: number; // 0-1の範囲
  confidence: number; // 0-1の範囲
  price: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
  indicators: Record<string, number>;
  createdAt: Date;
  strategy: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  signal: Signal;
}

export interface RebalanceResult {
  success: boolean;
  orders: OrderResult[];
  totalOrders: number;
  successfulOrders: number;
  error?: string;
}

export interface StrategyPerformance {
  strategy: string;
  period: {
    start: Date;
    end: Date;
  };
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
}

export abstract class TradingStrategy {
  protected config: StrategyConfig;
  protected tradingService: RealTradingService;
  protected dataService: DataIntegrationService;
  protected technicalAnalyzer: TechnicalAnalyzer;
  protected riskManager: RiskManager;
  protected isRunning: boolean = false;
  protected signals: Map<string, Signal> = new Map();
  protected performance: StrategyPerformance | null = null;

  constructor(
    config: StrategyConfig,
    tradingService: RealTradingService,
    dataService: DataIntegrationService
  ) {
    this.config = config;
    this.tradingService = tradingService;
    this.dataService = dataService;
    this.technicalAnalyzer = new TechnicalAnalyzer();
    this.riskManager = new RiskManager(config.riskManagement);
  }

  /**
   * 戦略を初期化
   */
  async initialize(): Promise<boolean> {
    try {
      console.log(`🔄 ${this.config.name} 戦略初期化中...`);

      // データサービスの初期化
      const dataInitialized = await this.dataService.initialize();
      if (!dataInitialized) {
        console.log(`❌ ${this.config.name} データサービス初期化失敗`);
        return false;
      }

      // リスク管理の初期化
      await this.riskManager.initialize();

      console.log(`✅ ${this.config.name} 戦略初期化完了`);
      return true;
    } catch (error) {
      console.error(`❌ ${this.config.name} 戦略初期化エラー:`, error);
      return false;
    }
  }

  /**
   * 戦略を開始
   */
  async start(): Promise<boolean> {
    try {
      if (this.isRunning) {
        console.log(`⚠️ ${this.config.name} は既に実行中です`);
        return true;
      }

      const initialized = await this.initialize();
      if (!initialized) {
        return false;
      }

      this.isRunning = true;
      console.log(`✅ ${this.config.name} 戦略開始`);
      return true;
    } catch (error) {
      console.error(`❌ ${this.config.name} 戦略開始エラー:`, error);
      return false;
    }
  }

  /**
   * 戦略を停止
   */
  stop(): void {
    this.isRunning = false;
    console.log(`⏹️ ${this.config.name} 戦略停止`);
  }

  /**
   * シグナルを生成（抽象メソッド）
   */
  abstract generateSignals(): Promise<Signal[]>;

  /**
   * 注文を執行（抽象メソッド）
   */
  abstract executeOrders(signals: Signal[]): Promise<OrderResult[]>;

  /**
   * リバランスを実行（抽象メソッド）
   */
  abstract rebalance(): Promise<RebalanceResult>;

  /**
   * 戦略のパフォーマンスを計算
   */
  async calculatePerformance(): Promise<StrategyPerformance> {
    try {
      const orders = await this.tradingService.getOrders();
      const positions = await this.tradingService.getPositions();

      // 基本的なパフォーマンス計算
      const totalTrades = orders.length;
      const winningTrades = orders.filter(order => order.status === 'FILLED' && order.totalCost > 0).length;
      const losingTrades = totalTrades - winningTrades;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

      const totalReturn = positions.reduce((sum, pos) => sum + pos.totalPnL, 0);
      const totalReturnPercent = totalReturn > 0 ? (totalReturn / 1000000) * 100 : 0; // 仮の初期資本

      const performance: StrategyPerformance = {
        strategy: this.config.name,
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30日前
          end: new Date(),
        },
        totalReturn,
        totalReturnPercent,
        sharpeRatio: 0, // 計算が複雑なため簡略化
        maxDrawdown: 0, // 計算が複雑なため簡略化
        winRate,
        totalTrades,
        winningTrades,
        losingTrades,
        averageWin: 0, // 計算が複雑なため簡略化
        averageLoss: 0, // 計算が複雑なため簡略化
        profitFactor: 0, // 計算が複雑なため簡略化
      };

      this.performance = performance;
      return performance;
    } catch (error) {
      console.error(`❌ ${this.config.name} パフォーマンス計算エラー:`, error);
      throw error;
    }
  }

  /**
   * 戦略のパフォーマンスを取得
   */
  getPerformance(): StrategyPerformance | null {
    return this.performance;
  }

  /**
   * 生成されたシグナルを取得
   */
  getSignals(): Signal[] {
    return Array.from(this.signals.values());
  }

  /**
   * 特定のシグナルを取得
   */
  getSignal(signalId: string): Signal | null {
    return this.signals.get(signalId) || null;
  }

  /**
   * シグナルを保存
   */
  protected saveSignal(signal: Signal): void {
    this.signals.set(signal.id, signal);
  }

  /**
   * シグナルを生成（共通処理）
   */
  protected async generateSignal(
    symbol: string,
    market: 'FX' | 'US' | 'JP',
    side: 'BUY' | 'SELL',
    strength: number,
    confidence: number,
    reason: string,
    indicators: Record<string, number>
  ): Promise<Signal> {
    const signalId = `${this.config.name}_${symbol}_${Date.now()}`;
    const currentPrice = await this.tradingService.getCurrentPrice(symbol, market);
    
    if (!currentPrice) {
      throw new Error(`現在価格を取得できません: ${symbol}`);
    }

    // 数量計算（簡略化）
    const quantity = this.calculateQuantity(symbol, market, currentPrice, strength);

    // ストップロス・テイクプロフィット計算
    const stopLoss = side === 'BUY' 
      ? currentPrice * (1 - this.config.riskManagement.stopLossPercent / 100)
      : currentPrice * (1 + this.config.riskManagement.stopLossPercent / 100);
    
    const takeProfit = side === 'BUY'
      ? currentPrice * (1 + this.config.riskManagement.takeProfitPercent / 100)
      : currentPrice * (1 - this.config.riskManagement.takeProfitPercent / 100);

    const signal: Signal = {
      id: signalId,
      symbol,
      market,
      side,
      strength,
      confidence,
      price: currentPrice,
      quantity,
      stopLoss,
      takeProfit,
      reason,
      indicators,
      createdAt: new Date(),
      strategy: this.config.name,
    };

    return signal;
  }

  /**
   * 数量を計算
   */
  private calculateQuantity(
    symbol: string,
    market: 'FX' | 'US' | 'JP',
    price: number,
    strength: number
  ): number {
    // 簡略化された数量計算
    const baseQuantity = this.config.riskManagement.maxPositionSize / price;
    return Math.floor(baseQuantity * strength);
  }

  /**
   * 戦略の設定を取得
   */
  getConfig(): StrategyConfig {
    return this.config;
  }

  /**
   * 戦略の設定を更新
   */
  updateConfig(newConfig: Partial<StrategyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(`✅ ${this.config.name} 設定更新`);
  }

  /**
   * 戦略の状態を取得
   */
  getStatus(): { running: boolean; signalsCount: number; performance: StrategyPerformance | null } {
    return {
      running: this.isRunning,
      signalsCount: this.signals.size,
      performance: this.performance,
    };
  }
}
