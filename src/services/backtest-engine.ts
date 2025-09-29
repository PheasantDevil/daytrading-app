/**
 * バックテストエンジン
 * 履歴データを使用した戦略の検証とパフォーマンス分析
 */

import { FeeCalculator } from './fee-calculator';
import { RiskManager } from './risk-manager';

export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  commissionRate: number;
  slippage: number; // スリッページ（%）
  riskParameters: {
    maxPositionSize: number;
    maxPortfolioRisk: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
    maxDrawdown: number;
  };
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date;
  commission: number;
  slippage: number;
  netPrice: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  entryTime: Date;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  positions: Position[];
  performance: {
    totalReturn: number;
    totalReturnPercent: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
  };
  equity: Array<{
    date: Date;
    value: number;
    drawdown: number;
  }>;
  riskMetrics: {
    portfolioRisk: number;
    positionRisks: Array<{
      symbol: string;
      risk: number;
    }>;
    dailyLosses: number[];
    maxDailyLoss: number;
  };
}

export class BacktestEngine {
  private config: BacktestConfig;
  private riskManager: RiskManager;
  private trades: Trade[] = [];
  private positions: Map<string, Position> = new Map();
  private equity: Array<{ date: Date; value: number; drawdown: number }> = [];
  private currentCapital: number;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.riskManager = new RiskManager(config.riskParameters);
    this.currentCapital = config.initialCapital;
  }

  /**
   * バックテストを実行
   * @param strategy 戦略関数
   * @param priceData 価格データ
   * @returns バックテスト結果
   */
  async runBacktest(
    strategy: (data: any) => Promise<
      Array<{
        symbol: string;
        action: 'BUY' | 'SELL' | 'HOLD';
        quantity?: number;
        price?: number;
      }>
    >,
    priceData: Array<{
      date: Date;
      symbol: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>
  ): Promise<BacktestResult> {
    console.log('🔄 バックテスト開始...');

    // 価格データを日付順にソート
    const sortedData = priceData.sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    // 日付範囲でフィルタリング
    const filteredData = sortedData.filter(
      (data) =>
        data.date >= this.config.startDate && data.date <= this.config.endDate
    );

    // 日付ごとに処理
    for (const data of filteredData) {
      await this.processDay(data, strategy);

      // エクイティを記録
      this.recordEquity(data.date);
    }

    // 結果を生成
    const result = this.generateResult();

    console.log('✅ バックテスト完了');
    return result;
  }

  /**
   * 1日の処理
   * @param data 日次データ
   * @param strategy 戦略関数
   */
  private async processDay(
    data: {
      date: Date;
      symbol: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    },
    strategy: (data: any) => Promise<
      Array<{
        symbol: string;
        action: 'BUY' | 'SELL' | 'HOLD';
        quantity?: number;
        price?: number;
      }>
    >
  ): Promise<void> {
    // 戦略を実行
    const signals = await strategy(data);

    // 各シグナルを処理
    for (const signal of signals) {
      if (signal.action === 'BUY') {
        await this.executeBuy(
          signal.symbol,
          signal.quantity || 0,
          data.close,
          data.date
        );
      } else if (signal.action === 'SELL') {
        await this.executeSell(
          signal.symbol,
          signal.quantity || 0,
          data.close,
          data.date
        );
      }
    }

    // ポジションを更新
    this.updatePositions(data.symbol, data.close);
  }

  /**
   * 買い注文を実行
   * @param symbol 銘柄コード
   * @param quantity 数量
   * @param price 価格
   * @param timestamp タイムスタンプ
   */
  private async executeBuy(
    symbol: string,
    quantity: number,
    price: number,
    timestamp: Date
  ): Promise<void> {
    // リスクチェック
    const positionSize = this.riskManager.calculatePositionSize(
      this.currentCapital,
      price,
      price * (1 - this.config.riskParameters.stopLossPercent / 100)
    );

    const actualQuantity = Math.min(quantity, positionSize);

    if (actualQuantity <= 0) {
      return; // リスク制限により取引不可
    }

    // スリッページを適用
    const slippage = price * (this.config.slippage / 100);
    const netPrice = price + slippage;

    // 手数料を計算
    const commission = FeeCalculator.calculateCommission(
      actualQuantity * netPrice,
      'sbi'
    );

    // 取引を記録
    const trade: Trade = {
      id: `trade_${Date.now()}_${Math.random()}`,
      symbol,
      side: 'BUY',
      quantity: actualQuantity,
      price,
      timestamp,
      commission: commission.total,
      slippage: slippage,
      netPrice: netPrice,
    };

    this.trades.push(trade);

    // ポジションを更新
    const existingPosition = this.positions.get(symbol);
    if (existingPosition) {
      // 既存ポジションに追加
      const totalQuantity = existingPosition.quantity + actualQuantity;
      const averagePrice =
        (existingPosition.entryPrice * existingPosition.quantity +
          netPrice * actualQuantity) /
        totalQuantity;

      this.positions.set(symbol, {
        symbol,
        quantity: totalQuantity,
        entryPrice: averagePrice,
        entryTime: existingPosition.entryTime,
        currentPrice: price,
        unrealizedPnL: (price - averagePrice) * totalQuantity,
        unrealizedPnLPercent: ((price - averagePrice) / averagePrice) * 100,
      });
    } else {
      // 新しいポジション
      this.positions.set(symbol, {
        symbol,
        quantity: actualQuantity,
        entryPrice: netPrice,
        entryTime: timestamp,
        currentPrice: price,
        unrealizedPnL: (price - netPrice) * actualQuantity,
        unrealizedPnLPercent: ((price - netPrice) / netPrice) * 100,
      });
    }

    // 資本を更新
    this.currentCapital -= actualQuantity * netPrice + commission.total;
  }

  /**
   * 売り注文を実行
   * @param symbol 銘柄コード
   * @param quantity 数量
   * @param price 価格
   * @param timestamp タイムスタンプ
   */
  private async executeSell(
    symbol: string,
    quantity: number,
    price: number,
    timestamp: Date
  ): Promise<void> {
    const position = this.positions.get(symbol);
    if (!position || position.quantity <= 0) {
      return; // ポジションなし
    }

    const actualQuantity = Math.min(quantity, position.quantity);

    // スリッページを適用
    const slippage = price * (this.config.slippage / 100);
    const netPrice = price - slippage;

    // 手数料を計算
    const commission = FeeCalculator.calculateCommission(
      actualQuantity * netPrice,
      'sbi'
    );

    // 取引を記録
    const trade: Trade = {
      id: `trade_${Date.now()}_${Math.random()}`,
      symbol,
      side: 'SELL',
      quantity: actualQuantity,
      price,
      timestamp,
      commission: commission.total,
      slippage: slippage,
      netPrice: netPrice,
    };

    this.trades.push(trade);

    // ポジションを更新
    const remainingQuantity = position.quantity - actualQuantity;
    if (remainingQuantity <= 0) {
      // ポジションクローズ
      this.positions.delete(symbol);
    } else {
      // ポジション縮小
      this.positions.set(symbol, {
        ...position,
        quantity: remainingQuantity,
        unrealizedPnL: (price - position.entryPrice) * remainingQuantity,
        unrealizedPnLPercent:
          ((price - position.entryPrice) / position.entryPrice) * 100,
      });
    }

    // 資本を更新
    this.currentCapital += actualQuantity * netPrice - commission.total;
  }

  /**
   * ポジションを更新
   * @param symbol 銘柄コード
   * @param currentPrice 現在価格
   */
  private updatePositions(symbol: string, currentPrice: number): void {
    const position = this.positions.get(symbol);
    if (position) {
      position.currentPrice = currentPrice;
      position.unrealizedPnL =
        (currentPrice - position.entryPrice) * position.quantity;
      position.unrealizedPnLPercent =
        ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    }
  }

  /**
   * エクイティを記録
   * @param date 日付
   */
  private recordEquity(date: Date): void {
    let totalValue = this.currentCapital;

    // 未実現損益を加算
    for (const position of this.positions.values()) {
      totalValue += position.unrealizedPnL;
    }

    // ドローダウンを計算
    const peakValue = Math.max(
      ...this.equity.map((e) => e.value),
      this.config.initialCapital
    );
    const drawdown = ((peakValue - totalValue) / peakValue) * 100;

    this.equity.push({
      date,
      value: totalValue,
      drawdown: drawdown,
    });
  }

  /**
   * バックテスト結果を生成
   * @returns バックテスト結果
   */
  private generateResult(): BacktestResult {
    const totalTrades = this.trades.length;
    const winningTrades = this.trades.filter((trade) => {
      if (trade.side === 'SELL') {
        const buyTrade = this.trades.find(
          (t) =>
            t.symbol === trade.symbol &&
            t.side === 'BUY' &&
            t.timestamp < trade.timestamp
        );
        return buyTrade && trade.netPrice > buyTrade.netPrice;
      }
      return false;
    }).length;

    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const finalValue =
      this.equity[this.equity.length - 1]?.value || this.config.initialCapital;
    const totalReturn = finalValue - this.config.initialCapital;
    const totalReturnPercent = (totalReturn / this.config.initialCapital) * 100;

    const maxDrawdown = Math.max(...this.equity.map((e) => e.drawdown));

    return {
      config: this.config,
      trades: this.trades,
      positions: Array.from(this.positions.values()),
      performance: {
        totalReturn,
        totalReturnPercent,
        annualizedReturn: totalReturnPercent, // 簡略化
        sharpeRatio: 0, // 簡略化
        maxDrawdown,
        winRate,
        profitFactor: 0, // 簡略化
        totalTrades,
        winningTrades,
        losingTrades,
        averageWin: 0, // 簡略化
        averageLoss: 0, // 簡略化
        largestWin: 0, // 簡略化
        largestLoss: 0, // 簡略化
      },
      equity: this.equity,
      riskMetrics: {
        portfolioRisk: 0, // 簡略化
        positionRisks: Array.from(this.positions.values()).map((p) => ({
          symbol: p.symbol,
          risk: p.unrealizedPnL,
        })),
        dailyLosses: [], // 簡略化
        maxDailyLoss: 0, // 簡略化
      },
    };
  }
}
