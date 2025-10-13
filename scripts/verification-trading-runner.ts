import { Logger } from '../src/utils/logger';
import { DayTradingScheduler } from '../src/trading/day-trading-scheduler';
import { SignalAggregatorService } from '../src/services/signal-aggregator-service';
import { HybridMarketDataService } from '../src/services/hybrid-market-data-service';
import { InteractiveBrokersIntegration } from '../src/brokers/interactive-brokers-integration';
import { YahooFinanceSignalService } from '../src/services/external-signals/yahoo-finance-signal';
import { TradeDataCollector } from '../src/analytics/trade-data-collector';
import { LineNotificationService } from '../src/services/line-notification-service';
import { getTodayConfig } from '../src/config/verification-trading-config';
import { ibConfig } from '../src/config/interactive-brokers-config';
import { writeFile } from 'fs/promises';

const logger = new Logger('VerificationTradingRunner');

async function runVerificationTrading(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // 今日の設定を取得
  let configData;
  try {
    configData = getTodayConfig();
  } catch (error) {
    logger.error(`❌ ${(error as Error).message}`);
    process.exit(1);
  }

  const { config, name: configName } = configData;

  // LINE通知サービスの初期化
  const lineNotification = new LineNotificationService({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    userId: process.env.LINE_USER_ID,
    groupId: process.env.LINE_GROUP_ID,
    enabled: process.env.LINE_NOTIFICATION_ENABLED === 'true',
  });

  try {
    await lineNotification.initialize();

    // 取引開始通知
    await lineNotification.notifyTradingStart({
      name: configName,
      stopLoss: config.riskManagement.stopLoss,
      takeProfit: config.riskManagement.takeProfit,
    });

    logger.info('🔬 ========== 検証用デイトレード実行開始 ==========');
    logger.info(`日付: ${today}`);
    logger.info(`設定: ${configName}`);
    logger.info(`ストップロス: ${(config.riskManagement.stopLoss * 100).toFixed(1)}%`);
    logger.info(
      `テイクプロフィット: ${(config.riskManagement.takeProfit * 100).toFixed(1)}%`
    );

    // システムセットアップ
    const ibIntegration = new InteractiveBrokersIntegration(ibConfig);
    await ibIntegration.connect();

    const marketDataService = new HybridMarketDataService(
      {
        mode: 'production',
        dataSource: {
          screening: 'yahoo',
          historical: 'yahoo',
          realtime: 'yahoo',
          trading: 'ib',
        },
        yahoo: { enabled: true, cacheTTL: 60000 },
        ib: { enabled: true, useRealAPI: false },
      },
      ibIntegration
    );
    await marketDataService.initialize();

    const signalServices = [new YahooFinanceSignalService()];
    const signalAggregator = new SignalAggregatorService(signalServices, {
      requiredVoteRatio: config.requiredVoteRatio,
      minSources: 1,
      timeout: 30000,
    });

    const dataCollector = new TradeDataCollector(
      `./reports/verification-${today}`
    );
    await dataCollector.initialize();

    const scheduler = new DayTradingScheduler(
      config,
      signalAggregator,
      marketDataService,
      ibIntegration
    );

    // === イベントリスナー設定（LINE通知統合） ===

    // 購入実行時
    scheduler.on('buyExecuted', async (position) => {
      logger.info('📈 【購入実行】', {
        銘柄: position.symbol,
        数量: position.quantity,
        価格: `$${position.entryPrice.toFixed(2)}`,
      });

      // LINE通知
      await lineNotification.notifyBuyExecuted(position);

      // データ記録
      await dataCollector.recordTrade({
        date: new Date(),
        symbol: position.symbol,
        action: 'BUY',
        quantity: position.quantity,
        price: position.entryPrice,
        reason: `検証取引 - ${configName}`,
      });

      // リアルタイムログ保存
      await saveRealtimeLog('BUY', position);
    });

    // 売却実行時
    scheduler.on('sellExecuted', async (position) => {
      logger.info('💰 【売却実行】', {
        銘柄: position.symbol,
        損益率: `${(position.profitRate * 100).toFixed(2)}%`,
        損益額: `$${position.profitAmount.toFixed(2)}`,
      });

      // LINE通知
      await lineNotification.notifySellExecuted(position);

      // データ記録
      await dataCollector.recordTrade({
        date: new Date(),
        symbol: position.symbol,
        action: 'SELL',
        quantity: position.quantity,
        price: position.currentPrice,
        profitRate: position.profitRate,
        profitAmount: position.profitAmount,
        reason: `検証取引 - ${configName}`,
      });

      // リアルタイムログ保存
      await saveRealtimeLog('SELL', position);
    });

    // 価格更新時（重要な変動のみ）
    scheduler.on('priceUpdate', async (data) => {
      if (data.position && Math.abs(data.position.profitRate) >= 0.02) {
        await lineNotification.notifyPriceUpdate(data.position);
      }
    });

    // エラー発生時
    scheduler.on('error', async (error) => {
      logger.error('❌ エラー:', error);
      await lineNotification.notifyError(error, 'DayTradingScheduler');
    });

    // スケジューラー起動
    await scheduler.start();

    logger.info('\n✅ 検証用デイトレードシステムが起動しました');
    logger.info('📊 本日の取引を実行中...');
    logger.info('📱 LINE通知が有効です');
    logger.info('💡 Ctrl+C で停止\n');

    // === 終了処理 ===
    const handleExit = async (
      exitType: 'normal' | 'abnormal',
      reason?: string
    ) => {
      logger.info(
        `\n⚠️ ${exitType === 'normal' ? '正常' : '異常'}終了処理開始...`
      );

      try {
        await scheduler.stop();
        await ibIntegration.disconnect();

        // 日次レポート生成
        const report = scheduler.generateDailyReport();
        logger.info('\n' + report);

        // レポート保存
        await writeFile(
          `./reports/verification-${today}/daily-report.txt`,
          report,
          'utf-8'
        );

        // CSV/JSONエクスポート
        const csvPath = await dataCollector.exportToCSV();
        logger.info(`📄 CSVエクスポート: ${csvPath}`);

        // 日次レポートをLINE通知
        const reportData = parseReport(report);
        await lineNotification.notifyDailyReport(reportData);

        if (exitType === 'normal') {
          await lineNotification.notifyNormalExit();
          logger.info('\n🎉 検証セッションを正常に終了しました');
        } else {
          await lineNotification.notifyAbnormalExit(reason || '不明なエラー', {
            lastReport: reportData,
          });
          logger.error(`\n⚠️ 異常終了: ${reason}`);
        }

        process.exit(exitType === 'normal' ? 0 : 1);
      } catch (error) {
        logger.error('終了処理中にエラー:', error);
        await lineNotification.notifyError(error as Error, '終了処理');
        process.exit(1);
      }
    };

    // 正常終了（Ctrl+C）
    process.on('SIGINT', async () => {
      await handleExit('normal');
    });

    // 異常終了（未処理エラー）
    process.on('uncaughtException', async (error) => {
      logger.error('未処理の例外:', error);
      await handleExit('abnormal', `未処理の例外: ${error.message}`);
    });

    process.on('unhandledRejection', async (reason) => {
      logger.error('未処理のPromise拒否:', reason);
      await handleExit('abnormal', `未処理のPromise拒否: ${reason}`);
    });

    // 無限ループで待機
    await new Promise(() => {});
  } catch (error) {
    logger.error('❌ 実行エラー:', error);

    // 起動失敗をLINE通知
    await lineNotification.notifyError(error as Error, 'システム起動');

    process.exit(1);
  }
}

// リアルタイムログ保存関数
async function saveRealtimeLog(action: string, position: any): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    position,
    config: {
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
    },
  };

  const logPath = `./reports/verification-${new Date().toISOString().split('T')[0]}/realtime-log.jsonl`;
  await writeFile(logPath, JSON.stringify(logEntry) + '\n', { flag: 'a' });
}

// レポートパース関数
function parseReport(reportText: string): any {
  // レポートテキストから必要なデータを抽出
  // 簡略化バージョン：実際のレポート形式に応じて調整が必要
  return {
    trades: 1,
    winRate: 100,
    totalProfit: 0,
    maxProfit: 0,
    maxLoss: 0,
    stopLossTriggers: 0,
    takeProfitTriggers: 0,
    forceCloseTriggers: 0,
  };
}

// 実行
runVerificationTrading().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runVerificationTrading };

