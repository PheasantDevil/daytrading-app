import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { TradeHistory } from '../trading/day-trading-scheduler';

/**
 * 取引データ
 */
export interface TradeData {
  date: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  profitRate?: number;
  profitAmount?: number;
  reason: string;
  timestamp: Date;
}

/**
 * 日次データ
 */
export interface DailyData {
  date: string;
  candidates: string[];
  selectedSymbol: string | null;
  buySignals: { [symbol: string]: { buy: number; hold: number; sell: number } };
  trades: TradeData[];
  dailyStats: {
    trades: number;
    wins: number;
    losses: number;
    totalProfit: number;
    winRate: number;
  };
}

/**
 * 週次統計
 */
export interface WeeklyStats {
  week: string;
  tradingDays: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  averageProfit: number;
  averageLoss: number;
  maxProfit: number;
  maxLoss: number;
  symbols: { [symbol: string]: number };
}

/**
 * 取引データ収集サービス
 */
export class TradeDataCollector extends EventEmitter {
  private logger: Logger;
  private dataDir: string;
  private dailyData: DailyData[] = [];

  constructor(dataDir: string = './reports/trading-data') {
    super();
    this.logger = new Logger('TradeDataCollector');
    this.dataDir = dataDir;
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    try {
      // データディレクトリ作成
      if (!existsSync(this.dataDir)) {
        await mkdir(this.dataDir, { recursive: true });
        this.logger.info(`データディレクトリを作成: ${this.dataDir}`);
      }

      // 既存データの読み込み
      await this.loadExistingData();

      this.logger.info('✅ TradeDataCollector初期化完了');
    } catch (error) {
      this.logger.error('初期化エラー:', error);
      throw error;
    }
  }

  /**
   * 日次データの記録
   */
  async recordDailyData(data: DailyData): Promise<void> {
    try {
      this.dailyData.push(data);

      // JSON形式で保存
      const filename = `daily-${data.date}.json`;
      const filepath = path.join(this.dataDir, filename);

      await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');

      this.logger.info(`✅ 日次データを保存: ${filename}`);
      this.emit('dailyDataRecorded', data);

      // 統合ファイルも更新
      await this.saveAllData();
    } catch (error) {
      this.logger.error('日次データ記録エラー:', error);
      throw error;
    }
  }

  /**
   * 取引データの記録
   */
  async recordTrade(trade: TradeHistory): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // 今日のデータを探す
    let todayData = this.dailyData.find((d) => d.date === today);

    if (!todayData) {
      todayData = {
        date: today,
        candidates: [],
        selectedSymbol: null,
        buySignals: {},
        trades: [],
        dailyStats: {
          trades: 0,
          wins: 0,
          losses: 0,
          totalProfit: 0,
          winRate: 0,
        },
      };
      this.dailyData.push(todayData);
    }

    // 取引を追加
    todayData.trades.push({
      date: today,
      symbol: trade.symbol,
      action: trade.action,
      quantity: trade.quantity,
      price: trade.price,
      profitRate: trade.profitRate,
      profitAmount: trade.profitAmount,
      reason: trade.reason,
      timestamp: trade.date,
    });

    // 統計を更新
    if (trade.action === 'SELL' && trade.profitRate !== undefined) {
      todayData.dailyStats.trades++;
      if (trade.profitRate > 0) {
        todayData.dailyStats.wins++;
      } else {
        todayData.dailyStats.losses++;
      }
      todayData.dailyStats.totalProfit += trade.profitAmount || 0;
      todayData.dailyStats.winRate =
        todayData.dailyStats.trades > 0
          ? (todayData.dailyStats.wins / todayData.dailyStats.trades) * 100
          : 0;
    }

    await this.saveAllData();
    this.logger.info(`✅ 取引データを記録: ${trade.action} ${trade.symbol}`);
  }

  /**
   * 週次統計の生成
   */
  async generateWeeklyStats(): Promise<WeeklyStats> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weekData = this.dailyData.filter((d) => {
      const dataDate = new Date(d.date);
      return dataDate >= oneWeekAgo;
    });

    const allTrades = weekData.flatMap((d) => d.trades);
    const sellTrades = allTrades.filter((t) => t.action === 'SELL');

    const wins = sellTrades.filter((t) => (t.profitRate || 0) > 0).length;
    const losses = sellTrades.filter((t) => (t.profitRate || 0) < 0).length;
    const totalProfit = sellTrades.reduce(
      (sum, t) => sum + (t.profitAmount || 0),
      0
    );

    const profits = sellTrades
      .filter((t) => (t.profitRate || 0) > 0)
      .map((t) => t.profitAmount || 0);
    const lossAmounts = sellTrades
      .filter((t) => (t.profitRate || 0) < 0)
      .map((t) => t.profitAmount || 0);

    const symbols: { [symbol: string]: number } = {};
    allTrades.forEach((t) => {
      symbols[t.symbol] = (symbols[t.symbol] || 0) + 1;
    });

    const stats: WeeklyStats = {
      week: `${oneWeekAgo.toISOString().split('T')[0]} - ${new Date().toISOString().split('T')[0]}`,
      tradingDays: weekData.length,
      totalTrades: sellTrades.length,
      wins,
      losses,
      winRate: sellTrades.length > 0 ? (wins / sellTrades.length) * 100 : 0,
      totalProfit,
      averageProfit:
        profits.length > 0
          ? profits.reduce((a, b) => a + b, 0) / profits.length
          : 0,
      averageLoss:
        lossAmounts.length > 0
          ? lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length
          : 0,
      maxProfit: profits.length > 0 ? Math.max(...profits) : 0,
      maxLoss: lossAmounts.length > 0 ? Math.min(...lossAmounts) : 0,
      symbols,
    };

    // 週次レポートを保存
    const filename = `weekly-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(this.dataDir, filename);
    await writeFile(filepath, JSON.stringify(stats, null, 2), 'utf-8');

    this.logger.info(`✅ 週次統計を生成: ${filename}`);
    this.emit('weeklyStatsGenerated', stats);

    return stats;
  }

  /**
   * CSV形式でエクスポート
   */
  async exportToCSV(): Promise<string> {
    const allTrades = this.dailyData.flatMap((d) => d.trades);

    const csvHeader =
      'Date,Symbol,Action,Quantity,Price,ProfitRate,ProfitAmount,Reason\n';
    const csvRows = allTrades
      .map(
        (t) =>
          `${t.date},${t.symbol},${t.action},${t.quantity},${t.price.toFixed(2)},${(t.profitRate || 0) * 100},${t.profitAmount?.toFixed(2) || ''},${t.reason}`
      )
      .join('\n');

    const csv = csvHeader + csvRows;

    const filepath = path.join(
      this.dataDir,
      `trades-export-${new Date().toISOString().split('T')[0]}.csv`
    );
    await writeFile(filepath, csv, 'utf-8');

    this.logger.info(`✅ CSVエクスポート完了: ${filepath}`);
    return filepath;
  }

  /**
   * 全データの取得
   */
  getAllData(): DailyData[] {
    return this.dailyData;
  }

  /**
   * 期間指定でデータ取得
   */
  getDataByDateRange(startDate: string, endDate: string): DailyData[] {
    return this.dailyData.filter(
      (d) => d.date >= startDate && d.date <= endDate
    );
  }

  /**
   * 全データの保存
   */
  private async saveAllData(): Promise<void> {
    const filepath = path.join(this.dataDir, 'all-trades.json');
    await writeFile(filepath, JSON.stringify(this.dailyData, null, 2), 'utf-8');
  }

  /**
   * 既存データの読み込み
   */
  private async loadExistingData(): Promise<void> {
    try {
      const filepath = path.join(this.dataDir, 'all-trades.json');

      if (existsSync(filepath)) {
        const data = await readFile(filepath, 'utf-8');
        this.dailyData = JSON.parse(data);
        this.logger.info(
          `📁 既存データを読み込み: ${this.dailyData.length}日分`
        );
      } else {
        this.logger.info('📁 新規データ収集を開始');
      }
    } catch (error) {
      this.logger.warn('既存データの読み込みに失敗:', error);
      this.dailyData = [];
    }
  }
}
