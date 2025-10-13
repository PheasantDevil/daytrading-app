import axios from 'axios';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface LineNotificationConfig {
  channelAccessToken: string;
  userId?: string; // 個別ユーザーへの通知用
  groupId?: string; // グループへの通知用
  enabled: boolean;
}

export interface NotificationMessage {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: any;
}

/**
 * LINE Messaging API通知サービス
 */
export class LineNotificationService extends EventEmitter {
  private logger: Logger;
  private config: LineNotificationConfig;
  private apiEndpoint = 'https://api.line.me/v2/bot/message/push';

  constructor(config: LineNotificationConfig) {
    super();
    this.config = config;
    this.logger = new Logger('LineNotificationService');
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('LINE通知は無効化されています');
      return;
    }

    if (!this.config.channelAccessToken) {
      throw new Error('LINE Channel Access Tokenが設定されていません');
    }

    if (!this.config.userId && !this.config.groupId) {
      throw new Error('通知先（userId または groupId）が設定されていません');
    }

    this.logger.info('✅ LINE通知サービス初期化完了');
  }

  /**
   * メッセージ送信（汎用）
   */
  async sendMessage(notification: NotificationMessage): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug('LINE通知がスキップされました（無効化）');
      return;
    }

    try {
      const emoji = this.getEmoji(notification.type);
      const message = this.formatMessage(notification, emoji);

      await this.sendLineMessage(message);

      this.logger.info(`✅ LINE通知送信完了: ${notification.title}`);
      this.emit('messageSent', notification);
    } catch (error) {
      this.logger.error('❌ LINE通知送信エラー:', error);
      this.emit('messageError', error);
      // 通知失敗してもシステムは継続
    }
  }

  /**
   * 取引開始通知
   */
  async notifyTradingStart(config: any): Promise<void> {
    await this.sendMessage({
      type: 'info',
      title: '🚀 デイトレード開始',
      message:
        `検証用取引を開始しました\n` +
        `日付: ${new Date().toLocaleDateString('ja-JP')}\n` +
        `設定: ${config.name || '標準'}\n` +
        `ストップロス: ${(config.stopLoss * 100).toFixed(1)}%\n` +
        `テイクプロフィット: ${(config.takeProfit * 100).toFixed(1)}%`,
    });
  }

  /**
   * 購入実行通知
   */
  async notifyBuyExecuted(position: any): Promise<void> {
    const profit = this.calculatePotentialProfit(position);

    await this.sendMessage({
      type: 'success',
      title: '📈 購入実行',
      message:
        `銘柄: ${position.symbol}\n` +
        `数量: ${position.quantity}株\n` +
        `価格: $${position.entryPrice.toFixed(2)}\n` +
        `投資額: $${(position.quantity * position.entryPrice).toFixed(2)}\n` +
        `時刻: ${new Date().toLocaleTimeString('ja-JP')}\n` +
        `想定利益: $${profit.target.toFixed(2)} (${profit.rate}%)`,
      data: position,
    });
  }

  /**
   * 売却実行通知
   */
  async notifySellExecuted(position: any): Promise<void> {
    const emoji = position.profitRate > 0 ? '💰' : '📉';
    const result = position.profitRate > 0 ? '利益確定' : '損切り';

    await this.sendMessage({
      type: position.profitRate > 0 ? 'success' : 'warning',
      title: `${emoji} 売却実行（${result}）`,
      message:
        `銘柄: ${position.symbol}\n` +
        `損益率: ${(position.profitRate * 100).toFixed(2)}%\n` +
        `損益額: $${position.profitAmount.toFixed(2)}\n` +
        `売却価格: $${position.currentPrice.toFixed(2)}\n` +
        `時刻: ${new Date().toLocaleTimeString('ja-JP')}\n` +
        `理由: ${this.getSellReason(position)}`,
      data: position,
    });
  }

  /**
   * 価格監視通知（重要な価格変動時）
   */
  async notifyPriceUpdate(position: any): Promise<void> {
    // 利益率が±2%を超えた場合のみ通知
    if (Math.abs(position.profitRate) < 0.02) {
      return;
    }

    const emoji = position.profitRate > 0 ? '📈' : '📉';

    await this.sendMessage({
      type: 'info',
      title: `${emoji} 価格変動通知`,
      message:
        `銘柄: ${position.symbol}\n` +
        `現在価格: $${position.currentPrice.toFixed(2)}\n` +
        `購入価格: $${position.entryPrice.toFixed(2)}\n` +
        `損益率: ${(position.profitRate * 100).toFixed(2)}%\n` +
        `時刻: ${new Date().toLocaleTimeString('ja-JP')}`,
      data: position,
    });
  }

  /**
   * エラー通知
   */
  async notifyError(error: Error, context?: string): Promise<void> {
    await this.sendMessage({
      type: 'error',
      title: '❌ エラー発生',
      message:
        `${context ? `[${context}]\n` : ''}` +
        `エラー: ${error.message}\n` +
        `時刻: ${new Date().toLocaleTimeString('ja-JP')}\n` +
        `確認が必要です`,
      data: { error: error.message, stack: error.stack },
    });
  }

  /**
   * 異常終了通知
   */
  async notifyAbnormalExit(reason: string, lastState?: any): Promise<void> {
    await this.sendMessage({
      type: 'error',
      title: '⚠️ 異常終了',
      message:
        `デイトレードシステムが異常終了しました\n` +
        `理由: ${reason}\n` +
        `時刻: ${new Date().toLocaleString('ja-JP')}\n` +
        `${lastState ? `最終状態: ${JSON.stringify(lastState, null, 2)}` : ''}\n` +
        `至急確認してください`,
      data: lastState,
    });
  }

  /**
   * 日次レポート通知
   */
  async notifyDailyReport(report: any): Promise<void> {
    const emoji =
      report.totalProfit > 0 ? '🎉' : report.totalProfit < 0 ? '😢' : '😐';

    await this.sendMessage({
      type: report.totalProfit > 0 ? 'success' : 'info',
      title: `${emoji} 日次レポート`,
      message:
        `日付: ${new Date().toLocaleDateString('ja-JP')}\n` +
        `─────────────\n` +
        `取引数: ${report.trades}回\n` +
        `勝率: ${report.winRate.toFixed(1)}%\n` +
        `総損益: $${report.totalProfit.toFixed(2)}\n` +
        `最高利益: $${report.maxProfit.toFixed(2)}\n` +
        `最大損失: $${report.maxLoss.toFixed(2)}\n` +
        `─────────────\n` +
        `決済理由:\n` +
        `・ストップロス: ${report.stopLossTriggers}回\n` +
        `・テイクプロフィット: ${report.takeProfitTriggers}回\n` +
        `・強制決済: ${report.forceCloseTriggers}回`,
      data: report,
    });
  }

  /**
   * システム正常終了通知
   */
  async notifyNormalExit(): Promise<void> {
    await this.sendMessage({
      type: 'info',
      title: '✅ 正常終了',
      message:
        `デイトレードシステムを正常に終了しました\n` +
        `時刻: ${new Date().toLocaleString('ja-JP')}\n` +
        `日次レポートを確認してください`,
    });
  }

  /**
   * 接続テスト通知
   */
  async sendTestMessage(): Promise<void> {
    await this.sendMessage({
      type: 'info',
      title: '🔔 テスト通知',
      message:
        `LINE通知の接続テストです\n` +
        `時刻: ${new Date().toLocaleString('ja-JP')}\n` +
        `この通知が届けば設定は正常です`,
    });
  }

  // ========== Private Methods ==========

  /**
   * LINE APIにメッセージ送信
   */
  private async sendLineMessage(text: string): Promise<void> {
    const targetId = this.config.userId || this.config.groupId;

    const response = await axios.post(
      this.apiEndpoint,
      {
        to: targetId,
        messages: [
          {
            type: 'text',
            text: text,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.channelAccessToken}`,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`LINE API Error: ${response.status}`);
    }
  }

  /**
   * メッセージのフォーマット
   */
  private formatMessage(
    notification: NotificationMessage,
    emoji: string
  ): string {
    return `${emoji} ${notification.title}\n\n${notification.message}`;
  }

  /**
   * 通知タイプに応じた絵文字取得
   */
  private getEmoji(type: NotificationMessage['type']): string {
    const emojiMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };
    return emojiMap[type];
  }

  /**
   * 売却理由の判定
   */
  private getSellReason(position: any): string {
    if (position.reason) return position.reason;

    if (position.profitRate >= 0.05) return 'テイクプロフィット';
    if (position.profitRate <= -0.03) return 'ストップロス';
    return '強制決済';
  }

  /**
   * 想定利益の計算
   */
  private calculatePotentialProfit(position: any): any {
    const targetPrice = position.entryPrice * 1.05; // 5%想定
    const targetProfit = (targetPrice - position.entryPrice) * position.quantity;

    return {
      target: targetProfit,
      rate: 5,
    };
  }
}

