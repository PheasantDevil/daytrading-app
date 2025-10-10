import { Logger } from '../src/utils/logger';
import { YahooFinanceService } from '../src/services/yahoo-finance-service';
import { HybridMarketDataService } from '../src/services/hybrid-market-data-service';
import { InteractiveBrokersIntegration } from '../src/brokers/interactive-brokers-integration';
import { ibConfig } from '../src/config/interactive-brokers-config';

const logger = new Logger('HybridMarketDataTest');

async function testHybridMarketDataSystem(): Promise<void> {
  logger.info('🚀 ハイブリッド市場データシステムのテストを開始します...');
  logger.info('📊 Yahoo Finance（無料） + Interactive Brokers（取引用）のハイブリッドシステム');

  try {
    // Interactive Brokers統合の初期化
    const ibIntegration = new InteractiveBrokersIntegration(ibConfig);
    await ibIntegration.connect();
    logger.info('✅ Interactive Brokers接続完了');

    // ハイブリッド市場データサービスの初期化
    const hybridService = new HybridMarketDataService(
      {
        mode: 'development',
        dataSource: {
          screening: 'yahoo', // スクリーニングはYahoo
          historical: 'yahoo', // 履歴データはYahoo
          realtime: 'yahoo', // リアルタイムもYahoo（開発中）
          trading: 'ib', // 取引はIB
        },
        yahoo: {
          enabled: true,
          cacheTTL: 60000, // 1分
        },
        ib: {
          enabled: true,
          useRealAPI: false, // モックAPI使用
        },
      },
      ibIntegration
    );

    await hybridService.initialize();
    logger.info('✅ ハイブリッドサービス初期化完了');

    // === Yahoo Finance機能のテスト ===
    logger.info('\n📊 === Yahoo Finance機能のテスト ===');

    // 1. リアルタイム株価取得
    logger.info('\n1. リアルタイム株価取得（Yahoo Finance）');
    const appleQuote = await hybridService.getMarketData('AAPL');
    logger.info(`AAPL (Apple):`, {
      価格: `$${appleQuote.price.toFixed(2)}`,
      変動: `${appleQuote.changePercent > 0 ? '+' : ''}${appleQuote.changePercent.toFixed(2)}%`,
      出来高: appleQuote.volume.toLocaleString(),
      データソース: appleQuote.source,
    });

    // 2. 複数銘柄の取得
    logger.info('\n2. 複数銘柄の株価取得（Yahoo Finance）');
    const multipleQuotes = await hybridService.getMultipleMarketData([
      'AAPL',
      'GOOGL',
      'MSFT',
      'TSLA',
    ]);
    logger.info(`${multipleQuotes.length}銘柄の株価を取得:`);
    multipleQuotes.forEach((quote) => {
      logger.info(
        `  ${quote.symbol}: $${quote.price.toFixed(2)} (${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`
      );
    });

    // 3. 履歴データの取得
    logger.info('\n3. 履歴データの取得（Yahoo Finance）');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // 過去30日
    const historicalData = await hybridService.getHistoricalData('AAPL', startDate);
    logger.info(`AAPL の過去30日分のデータ: ${historicalData.length}件`);
    logger.info(`最新データ:`, {
      日付: historicalData[historicalData.length - 1].date.toLocaleDateString(),
      終値: `$${historicalData[historicalData.length - 1].close.toFixed(2)}`,
      出来高: historicalData[historicalData.length - 1].volume.toLocaleString(),
    });

    // 4. 銘柄検索
    logger.info('\n4. 銘柄検索（Yahoo Finance）');
    const searchResults = await hybridService.searchSymbols('Apple');
    logger.info(`"Apple"の検索結果: ${searchResults.length}件`);
    searchResults.slice(0, 3).forEach((result) => {
      logger.info(`  ${result.symbol}: ${result.name} (${result.exchange})`);
    });

    // 5. トレンド銘柄の取得
    logger.info('\n5. トレンド銘柄の取得（Yahoo Finance）');
    const trendingStocks = await hybridService.getTrendingStocks();
    logger.info(`トレンド銘柄: ${trendingStocks.slice(0, 5).join(', ')}`);

    // 6. 企業情報の取得
    logger.info('\n6. 企業情報の取得（Yahoo Finance）');
    const companyInfo = await hybridService.getCompanyInfo('AAPL');
    logger.info(`企業情報:`, {
      名前: companyInfo.name,
      セクター: companyInfo.sector,
      業種: companyInfo.industry,
      従業員数: companyInfo.employees.toLocaleString(),
    });

    // 7. 銘柄スクリーニング
    logger.info('\n7. 銘柄スクリーニング（Yahoo Finance）');
    const screenedStocks = await hybridService.screenStocks({
      minPrice: 100,
      maxPrice: 500,
      minVolume: 1000000,
      symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA'],
    });
    logger.info(`スクリーニング結果: ${screenedStocks.join(', ')}`);

    // === Interactive Brokers機能のテスト ===
    logger.info('\n🔷 === Interactive Brokers機能のテスト ===');

    // 8. データソースをIBに切り替え
    logger.info('\n8. データソースをIBに切り替え');
    hybridService.switchDataSource('ib', 'realtime');
    const ibQuote = await hybridService.getMarketData('AAPL');
    logger.info(`AAPL (IB):`, {
      価格: `$${ibQuote.price.toFixed(2)}`,
      買気配: `$${ibQuote.bid.toFixed(2)}`,
      売気配: `$${ibQuote.ask.toFixed(2)}`,
      データソース: ibQuote.source,
    });

    // 9. アカウント情報の取得
    logger.info('\n9. アカウント情報の取得（Interactive Brokers）');
    const account = await ibIntegration.getAccount();
    logger.info(`アカウント情報:`, {
      口座番号: account.accountId,
      残高: `$${account.balance.toLocaleString()}`,
      証拠金可能額: `$${account.marginAvailable.toLocaleString()}`,
      ポジション数: account.positions.length,
    });

    // === ハイブリッドワークフローのデモ ===
    logger.info('\n🌟 === ハイブリッドワークフローのデモ ===');

    logger.info('\nシナリオ: Yahoo Financeで銘柄を探索 → IBで取引');

    // Step 1: Yahoo Financeで候補銘柄をスクリーニング
    logger.info('\nStep 1: Yahoo Financeで銘柄スクリーニング');
    const candidates = await hybridService.screenStocks({
      minPrice: 50,
      maxPrice: 200,
      minVolume: 5000000,
      symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA'],
    });
    logger.info(`候補銘柄: ${candidates.join(', ')}`);

    // Step 2: 各候補の詳細情報を取得
    logger.info('\nStep 2: 候補銘柄の詳細分析（Yahoo Finance）');
    for (const symbol of candidates.slice(0, 3)) {
      const quote = await hybridService.getMarketData(symbol);
      logger.info(`${symbol}: $${quote.price.toFixed(2)} (${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`);
    }

    // Step 3: IBで取引実行（シミュレーション）
    logger.info('\nStep 3: Interactive Brokersで取引実行');
    if (candidates.length > 0) {
      const targetSymbol = candidates[0];
      logger.info(`${targetSymbol}を購入`);

      const order = await ibIntegration.placeOrder({
        symbol: targetSymbol,
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      logger.info(`✅ 注文執行:`, {
        銘柄: order.symbol,
        数量: order.quantity,
        価格: `$${order.price.toFixed(2)}`,
        ステータス: order.status,
      });
    }

    // 統計情報
    logger.info('\n📈 統計情報:');
    try {
      const stats = hybridService.getStats();
      logger.info(`キャッシュサイズ: ${stats.cacheSize}件`);
      logger.info(`Yahoo Finance: ${stats.yahooEnabled ? '有効' : '無効'}`);
      logger.info(`Interactive Brokers: ${stats.ibEnabled ? '有効' : '無効'}`);
      logger.info(`モード: ${stats.mode}`);
    } catch (error) {
      logger.warn('統計情報の取得でエラー:', error);
    }

    // クリーンアップ
    try {
      await ibIntegration.disconnect();
    } catch (error) {
      logger.warn('切断処理でエラー:', error);
    }

    logger.info('\n🎉 ハイブリッド市場データシステムのテストが完了しました');
    logger.info('✅ 全ての機能が正常に動作しています');
    logger.info('\n💡 ハイブリッドシステムの利点:');
    logger.info('  - Yahoo Finance: 無料で銘柄探索・分析');
    logger.info('  - Interactive Brokers: 正確な取引執行');
    logger.info('  - コスト最小、精度最大の最適な組み合わせ');
  } catch (error) {
    logger.error('❌ ハイブリッド市場データシステムのテストに失敗しました:', error);
    process.exit(1);
  }
}

// テスト実行
testHybridMarketDataSystem().catch(console.error);

export { testHybridMarketDataSystem };

