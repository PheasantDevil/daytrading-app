import { EventEmitter } from 'events';
import { PositionSizer } from '../agents/position-sizer';
import { TechnicalAnalyzer } from '../agents/technical-analyzer';
import { TradingMLService } from '../ml/trading-ml-service';
import { RealTradingService } from '../services/real-trading-service';
import { RiskManager } from '../services/risk-manager';
import { TradingStrategy } from '../strategies/trading-strategy';
import { Logger } from '../utils/logger';

export interface AutoTradingConfig {
  enabled: boolean;
  tradingHours: {
    start: string; // "09:00"
    end: string; // "15:00"
    timezone: string; // "Asia/Tokyo"
  };
  strategies: {
    [strategyName: string]: {
      enabled: boolean;
      weight: number;
      riskLevel: 'low' | 'medium' | 'high';
      maxPositions: number;
      stopLoss: number;
      takeProfit: number;
    };
  };
  riskManagement: {
    maxDailyLoss: number;
    maxPositionSize: number;
    maxPortfolioRisk: number;
    emergencyStop: boolean;
  };
  monitoring: {
    checkInterval: number; // milliseconds
    alertThresholds: {
      loss: number;
      drawdown: number;
      volatility: number;
    };
  };
  broker: {
    name: string;
    apiKey: string;
    accountId: string;
    sandbox: boolean;
  };
}

export interface TradingSignal {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  quantity: number;
  price: number;
  strategy: string;
  confidence: number;
  timestamp: Date;
  reason: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  strategy: string;
  entryTime: Date;
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradingSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'stopped' | 'error';
  positions: Position[];
  totalPnL: number;
  tradesCount: number;
  strategies: string[];
}

export class AutoTradingService extends EventEmitter {
  private logger: Logger;
  private config: AutoTradingConfig;
  private isRunning: boolean = false;
  private isInitialized: boolean = false;
  private currentSession?: TradingSession;
  private strategies: Map<string, TradingStrategy> = new Map();
  private riskManager: RiskManager;
  private technicalAnalyzer: TechnicalAnalyzer;
  private positionSizer: PositionSizer;
  private tradingMLService: TradingMLService;
  private realTradingService: RealTradingService;
  private monitoringInterval?: NodeJS.Timeout;
  private tradingInterval?: NodeJS.Timeout;

  constructor(config: AutoTradingConfig) {
    super();
    this.config = config;
    this.logger = new Logger('AutoTradingService');

    // Initialize services
    this.riskManager = new RiskManager({
      maxPositionSize: config.riskManagement.maxPositionSize,
      maxDailyLoss: config.riskManagement.maxDailyLoss,
      maxPortfolioRisk: config.riskManagement.maxPortfolioRisk,
    });

    this.technicalAnalyzer = new TechnicalAnalyzer({
      indicators: ['SMA', 'EMA', 'RSI', 'MACD', 'BollingerBands'],
    });

    this.positionSizer = new PositionSizer({
      method: 'kelly',
      riskPerTrade: 0.02,
    });

    this.tradingMLService = new TradingMLService({
      modelPath: './models/trading-model.json',
      confidenceThreshold: 0.7,
    });

    this.realTradingService = new RealTradingService({
      broker: config.broker.name,
      apiKey: config.broker.apiKey,
      accountId: config.broker.accountId,
      sandbox: config.broker.sandbox,
    });
  }

  /**
   * 自動売買サービスの初期化
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('自動売買サービスの初期化を開始...');

      // Initialize risk manager
      await this.riskManager.initialize();

      // Initialize trading ML service
      await this.tradingMLService.initialize();

      // Initialize real trading service
      await this.realTradingService.initialize();

      // Setup event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      this.logger.info('自動売買サービスの初期化が完了しました');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('自動売買サービスの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * イベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    // Risk manager events
    this.riskManager.on('riskAlert', (alert) => {
      this.logger.warn('リスクアラート:', alert);
      this.emit('riskAlert', alert);

      if (this.config.riskManagement.emergencyStop) {
        this.logger.error('緊急停止: リスク制限を超過しました');
        this.stopTrading();
      }
    });

    // Trading ML service events
    this.tradingMLService.on('prediction', (prediction) => {
      this.logger.info('ML予測を受信:', prediction);
      this.emit('mlPrediction', prediction);
    });

    // Real trading service events
    this.realTradingService.on('orderExecuted', (order) => {
      this.logger.info('注文が執行されました:', order);
      this.emit('orderExecuted', order);
    });

    this.realTradingService.on('orderFailed', (error) => {
      this.logger.error('注文の執行に失敗しました:', error);
      this.emit('orderFailed', error);
    });
  }

  /**
   * 自動売買の開始
   */
  async startTrading(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('自動売買サービスが初期化されていません');
    }

    if (this.isRunning) {
      this.logger.warn('自動売買は既に実行中です');
      return;
    }

    try {
      this.logger.info('自動売買を開始...');

      // Create new trading session
      this.currentSession = {
        sessionId: `session_${Date.now()}`,
        startTime: new Date(),
        status: 'active',
        positions: [],
        totalPnL: 0,
        tradesCount: 0,
        strategies: Object.keys(this.config.strategies).filter(
          (name) => this.config.strategies[name].enabled
        ),
      };

      // Start monitoring
      this.startMonitoring();

      // Start trading loop
      this.startTradingLoop();

      this.isRunning = true;
      this.logger.info('自動売買が開始されました');
      this.emit('tradingStarted', this.currentSession);
    } catch (error) {
      this.logger.error('自動売買の開始に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 監視の開始
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoring();
      } catch (error) {
        this.logger.error('監視処理でエラーが発生しました:', error);
      }
    }, this.config.monitoring.checkInterval);
  }

  /**
   * 取引ループの開始
   */
  private startTradingLoop(): void {
    this.tradingInterval = setInterval(async () => {
      try {
        if (this.isTradingHours()) {
          await this.executeTradingCycle();
        }
      } catch (error) {
        this.logger.error('取引サイクルでエラーが発生しました:', error);
      }
    }, 5000); // 5秒間隔
  }

  /**
   * 取引時間の確認
   */
  private isTradingHours(): boolean {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('ja-JP', {
      timeZone: this.config.tradingHours.timezone,
      hour12: false,
    });

    return (
      currentTime >= this.config.tradingHours.start &&
      currentTime <= this.config.tradingHours.end
    );
  }

  /**
   * 取引サイクルの実行
   */
  private async executeTradingCycle(): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Get market data
      const marketData = await this.getMarketData();

      // Generate trading signals
      const signals = await this.generateTradingSignals(marketData);

      // Process signals
      for (const signal of signals) {
        await this.processTradingSignal(signal);
      }

      // Update positions
      await this.updatePositions();

      // Check stop loss and take profit
      await this.checkStopLossAndTakeProfit();
    } catch (error) {
      this.logger.error('取引サイクルの実行に失敗しました:', error);
    }
  }

  /**
   * 市場データの取得
   */
  private async getMarketData(): Promise<any[]> {
    // This would typically fetch real market data
    // For now, return mock data
    return [
      { symbol: 'AAPL', price: 150.25, volume: 1000000, timestamp: new Date() },
      { symbol: 'GOOGL', price: 2800.5, volume: 500000, timestamp: new Date() },
      { symbol: 'MSFT', price: 300.75, volume: 750000, timestamp: new Date() },
    ];
  }

  /**
   * 取引シグナルの生成
   */
  private async generateTradingSignals(
    marketData: any[]
  ): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];

    for (const data of marketData) {
      // Technical analysis
      const technicalSignals = await this.technicalAnalyzer.analyze(data);

      // ML prediction
      const mlPrediction = await this.tradingMLService.predict(data);

      // Combine signals
      const combinedSignal = this.combineSignals(
        technicalSignals,
        mlPrediction,
        data
      );

      if (combinedSignal.action !== 'hold') {
        signals.push(combinedSignal);
      }
    }

    return signals;
  }

  /**
   * シグナルの統合
   */
  private combineSignals(
    technical: any,
    ml: any,
    marketData: any
  ): TradingSignal {
    // Simple combination logic - in reality this would be more sophisticated
    const confidence = (technical.confidence + ml.confidence) / 2;

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    if (technical.action === 'buy' && ml.action === 'buy' && confidence > 0.7) {
      action = 'buy';
    } else if (
      technical.action === 'sell' &&
      ml.action === 'sell' &&
      confidence > 0.7
    ) {
      action = 'sell';
    }

    return {
      symbol: marketData.symbol,
      action,
      quantity: this.positionSizer.calculatePositionSize(
        marketData.price,
        confidence
      ),
      price: marketData.price,
      strategy: 'combined',
      confidence,
      timestamp: new Date(),
      reason: `Technical: ${technical.reason}, ML: ${ml.reason}`,
    };
  }

  /**
   * 取引シグナルの処理
   */
  private async processTradingSignal(signal: TradingSignal): Promise<void> {
    try {
      // Risk check
      const riskCheck = await this.riskManager.validateTrade({
        symbol: signal.symbol,
        quantity: signal.quantity,
        price: signal.price,
        action: signal.action,
      });

      if (!riskCheck.approved) {
        this.logger.warn(
          `取引がリスクチェックで拒否されました: ${riskCheck.reason}`
        );
        return;
      }

      // Execute trade
      const order = await this.realTradingService.placeOrder({
        symbol: signal.symbol,
        side: signal.action,
        quantity: signal.quantity,
        price: signal.price,
        type: 'market',
      });

      this.logger.info(
        `取引を執行しました: ${signal.symbol} ${signal.action} ${signal.quantity} @ ${signal.price}`
      );

      // Update session
      if (this.currentSession) {
        this.currentSession.tradesCount++;
      }

      this.emit('tradeExecuted', { signal, order });
    } catch (error) {
      this.logger.error('取引シグナルの処理に失敗しました:', error);
      this.emit('tradeFailed', { signal, error });
    }
  }

  /**
   * ポジションの更新
   */
  private async updatePositions(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const currentPositions = await this.realTradingService.getPositions();

      this.currentSession.positions = currentPositions.map((pos) => ({
        symbol: pos.symbol,
        quantity: pos.quantity,
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice,
        unrealizedPnL: pos.unrealizedPnL,
        strategy: pos.strategy || 'unknown',
        entryTime: pos.entryTime,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
      }));

      // Calculate total PnL
      this.currentSession.totalPnL = this.currentSession.positions.reduce(
        (sum, pos) => sum + pos.unrealizedPnL,
        0
      );
    } catch (error) {
      this.logger.error('ポジションの更新に失敗しました:', error);
    }
  }

  /**
   * ストップロスとテイクプロフィットの確認
   */
  private async checkStopLossAndTakeProfit(): Promise<void> {
    if (!this.currentSession) return;

    for (const position of this.currentSession.positions) {
      try {
        // Check stop loss
        if (position.stopLoss && position.currentPrice <= position.stopLoss) {
          await this.closePosition(position, 'stop_loss');
        }

        // Check take profit
        if (
          position.takeProfit &&
          position.currentPrice >= position.takeProfit
        ) {
          await this.closePosition(position, 'take_profit');
        }
      } catch (error) {
        this.logger.error(
          `ポジション ${position.symbol} の確認でエラー:`,
          error
        );
      }
    }
  }

  /**
   * ポジションのクローズ
   */
  private async closePosition(
    position: Position,
    reason: string
  ): Promise<void> {
    try {
      const order = await this.realTradingService.placeOrder({
        symbol: position.symbol,
        side: position.quantity > 0 ? 'sell' : 'buy',
        quantity: Math.abs(position.quantity),
        price: position.currentPrice,
        type: 'market',
      });

      this.logger.info(
        `ポジションをクローズしました: ${position.symbol} (理由: ${reason})`
      );
      this.emit('positionClosed', { position, reason, order });
    } catch (error) {
      this.logger.error(
        `ポジション ${position.symbol} のクローズに失敗:`,
        error
      );
    }
  }

  /**
   * 監視の実行
   */
  private async performMonitoring(): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Check daily loss limit
      if (
        this.currentSession.totalPnL < -this.config.riskManagement.maxDailyLoss
      ) {
        this.logger.error('日次損失制限に達しました。取引を停止します。');
        await this.stopTrading();
        return;
      }

      // Check drawdown
      const drawdown = this.calculateDrawdown();
      if (drawdown > this.config.monitoring.alertThresholds.drawdown) {
        this.logger.warn(`ドローダウンが閾値を超過: ${drawdown}%`);
        this.emit('drawdownAlert', { drawdown });
      }

      // Check volatility
      const volatility = this.calculateVolatility();
      if (volatility > this.config.monitoring.alertThresholds.volatility) {
        this.logger.warn(`ボラティリティが閾値を超過: ${volatility}%`);
        this.emit('volatilityAlert', { volatility });
      }
    } catch (error) {
      this.logger.error('監視処理でエラーが発生しました:', error);
    }
  }

  /**
   * ドローダウンの計算
   */
  private calculateDrawdown(): number {
    // Simplified calculation
    return (Math.abs(this.currentSession?.totalPnL || 0) / 10000) * 100;
  }

  /**
   * ボラティリティの計算
   */
  private calculateVolatility(): number {
    // Simplified calculation
    return Math.random() * 10; // Mock volatility
  }

  /**
   * 自動売買の停止
   */
  async stopTrading(): Promise<void> {
    try {
      this.logger.info('自動売買を停止...');

      // Stop intervals
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      if (this.tradingInterval) {
        clearInterval(this.tradingInterval);
        this.tradingInterval = undefined;
      }

      // Update session
      if (this.currentSession) {
        this.currentSession.status = 'stopped';
        this.currentSession.endTime = new Date();
      }

      this.isRunning = false;
      this.logger.info('自動売買が停止されました');
      this.emit('tradingStopped', this.currentSession);
    } catch (error) {
      this.logger.error('自動売買の停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 取引の一時停止
   */
  async pauseTrading(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.status = 'paused';
      this.logger.info('取引を一時停止しました');
      this.emit('tradingPaused', this.currentSession);
    }
  }

  /**
   * 取引の再開
   */
  async resumeTrading(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.status = 'active';
      this.logger.info('取引を再開しました');
      this.emit('tradingResumed', this.currentSession);
    }
  }

  /**
   * 現在のセッション情報の取得
   */
  getCurrentSession(): TradingSession | undefined {
    return this.currentSession;
  }

  /**
   * 取引統計の取得
   */
  getTradingStats(): {
    totalTrades: number;
    totalPnL: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    maxDrawdown: number;
  } {
    // Simplified stats calculation
    return {
      totalTrades: this.currentSession?.tradesCount || 0,
      totalPnL: this.currentSession?.totalPnL || 0,
      winRate: 0.65, // Mock data
      averageWin: 150.25, // Mock data
      averageLoss: -75.5, // Mock data
      maxDrawdown: this.calculateDrawdown(),
    };
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: Partial<AutoTradingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('設定を更新しました');
    this.emit('configUpdated', this.config);
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    status: string;
    session: TradingSession | undefined;
    timestamp: string;
  }> {
    try {
      const healthy = (this.isInitialized && !this.isRunning) || this.isRunning;
      const status = this.isRunning ? 'running' : 'stopped';

      return {
        healthy,
        status,
        session: this.currentSession,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        session: undefined,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
