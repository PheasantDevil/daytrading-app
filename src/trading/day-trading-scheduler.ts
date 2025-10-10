import { EventEmitter } from 'events';
import cron from 'node-cron';
import { Logger } from '../utils/logger';
import { SignalAggregatorService } from '../services/signal-aggregator-service';
import { HybridMarketDataService } from '../services/hybrid-market-data-service';
import { InteractiveBrokersIntegration } from '../brokers/interactive-brokers-integration';
import { DayTradingConfig } from '../config/day-trading-config';

/**
 * ポジション情報
 */
export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  entryTime: Date;
  currentPrice: number;
  profitRate: number;
  profitAmount: number;
}

/**
 * 取引履歴
 */
export interface TradeHistory {
  date: Date;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  profitRate?: number;
  profitAmount?: number;
  reason: string;
}

/**
 * デイトレードスケジューラー
 * 時間ベースで自動的に購入・売却を実行
 */
export class DayTradingScheduler extends EventEmitter {
  private logger: Logger;
  private config: DayTradingConfig;
  private signalAggregator: SignalAggregatorService;
  private marketDataService: HybridMarketDataService;
  private brokerIntegration: InteractiveBrokersIntegration;

  private isRunning: boolean = false;
  private currentPosition: Position | null = null;
  private tradeHistory: TradeHistory[] = [];
  private buyTask?: cron.ScheduledTask;
  private sellTask?: NodeJS.Timeout;
  private forceCloseTask?: cron.ScheduledTask;

  constructor(
    config: DayTradingConfig,
    signalAggregator: SignalAggregatorService,
    marketDataService: HybridMarketDataService,
    brokerIntegration: InteractiveBrokersIntegration
  ) {
    super();
    this.config = config;
    this.signalAggregator = signalAggregator;
    this.marketDataService = marketDataService;
    this.brokerIntegration = brokerIntegration;
    this.logger = new Logger('DayTradingScheduler');
  }

  /**
   * スケジューラー開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('スケジューラーは既に実行中です');
      return;
    }

    if (!this.config.trading.enabled) {
      this.logger.warn('自動取引が無効化されています（config.trading.enabled = false）');
      return;
    }

    this.logger.info('🚀 デイトレードスケジューラーを開始します...');
    this.logger.info(`モード: ${this.config.trading.paperTrading ? 'ペーパートレーディング' : '本番取引'}`);
    this.logger.info(`タイムゾーン: ${this.config.schedule.timezone}`);

    this.isRunning = true;

    // 購入フェーズのスケジュール設定
    this.scheduleBuyPhase();

    // 強制決済のスケジュール設定
    this.scheduleForceClose();

    this.logger.info('✅ スケジューラーが起動しました');
    this.logger.info(`📅 購入時刻: ${this.config.schedule.buyTime}`);
    this.logger.info(`📅 売却チェック開始: ${this.config.schedule.sellCheckStart}`);
    this.logger.info(`📅 強制決済時刻: ${this.config.schedule.forceCloseTime}`);

    this.emit('started');
  }

  /**
   * スケジューラー停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('スケジューラーは停止中です');
      return;
    }

    this.logger.info('デイトレードスケジューラーを停止します...');

    // 全てのスケジュールタスクを停止
    if (this.buyTask) {
      this.buyTask.stop();
    }
    if (this.sellTask) {
      clearInterval(this.sellTask);
    }
    if (this.forceCloseTask) {
      this.forceCloseTask.stop();
    }

    this.isRunning = false;
    this.logger.info('✅ スケジューラーが停止しました');
    this.emit('stopped');
  }

  /**
   * 購入フェーズのスケジュール設定
   */
  private scheduleBuyPhase(): void {
    const [hour, minute] = this.config.schedule.buyTime.split(':');
    const cronExpression = `${minute} ${hour} * * 1-5`; // 月-金

    this.logger.info(`購入フェーズスケジュール: ${cronExpression}`);

    this.buyTask = cron.schedule(cronExpression, async () => {
      await this.executeBuyPhase();
    });
  }

  /**
   * 強制決済のスケジュール設定
   */
  private scheduleForceClose(): void {
    const [hour, minute] = this.config.schedule.forceCloseTime.split(':');
    const cronExpression = `${minute} ${hour} * * 1-5`; // 月-金

    this.logger.info(`強制決済スケジュール: ${cronExpression}`);

    this.forceCloseTask = cron.schedule(cronExpression, async () => {
      await this.forceClosePositions();
    });
  }

  /**
   * 購入フェーズ実行
   */
  private async executeBuyPhase(): Promise<void> {
    try {
      this.logger.info('\n🔍 ========== 購入フェーズ開始 ==========');
      this.logger.info(`日時: ${new Date().toLocaleString()}`);

      // 既にポジションがある場合はスキップ
      if (this.currentPosition) {
        this.logger.info('⚠️ 既にポジションを保有中のため、購入をスキップします');
        return;
      }

      // 1日の取引数制限チェック
      const today = new Date().toDateString();
      const todayTrades = this.tradeHistory.filter(
        (t) => t.date.toDateString() === today && t.action === 'BUY'
      ).length;

      if (todayTrades >= this.config.riskManagement.maxDailyTrades) {
        this.logger.info(
          `⚠️ 本日の取引上限（${this.config.riskManagement.maxDailyTrades}回）に達しました`
        );
        return;
      }

      // 1. 候補銘柄のスクリーニング
      this.logger.info('\n📊 Step 1: 候補銘柄のスクリーニング');
      const candidates = await this.screenCandidates();
      this.logger.info(`候補銘柄: ${candidates.join(', ')}`);

      if (candidates.length === 0) {
        this.logger.info('❌ 候補銘柄なし、本日は見送り');
        return;
      }

      // 2. 各候補のシグナル集約
      this.logger.info('\n📈 Step 2: シグナル集約');
      const signals =
        await this.signalAggregator.aggregateMultipleSignals(candidates);

      // 3. 最適候補の選択
      this.logger.info('\n🎯 Step 3: 最適候補の選択');
      const best = this.signalAggregator.selectBestBuyCandidate(signals);

      if (!best) {
        this.logger.info('❌ 購入推奨銘柄なし、本日は見送り');
        return;
      }

      this.logger.info(`✅ 最適候補: ${best.symbol}`);
      this.logger.info(`買い推奨率: ${best.buyPercentage.toFixed(1)}%`);
      this.logger.info(`賛成: ${best.buySignals}/${best.totalSources}サイト`);

      // 4. 購入実行
      if (this.config.trading.confirmBeforeTrade) {
        this.logger.info('\n⚠️ 取引前確認が有効です（config.trading.confirmBeforeTrade）');
        this.logger.info('実際の取引はスキップします');
        this.emit('buySignalGenerated', best);
        return;
      }

      await this.executeBuy(best.symbol, best);

      // 売却チェック開始
      this.startSellMonitoring();
    } catch (error) {
      this.logger.error('購入フェーズでエラーが発生しました:', error);
      this.emit('error', error);
    }
  }

  /**
   * 候補銘柄のスクリーニング
   */
  private async screenCandidates(): Promise<string[]> {
    const candidates = await this.marketDataService.screenStocks({
      minVolume: this.config.screening.minVolume,
      minPrice: this.config.screening.minPrice,
      maxPrice: this.config.screening.maxPrice,
    });

    return candidates.slice(0, this.config.screening.candidateCount);
  }

  /**
   * 購入実行
   */
  private async executeBuy(symbol: string, signal: any): Promise<void> {
    try {
      this.logger.info('\n💰 Step 4: 購入実行');
      this.logger.info(`銘柄: ${symbol}`);

      // 市場データ取得
      const marketData = await this.marketDataService.getMarketData(symbol);
      const price = marketData.price;

      // ポジションサイズ計算
      const quantity = Math.floor(
        this.config.riskManagement.maxPositionSize / price
      );

      this.logger.info(`購入価格: $${price.toFixed(2)}`);
      this.logger.info(`購入数量: ${quantity}株`);
      this.logger.info(`購入金額: $${(price * quantity).toFixed(2)}`);

      // 注文実行
      const order = await this.brokerIntegration.placeOrder({
        symbol,
        side: 'buy',
        quantity,
        type: 'market',
      });

      this.logger.info(`✅ 購入完了: ${symbol} × ${quantity}株 @ $${price.toFixed(2)}`);

      // ポジション記録
      this.currentPosition = {
        symbol,
        quantity,
        entryPrice: price,
        entryTime: new Date(),
        currentPrice: price,
        profitRate: 0,
        profitAmount: 0,
      };

      // 取引履歴に追加
      this.tradeHistory.push({
        date: new Date(),
        symbol,
        action: 'BUY',
        quantity,
        price,
        reason: `シグナル集約: ${signal.buySignals}/${signal.totalSources}サイトが推奨`,
      });

      this.emit('buyExecuted', this.currentPosition);
    } catch (error) {
      this.logger.error('購入実行に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 売却監視の開始
   */
  private startSellMonitoring(): void {
    const [hour, minute] = this.config.schedule.sellCheckStart.split(':');
    const now = new Date();
    const sellCheckTime = new Date(now);
    sellCheckTime.setHours(parseInt(hour), parseInt(minute), 0, 0);

    // 売却チェック開始時刻まで待機
    const waitTime = sellCheckTime.getTime() - now.getTime();

    if (waitTime > 0) {
      this.logger.info(
        `⏰ ${this.config.schedule.sellCheckStart}から売却チェックを開始します`
      );

      setTimeout(() => {
        this.logger.info('\n🔄 売却監視を開始します');
        this.startSellChecks();
      }, waitTime);
    } else {
      // 既に売却チェック時刻を過ぎている場合は即座に開始
      this.logger.info('\n🔄 売却監視を開始します');
      this.startSellChecks();
    }
  }

  /**
   * 売却チェックの開始
   */
  private startSellChecks(): void {
    this.sellTask = setInterval(async () => {
      await this.executeSellPhase();
    }, this.config.schedule.sellCheckInterval);
  }

  /**
   * 売却フェーズ実行
   */
  private async executeSellPhase(): Promise<void> {
    try {
      if (!this.currentPosition) {
        return;
      }

      // 現在価格を取得
      const marketData = await this.marketDataService.getMarketData(
        this.currentPosition.symbol
      );
      const currentPrice = marketData.price;

      // 損益計算
      const profitRate =
        (currentPrice - this.currentPosition.entryPrice) /
        this.currentPosition.entryPrice;
      const profitAmount =
        (currentPrice - this.currentPosition.entryPrice) *
        this.currentPosition.quantity;

      // ポジション更新
      this.currentPosition.currentPrice = currentPrice;
      this.currentPosition.profitRate = profitRate;
      this.currentPosition.profitAmount = profitAmount;

      this.logger.debug(
        `📊 ${this.currentPosition.symbol}: $${currentPrice.toFixed(2)} (${(profitRate * 100).toFixed(2)}%)`
      );

      // ストップロス判定
      if (profitRate <= this.config.riskManagement.stopLoss) {
        this.logger.warn(
          `⚠️ ストップロス発動: ${this.currentPosition.symbol} (${(profitRate * 100).toFixed(2)}%)`
        );
        await this.executeSell('ストップロス');
        return;
      }

      // 緊急ストップロス判定
      if (profitRate <= this.config.riskManagement.emergencyStopLoss) {
        this.logger.error(
          `🚨 緊急ストップロス発動: ${this.currentPosition.symbol} (${(profitRate * 100).toFixed(2)}%)`
        );
        await this.executeSell('緊急ストップロス');
        return;
      }

      // テイクプロフィット判定（+5%以上）
      if (profitRate >= this.config.riskManagement.takeProfit) {
        this.logger.info(
          `✅ 目標利益達成: ${this.currentPosition.symbol} (+${(profitRate * 100).toFixed(2)}%)`
        );

        // シグナル確認
        const signal = await this.signalAggregator.aggregateSignals(
          this.currentPosition.symbol
        );

        this.logger.info(
          `シグナル確認: SELL=${signal.sellSignals}/${signal.totalSources}`
        );

        // 売りシグナルが過半数、または+7%以上なら即売却
        if (signal.shouldSell || profitRate >= 0.07) {
          await this.executeSell(
            `目標達成 (+${(profitRate * 100).toFixed(2)}%)`
          );
        } else {
          this.logger.info('保持継続（売りシグナルが過半数未満）');
        }
      }
    } catch (error) {
      this.logger.error('売却フェーズでエラーが発生しました:', error);
      this.emit('error', error);
    }
  }

  /**
   * 売却実行
   */
  private async executeSell(reason: string): Promise<void> {
    if (!this.currentPosition) {
      this.logger.warn('売却対象のポジションがありません');
      return;
    }

    try {
      this.logger.info('\n💰 ========== 売却実行 ==========');
      this.logger.info(`銘柄: ${this.currentPosition.symbol}`);
      this.logger.info(`理由: ${reason}`);
      this.logger.info(`購入価格: $${this.currentPosition.entryPrice.toFixed(2)}`);
      this.logger.info(
        `現在価格: $${this.currentPosition.currentPrice.toFixed(2)}`
      );
      this.logger.info(
        `損益率: ${(this.currentPosition.profitRate * 100).toFixed(2)}%`
      );
      this.logger.info(`損益額: $${this.currentPosition.profitAmount.toFixed(2)}`);

      // 注文実行
      const order = await this.brokerIntegration.placeOrder({
        symbol: this.currentPosition.symbol,
        side: 'sell',
        quantity: this.currentPosition.quantity,
        type: 'market',
      });

      this.logger.info(
        `✅ 売却完了: ${this.currentPosition.symbol} × ${this.currentPosition.quantity}株`
      );

      // 取引履歴に追加
      this.tradeHistory.push({
        date: new Date(),
        symbol: this.currentPosition.symbol,
        action: 'SELL',
        quantity: this.currentPosition.quantity,
        price: this.currentPosition.currentPrice,
        profitRate: this.currentPosition.profitRate,
        profitAmount: this.currentPosition.profitAmount,
        reason,
      });

      this.emit('sellExecuted', this.currentPosition);

      // ポジションクリア
      this.currentPosition = null;

      // 売却監視停止
      if (this.sellTask) {
        clearInterval(this.sellTask);
        this.sellTask = undefined;
      }
    } catch (error) {
      this.logger.error('売却実行に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 強制決済
   */
  private async forceClosePositions(): Promise<void> {
    this.logger.info('\n⏰ ========== 強制決済時刻 ==========');

    if (this.currentPosition) {
      this.logger.warn('市場クローズのため強制決済を実行します');
      await this.executeSell('強制決済（市場クローズ）');
    } else {
      this.logger.info('保有ポジションなし');
    }
  }

  /**
   * 現在のポジション取得
   */
  getCurrentPosition(): Position | null {
    return this.currentPosition;
  }

  /**
   * 取引履歴取得
   */
  getTradeHistory(): TradeHistory[] {
    return this.tradeHistory;
  }

  /**
   * 本日の取引統計
   */
  getTodayStats(): {
    trades: number;
    wins: number;
    losses: number;
    totalProfit: number;
    winRate: number;
  } {
    const today = new Date().toDateString();
    const todayTrades = this.tradeHistory.filter(
      (t) => t.date.toDateString() === today && t.action === 'SELL'
    );

    const wins = todayTrades.filter((t) => (t.profitRate || 0) > 0).length;
    const losses = todayTrades.filter((t) => (t.profitRate || 0) < 0).length;
    const totalProfit = todayTrades.reduce(
      (sum, t) => sum + (t.profitAmount || 0),
      0
    );
    const winRate = todayTrades.length > 0 ? (wins / todayTrades.length) * 100 : 0;

    return {
      trades: todayTrades.length,
      wins,
      losses,
      totalProfit,
      winRate,
    };
  }

  /**
   * デイリーレポート生成
   */
  generateDailyReport(): string {
    const stats = this.getTodayStats();
    const today = new Date().toLocaleDateString();

    const report = `
========== デイリーレポート ==========
日付: ${today}

【取引統計】
取引回数: ${stats.trades}
勝ち: ${stats.wins}
負け: ${stats.losses}
勝率: ${stats.winRate.toFixed(1)}%
総損益: $${stats.totalProfit.toFixed(2)}

【取引履歴】
${this.tradeHistory
  .filter((t) => t.date.toDateString() === new Date().toDateString())
  .map(
    (t, i) =>
      `${i + 1}. ${t.action} ${t.symbol} × ${t.quantity}株 @ $${t.price.toFixed(2)}
   理由: ${t.reason}
   ${t.profitRate ? `損益: ${(t.profitRate * 100).toFixed(2)}% ($${t.profitAmount?.toFixed(2)})` : ''}`
  )
  .join('\n')}

========================================
    `.trim();

    return report;
  }

  /**
   * テストモード実行（時間を待たずに即座に実行）
   */
  async testRun(): Promise<void> {
    this.logger.info('🧪 テストモード実行');

    // 購入フェーズ
    await this.executeBuyPhase();

    // 5秒待機
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 売却フェーズ
    await this.executeSellPhase();

    // デイリーレポート
    const report = this.generateDailyReport();
    this.logger.info('\n' + report);
  }
}

