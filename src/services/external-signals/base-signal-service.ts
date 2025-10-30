import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
import NodeCache from 'node-cache';
import Bottleneck from 'bottleneck';

/**
 * 取引シグナル
 */
export interface TradingSignal {
  source: string; // データソース名
  symbol: string; // 銘柄コード
  signal: 'BUY' | 'HOLD' | 'SELL'; // シグナル
  confidence: number; // 0-100 (確信度)
  reason: string; // 判定理由
  timestamp: Date; // 取得日時
}

/**
 * シグナルサービスインターフェース
 */
export interface ISignalService {
  name: string;
  getSignal(symbol: string): Promise<TradingSignal>;
  isAvailable(): Promise<boolean>;
}

/**
 * シグナルサービス基底クラス
 */
export abstract class BaseSignalService
  extends EventEmitter
  implements ISignalService
{
  protected logger: Logger;
  protected cache: NodeCache;
  protected limiter: Bottleneck;
  protected errorCount: number = 0;
  protected isDisabled: boolean = false;

  public abstract name: string;

  constructor(cacheTTL: number = 300, rateLimit: number = 1000) {
    super();
    this.logger = new Logger(`Signal_${this.constructor.name}`);

    // キャッシュ設定（デフォルト5分）
    this.cache = new NodeCache({ stdTTL: cacheTTL });

    // レート制限（デフォルト1秒に1リクエスト）
    this.limiter = new Bottleneck({
      minTime: rateLimit,
      maxConcurrent: 1,
    });
  }

  /**
   * シグナル取得（キャッシュ・エラーハンドリング付き）
   */
  async getSignal(symbol: string): Promise<TradingSignal> {
    // サービスが無効化されている場合
    if (this.isDisabled) {
      throw new Error(`${this.name} service is disabled due to errors`);
    }

    // キャッシュチェック
    const cacheKey = `${this.name}_${symbol}`;
    const cached = this.cache.get<TradingSignal>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    try {
      // レート制限付きで取得
      const signal = await this.limiter.schedule(() =>
        this.fetchSignal(symbol)
      );

      // キャッシュに保存
      this.cache.set(cacheKey, signal);

      // エラーカウントリセット
      this.errorCount = 0;

      this.emit('signalFetched', signal);
      return signal;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * 実際のシグナル取得処理（サブクラスで実装）
   */
  protected abstract fetchSignal(symbol: string): Promise<TradingSignal>;

  /**
   * サービスの可用性確認
   */
  async isAvailable(): Promise<boolean> {
    return !this.isDisabled;
  }

  /**
   * エラーハンドリング
   */
  protected handleError(error: any): void {
    this.errorCount++;
    this.logger.error(`Error in ${this.name}:`, error);

    // 3回連続エラーでサービス無効化
    if (this.errorCount >= 3) {
      this.isDisabled = true;
      this.logger.error(
        `${this.name} service disabled due to ${this.errorCount} consecutive errors`
      );
      this.emit('serviceDisabled', this.name);

      // 24時間後に自動再開
      setTimeout(
        () => {
          this.isDisabled = false;
          this.errorCount = 0;
          this.logger.info(`${this.name} service re-enabled`);
          this.emit('serviceEnabled', this.name);
        },
        24 * 60 * 60 * 1000
      );
    }
  }

  /**
   * キャッシュクリア
   */
  clearCache(): void {
    this.cache.flushAll();
    this.logger.info(`Cache cleared for ${this.name}`);
  }

  /**
   * サービスリセット
   */
  reset(): void {
    this.isDisabled = false;
    this.errorCount = 0;
    this.clearCache();
    this.logger.info(`${this.name} service reset`);
  }
}
