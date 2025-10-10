import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import {
  ISignalService,
  TradingSignal,
} from './external-signals/base-signal-service';

/**
 * 集約されたシグナル
 */
export interface AggregatedSignal {
  symbol: string;
  buySignals: number; // 買いシグナル数
  holdSignals: number; // 保留シグナル数
  sellSignals: number; // 売りシグナル数
  totalSources: number; // 総ソース数
  buyPercentage: number; // 買い推奨率
  shouldBuy: boolean; // 購入すべきか（過半数判定）
  shouldSell: boolean; // 売却すべきか（過半数判定）
  signals: TradingSignal[]; // 個別シグナル詳細
  timestamp: Date;
}

/**
 * シグナル統合サービス設定
 */
export interface SignalAggregatorConfig {
  // 過半数判定の閾値（サイト数ごと）
  requiredVoteRatio: {
    [key: number]: number;
  };
  // タイムアウト（ms）
  timeout: number;
  // 最小必要ソース数
  minSources: number;
}

/**
 * シグナル統合サービス
 * 複数のシグナルサービスからデータを収集し、過半数判定を行う
 */
export class SignalAggregatorService extends EventEmitter {
  private logger: Logger;
  private signalServices: ISignalService[];
  private config: SignalAggregatorConfig;

  constructor(
    services: ISignalService[],
    config?: Partial<SignalAggregatorConfig>
  ) {
    super();
    this.logger = new Logger('SignalAggregator');
    this.signalServices = services;

    // デフォルト設定
    this.config = {
      requiredVoteRatio: {
        3: 0.67, // 3サイト → 67%以上 = 2サイト以上
        4: 0.75, // 4サイト → 75%以上 = 3サイト以上
        5: 0.8, // 5サイト → 80%以上 = 4サイト以上
        6: 0.67, // 6サイト → 67%以上 = 4サイト以上
      },
      timeout: 30000, // 30秒
      minSources: 2, // 最低2サイト必要
      ...config,
    };

    this.logger.info(
      `シグナル統合サービス初期化: ${services.length}サービス登録`
    );
  }

  /**
   * 複数サービスからシグナルを集約
   */
  async aggregateSignals(symbol: string): Promise<AggregatedSignal> {
    this.logger.info(`シグナル集約開始: ${symbol}`);

    try {
      // 全サービスから並列にシグナル取得（タイムアウト付き）
      const signalPromises = this.signalServices.map(async (service) => {
        try {
          // サービスが利用可能かチェック
          const isAvailable = await service.isAvailable();
          if (!isAvailable) {
            this.logger.warn(`${service.name} is disabled, skipping`);
            return null;
          }

          // タイムアウト付きでシグナル取得
          const signal = await Promise.race([
            service.getSignal(symbol),
            this.timeout(this.config.timeout),
          ]);

          this.logger.info(
            `✅ ${service.name}: ${signal.signal} (${signal.confidence}%)`
          );
          return signal;
        } catch (error) {
          this.logger.warn(`${service.name} failed:`, error);
          return null;
        }
      });

      const signals = await Promise.all(signalPromises);

      // nullを除外
      const validSignals = signals.filter(
        (s): s is TradingSignal => s !== null
      );

      if (validSignals.length < this.config.minSources) {
        throw new Error(
          `Insufficient signal sources: ${validSignals.length}/${this.config.minSources}`
        );
      }

      // シグナルを集計
      const buySignals = validSignals.filter((s) => s.signal === 'BUY').length;
      const holdSignals = validSignals.filter(
        (s) => s.signal === 'HOLD'
      ).length;
      const sellSignals = validSignals.filter(
        (s) => s.signal === 'SELL'
      ).length;
      const totalSources = validSignals.length;
      const buyPercentage = (buySignals / totalSources) * 100;
      const sellPercentage = (sellSignals / totalSources) * 100;

      // 過半数判定
      const requiredVotes = this.calculateRequiredVotes(totalSources);
      const shouldBuy = buySignals >= requiredVotes;
      const shouldSell = sellSignals >= requiredVotes;

      const result: AggregatedSignal = {
        symbol,
        buySignals,
        holdSignals,
        sellSignals,
        totalSources,
        buyPercentage,
        shouldBuy,
        shouldSell,
        signals: validSignals,
        timestamp: new Date(),
      };

      // ログ出力
      this.logger.info(`📊 集約結果: ${symbol}`);
      this.logger.info(
        `  BUY: ${buySignals}/${totalSources} (${buyPercentage.toFixed(1)}%)`
      );
      this.logger.info(
        `  HOLD: ${holdSignals}/${totalSources} (${((holdSignals / totalSources) * 100).toFixed(1)}%)`
      );
      this.logger.info(
        `  SELL: ${sellSignals}/${totalSources} (${sellPercentage.toFixed(1)}%)`
      );
      this.logger.info(
        `  必要票数: ${requiredVotes}票 (${(this.config.requiredVoteRatio[totalSources] || 0.67) * 100}%)`
      );
      this.logger.info(`  判定: 購入=${shouldBuy}, 売却=${shouldSell}`);

      this.emit('signalsAggregated', result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to aggregate signals for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 複数銘柄のシグナル集約
   */
  async aggregateMultipleSignals(
    symbols: string[]
  ): Promise<AggregatedSignal[]> {
    this.logger.info(`複数銘柄のシグナル集約: ${symbols.length}銘柄`);

    const results: AggregatedSignal[] = [];

    for (const symbol of symbols) {
      try {
        const signal = await this.aggregateSignals(symbol);
        results.push(signal);
      } catch (error) {
        this.logger.warn(`${symbol} のシグナル集約をスキップ:`, error);
      }
    }

    return results;
  }

  /**
   * 購入推奨銘柄のフィルタリング
   */
  filterBuyRecommendations(signals: AggregatedSignal[]): AggregatedSignal[] {
    return signals
      .filter((s) => s.shouldBuy)
      .sort((a, b) => b.buyPercentage - a.buyPercentage);
  }

  /**
   * 売却推奨銘柄のフィルタリング
   */
  filterSellRecommendations(signals: AggregatedSignal[]): AggregatedSignal[] {
    return signals
      .filter((s) => s.shouldSell)
      .sort((a, b) => b.sellSignals - a.sellSignals);
  }

  /**
   * 最適な購入候補を選択
   */
  selectBestBuyCandidate(signals: AggregatedSignal[]): AggregatedSignal | null {
    const buyRecommendations = this.filterBuyRecommendations(signals);

    if (buyRecommendations.length === 0) {
      this.logger.info('購入推奨銘柄なし');
      return null;
    }

    // 買いシグナル率が最も高い銘柄を選択
    const best = buyRecommendations[0];
    this.logger.info(
      `最適候補: ${best.symbol} (買い推奨率: ${best.buyPercentage.toFixed(1)}%)`
    );

    return best;
  }

  /**
   * 過半数に必要な票数を計算
   */
  private calculateRequiredVotes(total: number): number {
    // 設定から閾値を取得（デフォルト67%）
    const ratio = this.config.requiredVoteRatio[total] || 0.67;
    const required = Math.ceil(total * ratio);

    this.logger.debug(
      `Required votes for ${total} sources: ${required} (${ratio * 100}%)`
    );

    return required;
  }

  /**
   * タイムアウト処理
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    });
  }

  /**
   * 統計情報の取得
   */
  getStats(): {
    totalServices: number;
    activeServices: number;
    config: SignalAggregatorConfig;
  } {
    return {
      totalServices: this.signalServices.length,
      activeServices: this.signalServices.length, // TODO: 実際の有効サービス数
      config: this.config,
    };
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<SignalAggregatorConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('設定を更新しました:', config);
  }
}
