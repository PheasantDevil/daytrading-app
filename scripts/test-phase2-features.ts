/**
 * Phase2機能テストスクリプト
 * 複数データソース統合、取引機能実装、デモトレードシステム高度化をテスト
 */

import { DataIntegrationService } from '../src/services/data-integration-service';
import { OandaIntegrationService } from '../src/services/oanda-integration';
import { WebullIntegrationService } from '../src/services/webull-integration';
import { TradingIntegrationService } from '../src/services/trading-integration-service';
import { AdvancedDemoTradingService } from '../src/services/advanced-demo-trading';

async function testDataIntegrationService(): Promise<void> {
  console.log('\n🧪 データ統合サービステスト開始...');
  
  try {
    const dataService = new DataIntegrationService({
      cacheEnabled: true,
      cacheExpiry: 300000, // 5分
      fallbackEnabled: true,
      maxRetries: 3,
      retryDelay: 1000,
    });

    // 日本株データ取得テスト
    const jpStockData = await dataService.getStockData('7203', 'JP');
    if (jpStockData) {
      console.log(`✅ 日本株データ取得: ${jpStockData.symbol} - ${jpStockData.price}円 (${jpStockData.source})`);
    } else {
      console.log('⚠️ 日本株データ取得失敗');
    }

    // 米国株データ取得テスト
    const usStockData = await dataService.getStockData('AAPL', 'US');
    if (usStockData) {
      console.log(`✅ 米国株データ取得: ${usStockData.symbol} - $${usStockData.price} (${usStockData.source})`);
    } else {
      console.log('⚠️ 米国株データ取得失敗');
    }

    // 履歴データ取得テスト
    const historicalData = await dataService.getHistoricalData('AAPL', 'US', 30);
    if (historicalData) {
      console.log(`✅ 履歴データ取得: ${historicalData.data.length}日分 (${historicalData.source})`);
    } else {
      console.log('⚠️ 履歴データ取得失敗');
    }

    // 複数銘柄データ取得テスト
    const multipleData = await dataService.getMultipleStockData(['AAPL', 'GOOGL', 'MSFT'], 'US');
    console.log(`✅ 複数銘柄データ取得: ${multipleData.size}銘柄`);

    // API可用性チェック
    const availability = await dataService.checkApiAvailability();
    console.log('✅ API可用性:', Object.fromEntries(availability));

    console.log('✅ データ統合サービステスト完了');
  } catch (error) {
    console.error('❌ データ統合サービステストエラー:', error);
  }
}

async function testOandaIntegration(): Promise<void> {
  console.log('\n🧪 OANDA統合テスト開始...');
  
  try {
    const oandaService = new OandaIntegrationService({
      apiKey: process.env.OANDA_API_KEY || 'test-key',
      accountId: process.env.OANDA_ACCOUNT_ID || 'test-account',
      environment: 'sandbox',
      baseUrl: 'https://api-fxpractice.oanda.com',
    });

    // 接続テスト
    const connected = await oandaService.testConnection();
    console.log(`✅ OANDA接続: ${connected ? '成功' : '失敗'}`);

    if (connected) {
      // 口座情報取得テスト
      const account = await oandaService.getAccount();
      if (account) {
        console.log(`✅ 口座情報取得: 残高 ${account.balance} ${account.currency}`);
      }

      // ポジション情報取得テスト
      const positions = await oandaService.getPositions();
      console.log(`✅ ポジション情報取得: ${positions.length}ポジション`);

      // 現在価格取得テスト
      const price = await oandaService.getCurrentPrice('EUR_USD');
      if (price) {
        console.log(`✅ 現在価格取得: ${price.instrument} - Bid: ${price.bid}, Ask: ${price.ask}`);
      }

      // 履歴データ取得テスト
      const candles = await oandaService.getHistoricalData('EUR_USD', 'H1', 10);
      console.log(`✅ 履歴データ取得: ${candles.length}本のローソク足`);
    }

    console.log('✅ OANDA統合テスト完了');
  } catch (error) {
    console.error('❌ OANDA統合テストエラー:', error);
  }
}

async function testWebullIntegration(): Promise<void> {
  console.log('\n🧪 ウィブル統合テスト開始...');
  
  try {
    const webullService = new WebullIntegrationService({
      apiKey: process.env.WEBULL_API_KEY || 'test-key',
      secretKey: process.env.WEBULL_SECRET_KEY || 'test-secret',
      baseUrl: 'https://api.webull.com',
      environment: 'sandbox',
    });

    // 認証テスト
    const authenticated = await webullService.authenticate();
    console.log(`✅ ウィブル認証: ${authenticated ? '成功' : '失敗'}`);

    if (authenticated) {
      // 接続テスト
      const connected = await webullService.testConnection();
      console.log(`✅ ウィブル接続: ${connected ? '成功' : '失敗'}`);

      if (connected) {
        // 口座情報取得テスト
        const account = await webullService.getAccount();
        if (account) {
          console.log(`✅ 口座情報取得: 総資産 $${account.totalValue}`);
        }

        // ポジション情報取得テスト
        const positions = await webullService.getPositions();
        console.log(`✅ ポジション情報取得: ${positions.length}ポジション`);

        // 現在価格取得テスト
        const quote = await webullService.getCurrentPrice('AAPL');
        if (quote) {
          console.log(`✅ 現在価格取得: ${quote.symbol} - $${quote.price}`);
        }

        // 履歴データ取得テスト
        const candles = await webullService.getHistoricalData('AAPL', '1d', 10);
        console.log(`✅ 履歴データ取得: ${candles.length}本のローソク足`);
      }
    }

    console.log('✅ ウィブル統合テスト完了');
  } catch (error) {
    console.error('❌ ウィブル統合テストエラー:', error);
  }
}

async function testTradingIntegration(): Promise<void> {
  console.log('\n🧪 取引統合テスト開始...');
  
  try {
    const tradingService = new TradingIntegrationService({
      oanda: {
        apiKey: process.env.OANDA_API_KEY || 'test-key',
        accountId: process.env.OANDA_ACCOUNT_ID || 'test-account',
        environment: 'sandbox',
        baseUrl: 'https://api-fxpractice.oanda.com',
      },
      webull: {
        apiKey: process.env.WEBULL_API_KEY || 'test-key',
        secretKey: process.env.WEBULL_SECRET_KEY || 'test-secret',
        baseUrl: 'https://api.webull.com',
        environment: 'sandbox',
      },
      autoReconnect: true,
      reconnectInterval: 30000,
      maxRetries: 3,
    });

    // 初期化テスト
    const initialized = await tradingService.initialize();
    console.log(`✅ 取引統合初期化: ${initialized ? '成功' : '失敗'}`);

    if (initialized) {
      // 接続状態チェック
      const status = await tradingService.checkConnectionStatus();
      console.log(`✅ 接続状態: OANDA=${status.oanda}, ウィブル=${status.webull}, 全体=${status.overall}`);

      // 全ポジション取得テスト
      const positions = await tradingService.getAllPositions();
      console.log(`✅ 全ポジション取得: ${positions.length}ポジション`);

      // 全注文履歴取得テスト
      const orders = await tradingService.getAllOrders();
      console.log(`✅ 全注文履歴取得: ${orders.length}注文`);

      // 現在価格取得テスト
      const fxPrice = await tradingService.getCurrentPrice('EUR_USD', 'FX');
      if (fxPrice) {
        console.log(`✅ FX価格取得: ${fxPrice.symbol} - ${fxPrice.price}`);
      }

      const usPrice = await tradingService.getCurrentPrice('AAPL', 'US');
      if (usPrice) {
        console.log(`✅ 米国株価格取得: ${usPrice.symbol} - $${usPrice.price}`);
      }

      // 複数価格取得テスト
      const multiplePrices = await tradingService.getMultiplePrices([
        { symbol: 'EUR_USD', market: 'FX' },
        { symbol: 'AAPL', market: 'US' },
        { symbol: 'GOOGL', market: 'US' },
      ]);
      console.log(`✅ 複数価格取得: ${multiplePrices.size}銘柄`);
    }

    console.log('✅ 取引統合テスト完了');
  } catch (error) {
    console.error('❌ 取引統合テストエラー:', error);
  }
}

async function testAdvancedDemoTrading(): Promise<void> {
  console.log('\n🧪 高度化デモトレードテスト開始...');
  
  try {
    // モックサービスを作成
    const mockTradingService = {
      testConnection: async () => true,
      getCurrentPrice: async (symbol: string, market: string) => ({
        symbol,
        market,
        price: 100,
        change: 1,
        changePercent: 1,
        volume: 1000,
        high: 105,
        low: 95,
        open: 99,
        close: 101,
        timestamp: new Date(),
        broker: 'MOCK',
      }),
      getAllPositions: async () => [],
      getAllOrders: async () => [],
    } as any;

    const mockDataService = {
      getStockData: async (symbol: string, market: string) => ({
        symbol,
        market,
        price: 100,
        change: 1,
        changePercent: 1,
        volume: 1000,
        timestamp: new Date(),
        source: 'MOCK',
      }),
    } as any;

    const demoService = new AdvancedDemoTradingService(
      {
        initialCapital: 1000000,
        markets: [
          { name: 'FX', type: 'FX', enabled: true, allocation: 30 },
          { name: 'US', type: 'US', enabled: true, allocation: 50 },
          { name: 'JP', type: 'JP', enabled: true, allocation: 20 },
        ],
        riskManagement: {
          maxPositionSize: 100000,
          maxPortfolioRisk: 10,
          stopLossPercent: 5,
          takeProfitPercent: 10,
          maxDailyLoss: 50000,
          maxDrawdown: 20,
        },
        simulation: {
          slippage: 0.001,
          commissionRate: 0.001,
          realisticExecution: true,
          liquidityConsideration: true,
        },
      },
      mockTradingService,
      mockDataService
    );

    // デモトレード開始テスト
    await demoService.startDemoTrading();
    console.log('✅ デモトレード開始');

    // 口座情報取得テスト
    const account = demoService.getAccount();
    console.log(`✅ 口座情報取得: 総資産 ${account.totalValue.toLocaleString()}円`);

    // 注文発注テスト
    const order = await demoService.placeOrder({
      symbol: 'AAPL',
      market: 'US',
      side: 'BUY',
      quantity: 10,
      type: 'MARKET',
    });

    if (order) {
      console.log(`✅ 注文発注: ${order.symbol} ${order.side} ${order.quantity}株`);
    } else {
      console.log('⚠️ 注文発注失敗');
    }

    // ポジション取得テスト
    const positions = demoService.getPositions();
    console.log(`✅ ポジション取得: ${positions.length}ポジション`);

    // 注文履歴取得テスト
    const orders = demoService.getOrders();
    console.log(`✅ 注文履歴取得: ${orders.length}注文`);

    // デモトレード停止テスト
    demoService.stopDemoTrading();
    console.log('✅ デモトレード停止');

    console.log('✅ 高度化デモトレードテスト完了');
  } catch (error) {
    console.error('❌ 高度化デモトレードテストエラー:', error);
  }
}

async function testIntegrationWorkflow(): Promise<void> {
  console.log('\n🧪 統合ワークフローテスト開始...');
  
  try {
    // データ統合サービス
    const dataService = new DataIntegrationService({
      cacheEnabled: true,
      cacheExpiry: 300000,
      fallbackEnabled: true,
      maxRetries: 3,
      retryDelay: 1000,
    });

    // 取引統合サービス（モック）
    const mockTradingService = {
      testConnection: async () => true,
      getCurrentPrice: async (symbol: string, market: string) => ({
        symbol,
        market,
        price: 100,
        change: 1,
        changePercent: 1,
        volume: 1000,
        high: 105,
        low: 95,
        open: 99,
        close: 101,
        timestamp: new Date(),
        broker: 'MOCK',
      }),
      getAllPositions: async () => [],
      getAllOrders: async () => [],
    } as any;

    // 高度化デモトレードサービス
    const demoService = new AdvancedDemoTradingService(
      {
        initialCapital: 1000000,
        markets: [
          { name: 'FX', type: 'FX', enabled: true, allocation: 30 },
          { name: 'US', type: 'US', enabled: true, allocation: 50 },
          { name: 'JP', type: 'JP', enabled: true, allocation: 20 },
        ],
        riskManagement: {
          maxPositionSize: 100000,
          maxPortfolioRisk: 10,
          stopLossPercent: 5,
          takeProfitPercent: 10,
          maxDailyLoss: 50000,
          maxDrawdown: 20,
        },
        simulation: {
          slippage: 0.001,
          commissionRate: 0.001,
          realisticExecution: true,
          liquidityConsideration: true,
        },
      },
      mockTradingService,
      dataService
    );

    // 統合ワークフロー実行
    console.log('🔄 統合ワークフロー実行中...');

    // 1. データ取得
    const jpData = await dataService.getStockData('7203', 'JP');
    const usData = await dataService.getStockData('AAPL', 'US');
    console.log(`✅ データ取得: 日本株=${jpData ? '成功' : '失敗'}, 米国株=${usData ? '成功' : '失敗'}`);

    // 2. デモトレード開始
    await demoService.startDemoTrading();
    console.log('✅ デモトレード開始');

    // 3. 複数市場での取引
    const orders = await Promise.allSettled([
      demoService.placeOrder({ symbol: 'AAPL', market: 'US', side: 'BUY', quantity: 10, type: 'MARKET' }),
      demoService.placeOrder({ symbol: 'EUR_USD', market: 'FX', side: 'BUY', quantity: 1000, type: 'MARKET' }),
      demoService.placeOrder({ symbol: '7203', market: 'JP', side: 'BUY', quantity: 100, type: 'MARKET' }),
    ]);

    const successfulOrders = orders.filter(result => result.status === 'fulfilled' && result.value).length;
    console.log(`✅ 複数市場取引: ${successfulOrders}/3 成功`);

    // 4. 結果確認
    const account = demoService.getAccount();
    const positions = demoService.getPositions();
    const orderHistory = demoService.getOrders();

    console.log(`✅ 最終結果:`);
    console.log(`  - 総資産: ${account.totalValue.toLocaleString()}円`);
    console.log(`  - ポジション数: ${positions.length}`);
    console.log(`  - 注文数: ${orderHistory.length}`);
    console.log(`  - 総リターン: ${account.totalReturnPercent.toFixed(2)}%`);

    // 5. デモトレード停止
    demoService.stopDemoTrading();
    console.log('✅ デモトレード停止');

    console.log('✅ 統合ワークフローテスト完了');
  } catch (error) {
    console.error('❌ 統合ワークフローテストエラー:', error);
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Phase2機能テスト開始...');
  
  try {
    await testDataIntegrationService();
    await testOandaIntegration();
    await testWebullIntegration();
    await testTradingIntegration();
    await testAdvancedDemoTrading();
    await testIntegrationWorkflow();
    
    console.log('\n✅ Phase2機能テスト完了');
  } catch (error) {
    console.error('❌ Phase2機能テストエラー:', error);
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}
