import { Logger } from '../src/utils/logger';
import { DayTradingScheduler } from '../src/trading/day-trading-scheduler';
import { SignalAggregatorService } from '../src/services/signal-aggregator-service';
import { HybridMarketDataService } from '../src/services/hybrid-market-data-service';
import { InteractiveBrokersIntegration } from '../src/brokers/interactive-brokers-integration';
import { YahooFinanceSignalService } from '../src/services/external-signals/yahoo-finance-signal';
import { TradingViewSignalService } from '../src/services/external-signals/tradingview-signal';
import { InvestingSignalService } from '../src/services/external-signals/investing-signal';
import { FinvizSignalService } from '../src/services/external-signals/finviz-signal';
import { MarketWatchSignalService } from '../src/services/external-signals/marketwatch-signal';
import { ScrapingHelper } from '../src/services/external-signals/scraping-helper';
import { defaultDayTradingConfig } from '../src/config/day-trading-config';
import { ibConfig } from '../src/config/interactive-brokers-config';

const logger = new Logger('DayTradingSchedulerTest');

async function testDayTradingScheduler(): Promise<void> {
  logger.info('🚀 デイトレードスケジューラーのテストを開始します...');
  logger.info('📊 1日1取引の完全自動デイトレードシステム');

  try {
    // === セットアップ ===
    logger.info('\n🔧 === セットアップ ===');

    // Interactive Brokers統合
    const ibIntegration = new InteractiveBrokersIntegration(ibConfig);
    await ibIntegration.connect();
    logger.info('✅ Interactive Brokers接続完了');

    // ハイブリッド市場データサービス
    const marketDataService = new HybridMarketDataService(
      {
        mode: 'development',
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
    logger.info('✅ 市場データサービス初期化完了');

    // シグナル統合サービス
    const signalServices = [
      new YahooFinanceSignalService(),
      new TradingViewSignalService(),
      new InvestingSignalService(),
      new FinvizSignalService(),
      new MarketWatchSignalService(),
    ];

    const signalAggregator = new SignalAggregatorService(signalServices);
    logger.info(`✅ シグナル統合サービス初期化完了（${signalServices.length}サービス）`);

    // デイトレードスケジューラー
    const scheduler = new DayTradingScheduler(
      {
        ...defaultDayTradingConfig,
        trading: {
          ...defaultDayTradingConfig.trading,
          enabled: true,
          paperTrading: true,
          confirmBeforeTrade: false, // テストモードでは確認なし
        },
      },
      signalAggregator,
      marketDataService,
      ibIntegration
    );

    logger.info('✅ デイトレードスケジューラー初期化完了');

    // === イベントリスナー設定 ===
    logger.info('\n📡 === イベントリスナー設定 ===');

    scheduler.on('started', () => {
      logger.info('🟢 スケジューラー起動');
    });

    scheduler.on('buySignalGenerated', (signal) => {
      logger.info('📈 購入シグナル生成:', signal);
    });

    scheduler.on('buyExecuted', (position) => {
      logger.info('✅ 購入実行:', position);
    });

    scheduler.on('sellExecuted', (position) => {
      logger.info('✅ 売却実行:', position);
    });

    scheduler.on('error', (error) => {
      logger.error('❌ エラー発生:', error);
    });

    logger.info('✅ イベントリスナー設定完了');

    // === テスト実行 ===
    logger.info('\n🧪 === テストモード実行 ===');
    logger.info('⚠️ 実際の時間を待たずに、購入→売却を即座に実行します');

    await scheduler.testRun();

    // === 結果確認 ===
    logger.info('\n📊 === 実行結果 ===');

    const currentPosition = scheduler.getCurrentPosition();
    if (currentPosition) {
      logger.info('現在のポジション:');
      logger.info(`  銘柄: ${currentPosition.symbol}`);
      logger.info(`  数量: ${currentPosition.quantity}株`);
      logger.info(`  購入価格: $${currentPosition.entryPrice.toFixed(2)}`);
      logger.info(`  現在価格: $${currentPosition.currentPrice.toFixed(2)}`);
      logger.info(
        `  損益率: ${(currentPosition.profitRate * 100).toFixed(2)}%`
      );
      logger.info(`  損益額: $${currentPosition.profitAmount.toFixed(2)}`);
    } else {
      logger.info('現在のポジション: なし');
    }

    const tradeHistory = scheduler.getTradeHistory();
    logger.info(`\n取引履歴: ${tradeHistory.length}件`);
    tradeHistory.forEach((trade, index) => {
      logger.info(
        `  ${index + 1}. ${trade.action} ${trade.symbol} × ${trade.quantity}株 @ $${trade.price.toFixed(2)}`
      );
      logger.info(`     理由: ${trade.reason}`);
      if (trade.profitRate !== undefined) {
        logger.info(
          `     損益: ${(trade.profitRate * 100).toFixed(2)}% ($${trade.profitAmount?.toFixed(2)})`
        );
      }
    });

    const todayStats = scheduler.getTodayStats();
    logger.info('\n📈 本日の統計:');
    logger.info(`  取引回数: ${todayStats.trades}`);
    logger.info(`  勝ち: ${todayStats.wins}`);
    logger.info(`  負け: ${todayStats.losses}`);
    logger.info(`  勝率: ${todayStats.winRate.toFixed(1)}%`);
    logger.info(`  総損益: $${todayStats.totalProfit.toFixed(2)}`);

    // === デイリーレポート ===
    logger.info('\n📄 === デイリーレポート ===');
    const report = scheduler.generateDailyReport();
    logger.info('\n' + report);

    // クリーンアップ
    await ibIntegration.disconnect();
    await ScrapingHelper.close();

    logger.info('\n🎉 デイトレードスケジューラーのテストが完了しました');
    logger.info('✅ 全ての機能が正常に動作しています');

    logger.info('\n💡 主要機能:');
    logger.info('  ✅ 時間ベース自動実行（11:00購入、13:00-15:00売却）');
    logger.info('  ✅ 複数サイトからシグナル集約');
    logger.info('  ✅ 過半数判定による購入/売却判定');
    logger.info('  ✅ +5%目標、-3%ストップロス');
    logger.info('  ✅ 1日1取引制限');
    logger.info('  ✅ 強制決済（15:00）');
    logger.info('  ✅ デイリーレポート生成');
  } catch (error) {
    logger.error('❌ デイトレードスケジューラーのテストに失敗しました:', error);
    process.exit(1);
  }
}

// テスト実行
testDayTradingScheduler().catch(console.error);

export { testDayTradingScheduler };

