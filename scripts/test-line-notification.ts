import { config } from 'dotenv';
import { LineNotificationService } from '../src/services/line-notification-service';
import { Logger } from '../src/utils/logger';

// 環境変数の読み込み
config({ path: '.env.local' });

const logger = new Logger('LineNotificationTest');

async function testLineNotification(): Promise<void> {
  logger.info('🔔 LINE通知のテストを開始します...');

  try {
    const lineService = new LineNotificationService({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
      userId: process.env.LINE_USER_ID,
      groupId: process.env.LINE_GROUP_ID,
      enabled: true,
    });

    await lineService.initialize();
    logger.info('✅ 初期化完了');

    // テストメッセージ送信
    logger.info('\n📱 テストメッセージを送信中...');
    await lineService.sendTestMessage();
    logger.info('✅ テストメッセージ送信完了');

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 取引開始通知のテスト
    logger.info('\n📱 取引開始通知のテスト...');
    await lineService.notifyTradingStart({
      name: 'テスト設定',
      stopLoss: -0.03,
      takeProfit: 0.05,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 購入通知のテスト
    logger.info('\n📱 購入通知のテスト...');
    await lineService.notifyBuyExecuted({
      symbol: 'AAPL',
      quantity: 100,
      entryPrice: 150.25,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 売却通知のテスト（利益確定）
    logger.info('\n📱 売却通知のテスト（利益確定）...');
    await lineService.notifySellExecuted({
      symbol: 'AAPL',
      quantity: 100,
      currentPrice: 155.5,
      profitRate: 0.035,
      profitAmount: 525.0,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 売却通知のテスト（損切り）
    logger.info('\n📱 売却通知のテスト（損切り）...');
    await lineService.notifySellExecuted({
      symbol: 'GOOGL',
      quantity: 50,
      currentPrice: 145.0,
      profitRate: -0.025,
      profitAmount: -181.25,
      reason: 'ストップロス',
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 価格変動通知のテスト
    logger.info('\n📱 価格変動通知のテスト...');
    await lineService.notifyPriceUpdate({
      symbol: 'MSFT',
      entryPrice: 380.0,
      currentPrice: 388.5,
      profitRate: 0.0224,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 日次レポート通知のテスト
    logger.info('\n📱 日次レポート通知のテスト...');
    await lineService.notifyDailyReport({
      trades: 2,
      winRate: 50.0,
      totalProfit: 343.75,
      maxProfit: 525.0,
      maxLoss: -181.25,
      stopLossTriggers: 1,
      takeProfitTriggers: 1,
      forceCloseTriggers: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // エラー通知のテスト
    logger.info('\n📱 エラー通知のテスト...');
    await lineService.notifyError(
      new Error('これはテストエラーです'),
      'テストコンテキスト'
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 正常終了通知のテスト
    logger.info('\n📱 正常終了通知のテスト...');
    await lineService.notifyNormalExit();

    logger.info('\n🎉 全てのテストが完了しました');
    logger.info('📱 LINEアプリで通知を確認してください');
  } catch (error) {
    logger.error('❌ テスト失敗:', error);
    process.exit(1);
  }
}

testLineNotification();
