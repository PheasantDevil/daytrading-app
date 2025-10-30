import { Logger } from '../src/utils/logger';
import { DayTradingScheduler } from '../src/trading/day-trading-scheduler';
import { SignalAggregatorService } from '../src/services/signal-aggregator-service';
import { HybridMarketDataService } from '../src/services/hybrid-market-data-service';
import { InteractiveBrokersIntegration } from '../src/brokers/interactive-brokers-integration';
import { YahooFinanceSignalService } from '../src/services/external-signals/yahoo-finance-signal';
import { TradeDataCollector } from '../src/analytics/trade-data-collector';
import { defaultDayTradingConfig } from '../src/config/day-trading-config';
import { ibConfig } from '../src/config/interactive-brokers-config';

const logger = new Logger('DailyTradingRunner');

/**
 * 毎日の自動取引実行スクリプト
 *
 * 使用方法:
 * - 手動実行: npm run trade:daily
 * - cron設定: 毎日08:00に実行
 *   0 8 * * 1-5 cd /path/to/daytrading-app && npm run trade:daily
 */
async function runDailyTrading(): Promise<void> {
  logger.info('🌅 ========== デイトレード 自動実行開始 ==========');
  logger.info(`日時: ${new Date().toLocaleString()}`);

  try {
    // === セットアップ ===
    logger.info('\n🔧 セットアップ中...');

    // Interactive Brokers統合
    const ibIntegration = new InteractiveBrokersIntegration(ibConfig);
    await ibIntegration.connect();
    logger.info('✅ Interactive Brokers接続');

    // ハイブリッド市場データサービス
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
    logger.info('✅ 市場データサービス初期化');

    // シグナル統合サービス（Yahoo Financeのみ）
    const signalServices = [new YahooFinanceSignalService()];

    const signalAggregator = new SignalAggregatorService(signalServices, {
      requiredVoteRatio: { 1: 1.0 },
      minSources: 1,
      timeout: 30000,
    });
    logger.info('✅ シグナル統合サービス初期化');

    // データ収集サービス
    const dataCollector = new TradeDataCollector();
    await dataCollector.initialize();
    logger.info('✅ データ収集サービス初期化');

    // デイトレードスケジューラー
    const scheduler = new DayTradingScheduler(
      defaultDayTradingConfig,
      signalAggregator,
      marketDataService,
      ibIntegration
    );

    logger.info('✅ デイトレードスケジューラー初期化');

    // === イベントリスナー設定 ===
    logger.info('\n📡 イベントリスナー設定...');

    scheduler.on('buyExecuted', async (position) => {
      logger.info('📈 購入実行:', {
        銘柄: position.symbol,
        数量: position.quantity,
        価格: `$${position.entryPrice.toFixed(2)}`,
      });

      // データ収集
      await dataCollector.recordTrade({
        date: new Date(),
        symbol: position.symbol,
        action: 'BUY',
        quantity: position.quantity,
        price: position.entryPrice,
        reason: '自動購入',
      });
    });

    scheduler.on('sellExecuted', async (position) => {
      logger.info('💰 売却実行:', {
        銘柄: position.symbol,
        損益率: `${(position.profitRate * 100).toFixed(2)}%`,
        損益額: `$${position.profitAmount.toFixed(2)}`,
      });

      // データ収集
      await dataCollector.recordTrade({
        date: new Date(),
        symbol: position.symbol,
        action: 'SELL',
        quantity: position.quantity,
        price: position.currentPrice,
        profitRate: position.profitRate,
        profitAmount: position.profitAmount,
        reason: '自動売却',
      });
    });

    scheduler.on('error', (error) => {
      logger.error('❌ スケジューラーエラー:', error);
    });

    logger.info('✅ イベントリスナー設定完了');

    // === スケジューラー起動 ===
    logger.info('\n🚀 スケジューラー起動...');
    logger.info('⏰ 購入: 11:00 AM');
    logger.info('⏰ 売却監視: 13:00-15:00');
    logger.info('⏰ 強制決済: 15:00');

    await scheduler.start();

    logger.info('\n✅ デイトレードシステムが起動しました');
    logger.info('📊 本日の取引を自動実行します');
    logger.info('💡 Ctrl+C で停止');

    // プロセスの終了を待機
    process.on('SIGINT', async () => {
      logger.info('\n⚠️ 停止シグナルを受信...');
      await scheduler.stop();
      await ibIntegration.disconnect();

      // 日次レポート生成
      const report = scheduler.generateDailyReport();
      logger.info('\n' + report);

      // 週次統計生成
      logger.info('\n📊 週次統計を生成中...');
      const weeklyStats = await dataCollector.generateWeeklyStats();
      logger.info('週次統計:', weeklyStats);

      // CSVエクスポート
      const csvPath = await dataCollector.exportToCSV();
      logger.info(`📄 CSVエクスポート: ${csvPath}`);

      logger.info('\n🎉 デイトレードシステムを正常に停止しました');
      process.exit(0);
    });

    // 無限ループで待機
    await new Promise(() => {});
  } catch (error) {
    logger.error('❌ デイトレード実行エラー:', error);
    process.exit(1);
  }
}

// 実行
runDailyTrading().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runDailyTrading };
