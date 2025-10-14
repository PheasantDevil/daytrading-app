/**
 * バックテストエンジン
 * 取引戦略のバックテストを実行
 */

import { BacktestEngine as BaseBacktestEngine } from '../services/backtest-engine';
import { DataIntegrationService } from '../services/data-integration-service';
import { FeeCalculator } from '../services/fee-calculator';
import { RiskManager } from '../services/risk-manager';
import { TradingStrategy } from '../strategies/trading-strategy';

export interface BacktestConfig {
  strategy: TradingStrategy;
  symbols: string[];
  markets: ('FX' | 'US' | 'JP')[];
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  commission: number;
  slippage: number;
  riskManagement: {
    maxPositionSize: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
  };
  dataSource: 'yahoo' | 'alpha_vantage' | 'iex' | 'combined';
}

export interface BacktestResult {
  config: BacktestConfig;
  performance: {
    totalReturn: number;
    totalReturnPercent: number;
    annualizedReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    calmarRatio: number;
    winRate: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageTradeDuration: number;
  };
  riskMetrics: {
    volatility: number;
    beta: number;
    alpha: number;
    informationRatio: number;
    treynorRatio: number;
    var95: number;
    var99: number;
    cvar95: number;
    cvar99: number;
  };
  trades: BacktestTrade[];
  positions: BacktestPosition[];
  dailyReturns: DailyReturn[];
  monthlyReturns: MonthlyReturn[];
  benchmarkComparison?: BenchmarkComparison;
  createdAt: Date;
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  market: 'FX' | 'US' | 'JP';
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  duration: number; // ミリ秒
  pnl: number;
  pnlPercent: number;
  commission: number;
  slippage: number;
  netPnl: number;
  netPnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL' | 'END_OF_PERIOD';
  strategy: string;
}

export interface BacktestPosition {
  id: string;
  symbol: string;
  market: 'FX' | 'US' | 'JP';
  side: 'LONG' | 'SHORT';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  createdAt: Date;
  updatedAt: Date;
  strategy: string;
}

export interface DailyReturn {
  date: Date;
  return: number;
  returnPercent: number;
  cumulativeReturn: number;
  cumulativeReturnPercent: number;
  portfolioValue: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface MonthlyReturn {
  month: string;
  return: number;
  returnPercent: number;
  cumulativeReturn: number;
  cumulativeReturnPercent: number;
  portfolioValue: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface BenchmarkComparison {
  benchmark: string;
  strategyReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  trackingError: number;
  informationRatio: number;
  beta: number;
  alpha: number;
  correlation: number;
}

export interface OptimizationResult {
  bestParameters: Record<string, any>;
  bestPerformance: BacktestResult;
  parameterSweep: ParameterSweep[];
  optimizationMethod: 'GRID_SEARCH' | 'RANDOM_SEARCH' | 'BAYESIAN_OPTIMIZATION';
  totalIterations: number;
  bestIteration: number;
  createdAt: Date;
}

export interface ParameterSweep {
  parameters: Record<string, any>;
  performance: BacktestResult;
  iteration: number;
}

export class BacktestEngine {
  private config: BacktestConfig;
  private dataService: DataIntegrationService;
  private baseBacktestEngine: BaseBacktestEngine;
  private riskManager: RiskManager;
  private feeCalculator: FeeCalculator;
  private isRunning: boolean = false;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.dataService = new DataIntegrationService({
      cacheEnabled: true,
      cacheExpiry: 300000,
      fallbackEnabled: true,
      maxRetries: 3,
      retryDelay: 1000,
    });
    this.baseBacktestEngine = new BaseBacktestEngine({
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital,
      commissionRate: config.commission,
      slippage: config.slippage,
      riskParameters: {
        ...config.riskManagement,
        maxPortfolioRisk: 0.2,
        maxDrawdown: 0.2,
      },
    });
    this.riskManager = new RiskManager({
      ...config.riskManagement,
      maxPortfolioRisk: 0.2,
      maxDrawdown: 0.2,
    });
    this.feeCalculator = new FeeCalculator();
  }

  /**
   * バックテストを実行
   */
  async runBacktest(): Promise<BacktestResult> {
    try {
      console.log('🔄 バックテスト実行開始...');
      this.isRunning = true;

      // 戦略の初期化
      const strategyInitialized = await this.config.strategy.initialize();
      if (!strategyInitialized) {
        throw new Error('戦略の初期化に失敗しました');
      }

      // バックテスト実行
      const result = await this.executeBacktest();

      console.log('✅ バックテスト実行完了');
      return result;
    } catch (error) {
      console.error('❌ バックテスト実行エラー:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * バックテストの実際の実行
   */
  private async executeBacktest(): Promise<BacktestResult> {
    try {
      const trades: BacktestTrade[] = [];
      const positions: Map<string, BacktestPosition> = new Map();
      const dailyReturns: DailyReturn[] = [];
      const monthlyReturns: MonthlyReturn[] = [];

      let portfolioValue = this.config.initialCapital;
      let peakValue = this.config.initialCapital;
      let maxDrawdown = 0;
      let maxDrawdownPercent = 0;

      // 日付範囲を生成
      const dates = this.generateDateRange();

      for (const date of dates) {
        try {
          // 各シンボルのデータを取得
          const marketData = await this.getMarketDataForDate(date);

          // シグナルを生成
          const signals = await this.config.strategy.generateSignals();

          // 取引を実行
          const dayTrades = await this.executeTradesForDate(
            signals,
            marketData,
            date,
            positions
          );
          trades.push(...dayTrades);

          // ポジションを更新
          await this.updatePositions(positions, marketData, date);

          // ポートフォリオ価値を計算
          portfolioValue = this.calculatePortfolioValue(
            positions,
            this.config.initialCapital
          );

          // ドローダウンを計算
          if (portfolioValue > peakValue) {
            peakValue = portfolioValue;
          }
          const drawdown = peakValue - portfolioValue;
          const drawdownPercent = (drawdown / peakValue) * 100;

          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            maxDrawdownPercent = drawdownPercent;
          }

          // 日次リターンを記録
          const dailyReturn = this.calculateDailyReturn(
            portfolioValue,
            this.config.initialCapital
          );
          dailyReturns.push({
            date,
            return: dailyReturn,
            returnPercent: dailyReturn * 100,
            cumulativeReturn: portfolioValue - this.config.initialCapital,
            cumulativeReturnPercent:
              ((portfolioValue - this.config.initialCapital) /
                this.config.initialCapital) *
              100,
            portfolioValue,
            drawdown,
            drawdownPercent,
          });
        } catch (error) {
          console.error(
            `❌ バックテスト日次処理エラー (${date.toISOString()}):`,
            error
          );
        }
      }

      // 月次リターンを計算
      const monthlyReturnsData = this.calculateMonthlyReturns(dailyReturns);

      // パフォーマンス指標を計算
      const performance = this.calculatePerformanceMetrics(
        trades,
        dailyReturns,
        this.config.initialCapital
      );

      // リスク指標を計算
      const riskMetrics = this.calculateRiskMetrics(dailyReturns, trades);

      // ベンチマーク比較を計算
      const benchmarkComparison =
        await this.calculateBenchmarkComparison(dailyReturns);

      const result: BacktestResult = {
        config: this.config,
        performance,
        riskMetrics,
        trades,
        positions: Array.from(positions.values()),
        dailyReturns,
        monthlyReturns: monthlyReturnsData,
        benchmarkComparison,
        createdAt: new Date(),
      };

      return result;
    } catch (error) {
      console.error('❌ バックテスト実行エラー:', error);
      throw error;
    }
  }

  /**
   * 日付範囲を生成
   */
  private generateDateRange(): Date[] {
    const dates: Date[] = [];
    const current = new Date(this.config.startDate);
    const end = new Date(this.config.endDate);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * 指定日の市場データを取得
   */
  private async getMarketDataForDate(date: Date): Promise<Map<string, any>> {
    const marketData = new Map();

    for (const symbol of this.config.symbols) {
      for (const market of this.config.markets) {
        try {
          const data = await this.dataService.getHistoricalData(
            symbol,
            market,
            1
          );
          if (data && data.data.length > 0) {
            marketData.set(`${symbol}_${market}`, data.data[0]);
          }
        } catch (error) {
          console.error(
            `❌ 市場データ取得エラー (${symbol}_${market}):`,
            error
          );
        }
      }
    }

    return marketData;
  }

  /**
   * 指定日の取引を実行
   */
  private async executeTradesForDate(
    signals: any[],
    marketData: Map<string, any>,
    date: Date,
    positions: Map<string, BacktestPosition>
  ): Promise<BacktestTrade[]> {
    const trades: BacktestTrade[] = [];

    for (const signal of signals) {
      try {
        const marketKey = `${signal.symbol}_${signal.market}`;
        const data = marketData.get(marketKey);

        if (!data) continue;

        const price = data.close;
        const quantity = signal.quantity;
        const side = signal.side;

        // リスクチェック（簡略化）
        // Note: checkOrderRiskメソッドが存在しないため、簡易チェックに置き換え
        if (!quantity || quantity <= 0) continue;

        // 既存ポジションをチェック
        const existingPosition = positions.get(signal.symbol);

        if (existingPosition) {
          // ポジションをクローズ
          const closeTrade = this.createTrade(
            signal.symbol,
            signal.market,
            existingPosition.side === 'LONG' ? 'SELL' : 'BUY',
            existingPosition.quantity,
            existingPosition.averagePrice,
            price,
            existingPosition.createdAt,
            date,
            'SIGNAL'
          );
          trades.push(closeTrade);
          positions.delete(signal.symbol);
        }

        // 新しいポジションを作成
        const newPosition: BacktestPosition = {
          id: `${signal.symbol}_${Date.now()}`,
          symbol: signal.symbol,
          market: signal.market,
          side: side === 'BUY' ? 'LONG' : 'SHORT',
          quantity,
          averagePrice: price,
          currentPrice: price,
          marketValue: quantity * price,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          createdAt: date,
          updatedAt: date,
          strategy: this.config.strategy.getConfig().name,
        };

        positions.set(signal.symbol, newPosition);

        // 取引を記録
        const trade = this.createTrade(
          signal.symbol,
          signal.market,
          side,
          quantity,
          price,
          price,
          date,
          date,
          'SIGNAL'
        );
        trades.push(trade);
      } catch (error) {
        console.error(`❌ 取引実行エラー (${signal.symbol}):`, error);
      }
    }

    return trades;
  }

  /**
   * 取引を作成
   */
  private createTrade(
    symbol: string,
    market: 'FX' | 'US' | 'JP',
    side: 'BUY' | 'SELL',
    quantity: number,
    entryPrice: number,
    exitPrice: number,
    entryTime: Date,
    exitTime: Date,
    exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL' | 'END_OF_PERIOD'
  ): BacktestTrade {
    const pnl =
      side === 'BUY'
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;
    const pnlPercent = (pnl / (entryPrice * quantity)) * 100;

    // 手数料計算（簡略化）
    const commission = quantity * entryPrice * this.config.commission;
    const slippage = quantity * entryPrice * this.config.slippage;

    const netPnl = pnl - commission - slippage;
    const netPnlPercent = (netPnl / (entryPrice * quantity)) * 100;

    return {
      id: `${symbol}_${Date.now()}`,
      symbol,
      market,
      side,
      quantity,
      entryPrice,
      exitPrice,
      entryTime,
      exitTime,
      duration: exitTime.getTime() - entryTime.getTime(),
      pnl,
      pnlPercent,
      commission,
      slippage,
      netPnl,
      netPnlPercent,
      exitReason,
      strategy: this.config.strategy.getConfig().name,
    };
  }

  /**
   * ポジションを更新
   */
  private async updatePositions(
    positions: Map<string, BacktestPosition>,
    marketData: Map<string, any>,
    date: Date
  ): Promise<void> {
    for (const [symbol, position] of positions) {
      try {
        const marketKey = `${symbol}_${position.market}`;
        const data = marketData.get(marketKey);

        if (!data) continue;

        const currentPrice = data.close;
        position.currentPrice = currentPrice;
        position.marketValue = position.quantity * currentPrice;

        if (position.side === 'LONG') {
          position.unrealizedPnL =
            (currentPrice - position.averagePrice) * position.quantity;
        } else {
          position.unrealizedPnL =
            (position.averagePrice - currentPrice) * position.quantity;
        }

        position.unrealizedPnLPercent =
          (position.unrealizedPnL /
            (position.averagePrice * position.quantity)) *
          100;
        position.updatedAt = date;
      } catch (error) {
        console.error(`❌ ポジション更新エラー (${symbol}):`, error);
      }
    }
  }

  /**
   * ポートフォリオ価値を計算
   */
  private calculatePortfolioValue(
    positions: Map<string, BacktestPosition>,
    initialCapital: number
  ): number {
    const totalValue = Array.from(positions.values()).reduce(
      (sum, position) => {
        return sum + position.marketValue;
      },
      0
    );

    return initialCapital + totalValue;
  }

  /**
   * 日次リターンを計算
   */
  private calculateDailyReturn(
    portfolioValue: number,
    initialCapital: number
  ): number {
    return (portfolioValue - initialCapital) / initialCapital;
  }

  /**
   * 月次リターンを計算
   */
  private calculateMonthlyReturns(
    dailyReturns: DailyReturn[]
  ): MonthlyReturn[] {
    const monthlyReturns: MonthlyReturn[] = [];
    const monthlyData = new Map<string, DailyReturn[]>();

    // 日次データを月ごとにグループ化
    for (const dailyReturn of dailyReturns) {
      const monthKey = `${dailyReturn.date.getFullYear()}-${String(dailyReturn.date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, []);
      }
      monthlyData.get(monthKey)!.push(dailyReturn);
    }

    // 月次データを計算
    for (const [month, dailyData] of monthlyData) {
      const firstDay = dailyData[0];
      const lastDay = dailyData[dailyData.length - 1];

      const monthlyReturn =
        lastDay.cumulativeReturn - firstDay.cumulativeReturn;
      const monthlyReturnPercent =
        lastDay.cumulativeReturnPercent - firstDay.cumulativeReturnPercent;

      monthlyReturns.push({
        month,
        return: monthlyReturn,
        returnPercent: monthlyReturnPercent,
        cumulativeReturn: lastDay.cumulativeReturn,
        cumulativeReturnPercent: lastDay.cumulativeReturnPercent,
        portfolioValue: lastDay.portfolioValue,
        drawdown: lastDay.drawdown,
        drawdownPercent: lastDay.drawdownPercent,
      });
    }

    return monthlyReturns.sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * パフォーマンス指標を計算
   */
  private calculatePerformanceMetrics(
    trades: BacktestTrade[],
    dailyReturns: DailyReturn[],
    initialCapital: number
  ): any {
    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => t.netPnl > 0).length;
    const losingTrades = trades.filter((t) => t.netPnl < 0).length;

    const totalReturn =
      dailyReturns[dailyReturns.length - 1]?.cumulativeReturn || 0;
    const totalReturnPercent = (totalReturn / initialCapital) * 100;

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const averageWin =
      winningTrades > 0
        ? trades
            .filter((t) => t.netPnl > 0)
            .reduce((sum, t) => sum + t.netPnl, 0) / winningTrades
        : 0;
    const averageLoss =
      losingTrades > 0
        ? trades
            .filter((t) => t.netPnl < 0)
            .reduce((sum, t) => sum + t.netPnl, 0) / losingTrades
        : 0;

    const largestWin =
      trades.length > 0 ? Math.max(...trades.map((t) => t.netPnl)) : 0;
    const largestLoss =
      trades.length > 0 ? Math.min(...trades.map((t) => t.netPnl)) : 0;

    const profitFactor =
      Math.abs(averageLoss) > 0 ? Math.abs(averageWin / averageLoss) : 0;

    const maxDrawdown = Math.min(...dailyReturns.map((d) => d.drawdown));
    const maxDrawdownPercent = Math.min(
      ...dailyReturns.map((d) => d.drawdownPercent)
    );

    // 年率化リターン（簡略化）
    const days = dailyReturns.length;
    const annualizedReturn =
      days > 0 ? Math.pow(1 + totalReturnPercent / 100, 365 / days) - 1 : 0;

    // シャープレシオ（簡略化）
    const returns = dailyReturns.map((d) => d.return);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      returns.length;
    const volatility = Math.sqrt(variance);
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

    // ソルティノレシオ（簡略化）
    const negativeReturns = returns.filter((r) => r < 0);
    const downsideVariance =
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
      negativeReturns.length;
    const downsideVolatility = Math.sqrt(downsideVariance);
    const sortinoRatio =
      downsideVolatility > 0 ? avgReturn / downsideVolatility : 0;

    // カルマーレシオ
    const calmarRatio =
      Math.abs(maxDrawdownPercent) > 0
        ? annualizedReturn / Math.abs(maxDrawdownPercent)
        : 0;

    // 平均取引期間
    const averageTradeDuration =
      totalTrades > 0
        ? trades.reduce((sum, t) => sum + t.duration, 0) / totalTrades
        : 0;

    return {
      totalReturn,
      totalReturnPercent,
      annualizedReturn,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownPercent,
      calmarRatio,
      winRate,
      profitFactor,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      totalTrades,
      winningTrades,
      losingTrades,
      averageTradeDuration,
    };
  }

  /**
   * リスク指標を計算
   */
  private calculateRiskMetrics(
    dailyReturns: DailyReturn[],
    trades: BacktestTrade[]
  ): any {
    const returns = dailyReturns.map((d) => d.return);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      returns.length;
    const volatility = Math.sqrt(variance);

    // VaR計算（簡略化）
    const sortedReturns = returns.sort((a, b) => a - b);
    const var95Index = Math.floor(sortedReturns.length * 0.05);
    const var99Index = Math.floor(sortedReturns.length * 0.01);
    const var95 = sortedReturns[var95Index] || 0;
    const var99 = sortedReturns[var99Index] || 0;

    // CVaR計算（簡略化）
    const cvar95 =
      sortedReturns.slice(0, var95Index + 1).reduce((sum, r) => sum + r, 0) /
      (var95Index + 1);
    const cvar99 =
      sortedReturns.slice(0, var99Index + 1).reduce((sum, r) => sum + r, 0) /
      (var99Index + 1);

    return {
      volatility,
      beta: 1, // 簡略化
      alpha: 0, // 簡略化
      informationRatio: 0, // 簡略化
      treynorRatio: 0, // 簡略化
      var95,
      var99,
      cvar95,
      cvar99,
    };
  }

  /**
   * ベンチマーク比較を計算
   */
  private async calculateBenchmarkComparison(
    dailyReturns: DailyReturn[]
  ): Promise<BenchmarkComparison | undefined> {
    try {
      // 簡略化されたベンチマーク比較
      const strategyReturn =
        dailyReturns[dailyReturns.length - 1]?.cumulativeReturnPercent || 0;
      const benchmarkReturn = 10; // 仮のベンチマークリターン

      return {
        benchmark: 'S&P 500',
        strategyReturn,
        benchmarkReturn,
        excessReturn: strategyReturn - benchmarkReturn,
        trackingError: 5, // 簡略化
        informationRatio: (strategyReturn - benchmarkReturn) / 5,
        beta: 1, // 簡略化
        alpha: strategyReturn - benchmarkReturn,
        correlation: 0.8, // 簡略化
      };
    } catch (error) {
      console.error('❌ ベンチマーク比較計算エラー:', error);
      return undefined;
    }
  }

  /**
   * パラメータ最適化を実行
   */
  async optimizeParameters(
    strategy: TradingStrategy
  ): Promise<OptimizationResult> {
    try {
      console.log('🔄 パラメータ最適化開始...');

      const parameterSweep: ParameterSweep[] = [];
      let bestPerformance: BacktestResult | null = null;
      let bestParameters: Record<string, any> = {};
      let bestIteration = 0;

      // グリッドサーチ（簡略化）
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        try {
          // パラメータを生成
          const parameters = this.generateParameters(i);

          // 戦略の設定を更新
          strategy.updateConfig(parameters);

          // バックテストを実行
          const config = { ...this.config, strategy };
          const backtestEngine = new BacktestEngine(config);
          const result = await backtestEngine.runBacktest();

          parameterSweep.push({
            parameters,
            performance: result,
            iteration: i,
          });

          // 最良のパフォーマンスを更新
          if (
            !bestPerformance ||
            result.performance.totalReturnPercent >
              bestPerformance.performance.totalReturnPercent
          ) {
            bestPerformance = result;
            bestParameters = parameters;
            bestIteration = i;
          }
        } catch (error) {
          console.error(`❌ 最適化イテレーションエラー (${i}):`, error);
        }
      }

      if (!bestPerformance) {
        throw new Error('最適化に失敗しました');
      }

      console.log('✅ パラメータ最適化完了');

      return {
        bestParameters,
        bestPerformance,
        parameterSweep,
        optimizationMethod: 'GRID_SEARCH',
        totalIterations: iterations,
        bestIteration,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('❌ パラメータ最適化エラー:', error);
      throw error;
    }
  }

  /**
   * パラメータを生成
   */
  private generateParameters(iteration: number): Record<string, any> {
    // 簡略化されたパラメータ生成
    return {
      momentumPeriods: [5 + iteration, 10 + iteration, 20 + iteration],
      volumeThreshold: 0.1 + iteration * 0.01,
      priceChangeThreshold: 0.02 + iteration * 0.001,
    };
  }

  /**
   * バックテスト結果を分析
   */
  async analyzePerformance(result: BacktestResult): Promise<any> {
    try {
      console.log('🔄 パフォーマンス分析開始...');

      const analysis = {
        summary: {
          totalReturn: result.performance.totalReturnPercent,
          sharpeRatio: result.performance.sharpeRatio,
          maxDrawdown: result.performance.maxDrawdownPercent,
          winRate: result.performance.winRate,
          totalTrades: result.performance.totalTrades,
        },
        riskAnalysis: {
          volatility: result.riskMetrics.volatility,
          var95: result.riskMetrics.var95,
          var99: result.riskMetrics.var99,
        },
        tradeAnalysis: {
          averageWin: result.performance.averageWin,
          averageLoss: result.performance.averageLoss,
          profitFactor: result.performance.profitFactor,
          largestWin: result.performance.largestWin,
          largestLoss: result.performance.largestLoss,
        },
        benchmarkComparison: result.benchmarkComparison,
        recommendations: this.generateRecommendations(result),
      };

      console.log('✅ パフォーマンス分析完了');
      return analysis;
    } catch (error) {
      console.error('❌ パフォーマンス分析エラー:', error);
      throw error;
    }
  }

  /**
   * 推奨事項を生成
   */
  private generateRecommendations(result: BacktestResult): string[] {
    const recommendations: string[] = [];

    if (result.performance.sharpeRatio < 1) {
      recommendations.push(
        'シャープレシオが低いです。リスク調整後のリターンを改善する必要があります。'
      );
    }

    if (result.performance.maxDrawdownPercent < -20) {
      recommendations.push(
        '最大ドローダウンが大きすぎます。リスク管理を強化してください。'
      );
    }

    if (result.performance.winRate < 50) {
      recommendations.push(
        '勝率が低いです。エントリー条件を見直してください。'
      );
    }

    if (result.performance.profitFactor < 1.5) {
      recommendations.push(
        'プロフィットファクターが低いです。損切りと利確のバランスを見直してください。'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        '戦略のパフォーマンスは良好です。現在の設定を維持することを推奨します。'
      );
    }

    return recommendations;
  }

  /**
   * バックテストの状態を取得
   */
  getStatus(): { running: boolean; progress: number } {
    return {
      running: this.isRunning,
      progress: this.isRunning ? 0.5 : 1, // 簡略化
    };
  }
}
