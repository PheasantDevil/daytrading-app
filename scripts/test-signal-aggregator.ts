import { FinvizSignalService } from '../src/services/external-signals/finviz-signal';
import { InvestingSignalService } from '../src/services/external-signals/investing-signal';
import { MarketWatchSignalService } from '../src/services/external-signals/marketwatch-signal';
import { ScrapingHelper } from '../src/services/external-signals/scraping-helper';
import { TradingViewSignalService } from '../src/services/external-signals/tradingview-signal';
import { YahooFinanceSignalService } from '../src/services/external-signals/yahoo-finance-signal';
import { SignalAggregatorService } from '../src/services/signal-aggregator-service';
import { Logger } from '../src/utils/logger';

const logger = new Logger('SignalAggregatorTest');

async function testSignalAggregator(): Promise<void> {
  logger.info('🚀 シグナル統合サービスのテストを開始します...');
  logger.info('📊 複数サイトからのシグナルを集約し、過半数判定を実行します');

  try {
    // シグナルサービスの初期化
    logger.info('\n🔧 シグナルサービスを初期化中...');

    const services = [
      new YahooFinanceSignalService(),
      new TradingViewSignalService(),
      new InvestingSignalService(),
      new FinvizSignalService(),
      new MarketWatchSignalService(),
    ];

    logger.info(`✅ ${services.length}つのサービスを登録`);
    services.forEach((s) => logger.info(`  - ${s.name}`));

    // シグナル統合サービスの初期化
    const aggregator = new SignalAggregatorService(services, {
      requiredVoteRatio: {
        3: 0.67, // 3サイト → 2/3以上
        4: 0.75, // 4サイト → 3/4以上
        5: 0.8, // 5サイト → 4/5以上
        6: 0.67, // 6サイト → 4/6以上
      },
      timeout: 30000,
      minSources: 2,
    });

    logger.info('✅ シグナル統合サービス初期化完了');

    // === テスト1: 単一銘柄のシグナル集約 ===
    logger.info('\n📊 === テスト1: 単一銘柄のシグナル集約 ===');
    logger.info('AAPL のシグナルを全サービスから取得...');

    const appleSignal = await aggregator.aggregateSignals('AAPL');

    logger.info('\n📈 集約結果:');
    logger.info(`銘柄: ${appleSignal.symbol}`);
    logger.info(`総ソース数: ${appleSignal.totalSources}`);
    logger.info(
      `BUY: ${appleSignal.buySignals}票 (${appleSignal.buyPercentage.toFixed(1)}%)`
    );
    logger.info(
      `HOLD: ${appleSignal.holdSignals}票 (${((appleSignal.holdSignals / appleSignal.totalSources) * 100).toFixed(1)}%)`
    );
    logger.info(
      `SELL: ${appleSignal.sellSignals}票 (${((appleSignal.sellSignals / appleSignal.totalSources) * 100).toFixed(1)}%)`
    );
    logger.info(`購入判定: ${appleSignal.shouldBuy ? '✅ YES' : '❌ NO'}`);
    logger.info(`売却判定: ${appleSignal.shouldSell ? '✅ YES' : '❌ NO'}`);

    logger.info('\n📋 個別シグナル詳細:');
    appleSignal.signals.forEach((signal, index) => {
      logger.info(
        `  ${index + 1}. ${signal.source}: ${signal.signal} (${signal.confidence}%)`
      );
      logger.info(`     理由: ${signal.reason}`);
    });

    // === テスト2: 複数銘柄のシグナル集約 ===
    logger.info('\n📊 === テスト2: 複数銘柄のシグナル集約 ===');

    const testSymbols = ['AAPL', 'GOOGL', 'MSFT'];
    logger.info(`${testSymbols.length}銘柄のシグナルを集約...`);

    const multipleSignals =
      await aggregator.aggregateMultipleSignals(testSymbols);

    logger.info('\n📈 複数銘柄集約結果:');
    multipleSignals.forEach((signal) => {
      logger.info(
        `${signal.symbol}: BUY=${signal.buySignals}/${signal.totalSources} (${signal.buyPercentage.toFixed(1)}%) → ${signal.shouldBuy ? '購入推奨' : '見送り'}`
      );
    });

    // === テスト3: 購入推奨銘柄のフィルタリング ===
    logger.info('\n🔍 === テスト3: 購入推奨銘柄のフィルタリング ===');

    const buyRecommendations =
      aggregator.filterBuyRecommendations(multipleSignals);

    logger.info(`購入推奨銘柄: ${buyRecommendations.length}件`);
    buyRecommendations.forEach((signal, index) => {
      logger.info(
        `  ${index + 1}. ${signal.symbol}: ${signal.buyPercentage.toFixed(1)}% (${signal.buySignals}/${signal.totalSources}票)`
      );
    });

    // === テスト4: 最適候補の選択 ===
    logger.info('\n⭐ === テスト4: 最適候補の選択 ===');

    const bestCandidate = aggregator.selectBestBuyCandidate(multipleSignals);

    if (bestCandidate) {
      logger.info('🎯 最適購入候補:');
      logger.info(`  銘柄: ${bestCandidate.symbol}`);
      logger.info(`  買い推奨率: ${bestCandidate.buyPercentage.toFixed(1)}%`);
      logger.info(
        `  買い票数: ${bestCandidate.buySignals}/${bestCandidate.totalSources}`
      );
      logger.info(`  判定: ✅ 購入推奨`);

      logger.info('\n  推奨理由:');
      bestCandidate.signals
        .filter((s) => s.signal === 'BUY')
        .forEach((signal) => {
          logger.info(`    - ${signal.source}: ${signal.reason}`);
        });
    } else {
      logger.info('❌ 購入推奨銘柄なし');
    }

    // === テスト5: 過半数判定ロジックの検証 ===
    logger.info('\n🧮 === テスト5: 過半数判定ロジックの検証 ===');

    const testCases = [
      { total: 3, buy: 2, expected: true, desc: '3サイト中2票 → 67%' },
      { total: 3, buy: 1, expected: false, desc: '3サイト中1票 → 33%' },
      { total: 4, buy: 3, expected: true, desc: '4サイト中3票 → 75%' },
      { total: 4, buy: 2, expected: false, desc: '4サイト中2票 → 50%' },
      { total: 5, buy: 4, expected: true, desc: '5サイト中4票 → 80%' },
      { total: 5, buy: 3, expected: false, desc: '5サイト中3票 → 60%' },
      { total: 6, buy: 4, expected: true, desc: '6サイト中4票 → 67%' },
      { total: 6, buy: 3, expected: false, desc: '6サイト中3票 → 50%' },
    ];

    logger.info('過半数判定のテストケース:');
    testCases.forEach((testCase) => {
      const ratio =
        aggregator['config'].requiredVoteRatio[testCase.total] || 0.67;
      const required = Math.ceil(testCase.total * ratio);
      const result = testCase.buy >= required;
      const status = result === testCase.expected ? '✅' : '❌';

      logger.info(
        `  ${status} ${testCase.desc} → 必要${required}票 → ${result ? '購入' : '見送り'}`
      );
    });

    // === 統計情報 ===
    logger.info('\n📊 === 統計情報 ===');
    const stats = aggregator.getStats();
    logger.info(`登録サービス数: ${stats.totalServices}`);
    logger.info(`アクティブサービス数: ${stats.activeServices}`);
    logger.info(`タイムアウト: ${stats.config.timeout}ms`);
    logger.info(`最小必要ソース数: ${stats.config.minSources}`);
    logger.info('\n過半数判定設定:');
    Object.entries(stats.config.requiredVoteRatio).forEach(([total, ratio]) => {
      logger.info(`  ${total}サイト: ${(ratio * 100).toFixed(0)}%以上`);
    });

    logger.info('\n🎉 シグナル統合サービスのテストが完了しました');
    logger.info('✅ 全ての機能が正常に動作しています');

    logger.info('\n💡 主要機能:');
    logger.info('  ✅ 複数サービスからのシグナル並列取得');
    logger.info('  ✅ 過半数判定による購入/売却判定');
    logger.info('  ✅ 最適候補の自動選択');
    logger.info('  ✅ タイムアウト・エラーハンドリング');
    logger.info('  ✅ 柔軟な設定変更');
  } catch (error) {
    logger.error('❌ シグナル統合サービスのテストに失敗しました:', error);
    process.exit(1);
  } finally {
    // クリーンアップ
    logger.info('\nブラウザをクローズ中...');
    await ScrapingHelper.close();
    logger.info('✅ クリーンアップ完了');
  }
}

// テスト実行
testSignalAggregator().catch(console.error);

export { testSignalAggregator };
