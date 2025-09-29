/**
 * Phase3機能テストスクリプト
 * リアル取引API統合、高度なアルゴリズム取引、機械学習統合、バックテスト機能をテスト
 */

import { BacktestEngine } from '../src/backtesting/backtest-engine';
import { TradingMLService } from '../src/ml/trading-ml-service';
import { RealTradingService } from '../src/services/real-trading-service';
import { MomentumStrategy } from '../src/strategies/momentum-strategy';

async function testRealTradingService(): Promise<void> {
  console.log('\n🧪 リアル取引サービステスト開始...');

  try {
    const realTradingService = new RealTradingService({
      tradingIntegration: {
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
      },
      dataIntegration: {
        cacheEnabled: true,
        cacheExpiry: 300000,
        fallbackEnabled: true,
        maxRetries: 3,
        retryDelay: 1000,
      },
      riskManagement: {
        maxPositionSize: 100000,
        maxPortfolioRisk: 10,
        stopLossPercent: 5,
        takeProfitPercent: 10,
        maxDailyLoss: 50000,
        maxDrawdown: 20,
      },
      feeCalculation: {
        commissionRate: 0.001,
        slippageRate: 0.001,
        taxRate: 0,
      },
    });

    // 初期化テスト
    const initialized = await realTradingService.initialize();
    console.log(
      `✅ リアル取引サービス初期化: ${initialized ? '成功' : '失敗'}`
    );

    if (initialized) {
      // 接続状態チェック
      const connectionStatus = await realTradingService.checkConnectionStatus();
      console.log(
        `✅ 接続状態: 全体=${connectionStatus.overall}, ブローカー=${JSON.stringify(connectionStatus.brokers)}`
      );

      // 口座情報取得テスト
      const account = await realTradingService.getAccount();
      if (account) {
        console.log(
          `✅ 口座情報取得: 総資産 ${account.totalValue.toLocaleString()}円`
        );
      } else {
        console.log('⚠️ 口座情報取得失敗');
      }

      // ポジション取得テスト
      const positions = await realTradingService.getPositions();
      console.log(`✅ ポジション取得: ${positions.length}ポジション`);

      // 注文取得テスト
      const orders = await realTradingService.getOrders();
      console.log(`✅ 注文取得: ${orders.length}注文`);

      // 現在価格取得テスト
      const price = await realTradingService.getCurrentPrice('AAPL', 'US');
      if (price) {
        console.log(`✅ 現在価格取得: AAPL - $${price}`);
      } else {
        console.log('⚠️ 現在価格取得失敗');
      }
    }

    console.log('✅ リアル取引サービステスト完了');
  } catch (error) {
    console.error('❌ リアル取引サービステストエラー:', error);
  }
}

async function testMomentumStrategy(): Promise<void> {
  console.log('\n🧪 モメンタム戦略テスト開始...');

  try {
    // モックサービスを作成
    const mockTradingService = {
      initialize: async () => true,
      getCurrentPrice: async (symbol: string, market: string) => 100,
      placeOrder: async (order: any) => ({
        success: true,
        orderId: 'test-order',
      }),
      getPositions: async () => [],
      getOrders: async () => [],
    } as any;

    const mockDataService = {
      initialize: async () => true,
      getHistoricalData: async (
        symbol: string,
        market: string,
        days: number
      ) => ({
        data: Array.from({ length: days }, (_, i) => ({
          close: 100 + Math.sin(i * 0.1) * 10,
          volume: 1000 + Math.random() * 500,
          high: 105 + Math.sin(i * 0.1) * 10,
          low: 95 + Math.sin(i * 0.1) * 10,
          open: 99 + Math.sin(i * 0.1) * 10,
        })),
      }),
    } as any;

    const momentumStrategy = new MomentumStrategy(
      {
        name: 'TestMomentumStrategy',
        description: 'テスト用モメンタム戦略',
        symbols: ['AAPL', 'GOOGL'],
        markets: ['US'],
        timeframe: '1h',
        lookbackPeriod: 50,
        riskManagement: {
          maxPositionSize: 100000,
          stopLossPercent: 5,
          takeProfitPercent: 10,
          maxDailyLoss: 50000,
        },
        technicalIndicators: {
          sma: { periods: [5, 10, 20] },
          ema: { periods: [5, 10, 20] },
          rsi: { period: 14, oversold: 30, overbought: 70 },
          macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          bollinger: { period: 20, stdDev: 2 },
        },
        momentumPeriods: [5, 10, 20],
        volumeThreshold: 0.1,
        priceChangeThreshold: 0.02,
        trendConfirmation: true,
        volumeConfirmation: true,
        enabled: true,
      },
      mockTradingService,
      mockDataService
    );

    // 戦略初期化テスト
    const initialized = await momentumStrategy.initialize();
    console.log(`✅ モメンタム戦略初期化: ${initialized ? '成功' : '失敗'}`);

    if (initialized) {
      // 戦略開始テスト
      const started = await momentumStrategy.start();
      console.log(`✅ モメンタム戦略開始: ${started ? '成功' : '失敗'}`);

      if (started) {
        // シグナル生成テスト
        const signals = await momentumStrategy.generateSignals();
        console.log(`✅ シグナル生成: ${signals.length}個`);

        if (signals.length > 0) {
          const signal = signals[0];
          console.log(
            `  - シグナル: ${signal.symbol} ${signal.side} 強度=${signal.strength.toFixed(2)} 信頼度=${signal.confidence.toFixed(2)}`
          );
          console.log(`  - 理由: ${signal.reason}`);
        }

        // 注文執行テスト
        const orderResults = await momentumStrategy.executeOrders(signals);
        console.log(`✅ 注文執行: ${orderResults.length}件`);

        const successfulOrders = orderResults.filter((r) => r.success).length;
        console.log(`  - 成功: ${successfulOrders}/${orderResults.length}`);

        // リバランステスト
        const rebalanceResult = await momentumStrategy.rebalance();
        console.log(
          `✅ リバランス: ${rebalanceResult.successfulOrders}/${rebalanceResult.totalOrders} 成功`
        );

        // パフォーマンス計算テスト
        const performance = await momentumStrategy.calculatePerformance();
        console.log(
          `✅ パフォーマンス計算: 総リターン=${performance.totalReturnPercent.toFixed(2)}%, 勝率=${performance.winRate.toFixed(1)}%`
        );

        // 戦略停止
        momentumStrategy.stop();
        console.log('✅ モメンタム戦略停止');
      }
    }

    console.log('✅ モメンタム戦略テスト完了');
  } catch (error) {
    console.error('❌ モメンタム戦略テストエラー:', error);
  }
}

async function testTradingMLService(): Promise<void> {
  console.log('\n🧪 取引機械学習サービステスト開始...');

  try {
    // モックサービスを作成
    const mockDataService = {
      initialize: async () => true,
      getHistoricalData: async (
        symbol: string,
        market: string,
        days: number
      ) => ({
        data: Array.from({ length: days }, (_, i) => ({
          close: 100 + Math.sin(i * 0.1) * 10,
          volume: 1000 + Math.random() * 500,
          high: 105 + Math.sin(i * 0.1) * 10,
          low: 95 + Math.sin(i * 0.1) * 10,
          open: 99 + Math.sin(i * 0.1) * 10,
        })),
      }),
    } as any;

    const mockTradingService = {
      getCurrentPrice: async (symbol: string, market: string) => 100,
    } as any;

    const tradingMLService = new TradingMLService(
      {
        models: {
          lstm: {
            enabled: true,
            sequenceLength: 10,
            hiddenUnits: 50,
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
          },
          multiTimeframe: {
            enabled: true,
            timeframes: ['1h', '4h', '1d'],
            weights: [0.4, 0.3, 0.3],
          },
          onlineLearning: {
            enabled: true,
            updateInterval: 3600000,
            minDataPoints: 100,
            retrainThreshold: 0.1,
          },
        },
        prediction: {
          confidenceThreshold: 0.6,
          maxPredictions: 10,
          predictionHorizon: 24,
        },
        trading: {
          minConfidence: 0.7,
          maxPositionSize: 100000,
          stopLossPercent: 5,
          takeProfitPercent: 10,
        },
      },
      mockDataService,
      mockTradingService
    );

    // サービス初期化テスト
    const initialized = await tradingMLService.initialize();
    console.log(
      `✅ 取引機械学習サービス初期化: ${initialized ? '成功' : '失敗'}`
    );

    if (initialized) {
      // 予測テスト
      const prediction = await tradingMLService.predict('AAPL', 'US');
      if (prediction) {
        console.log(
          `✅ 予測実行: ${prediction.symbol} 方向=${prediction.prediction.direction} 信頼度=${prediction.prediction.confidence.toFixed(2)}`
        );
        console.log(`  - 予測価格: ${prediction.prediction.price.toFixed(2)}`);
        console.log(`  - モデル: ${prediction.model}`);
      } else {
        console.log('⚠️ 予測実行失敗');
      }

      // 取引シグナル生成テスト
      const signal = await tradingMLService.generateTradingSignal('AAPL', 'US');
      if (signal) {
        console.log(
          `✅ 取引シグナル生成: ${signal.symbol} ${signal.side} 強度=${signal.strength.toFixed(2)} 信頼度=${signal.confidence.toFixed(2)}`
        );
        console.log(`  - 理由: ${signal.reason}`);
        console.log(`  - リスクスコア: ${signal.riskScore.toFixed(2)}`);
      } else {
        console.log('⚠️ 取引シグナル生成失敗');
      }

      // アンサンブル予測テスト
      const ensemblePrediction = await tradingMLService.getEnsemblePrediction(
        'AAPL',
        'US'
      );
      if (ensemblePrediction) {
        console.log(
          `✅ アンサンブル予測: ${ensemblePrediction.symbol} 方向=${ensemblePrediction.prediction.direction} 信頼度=${ensemblePrediction.prediction.confidence.toFixed(2)}`
        );
      } else {
        console.log('⚠️ アンサンブル予測失敗');
      }

      // 全予測取得テスト
      const allPredictions = tradingMLService.getAllPredictions();
      console.log(`✅ 全予測取得: ${allPredictions.length}個`);

      // 全シグナル取得テスト
      const allSignals = tradingMLService.getAllSignals();
      console.log(`✅ 全シグナル取得: ${allSignals.length}個`);
    }

    console.log('✅ 取引機械学習サービステスト完了');
  } catch (error) {
    console.error('❌ 取引機械学習サービステストエラー:', error);
  }
}

async function testBacktestEngine(): Promise<void> {
  console.log('\n🧪 バックテストエンジンテスト開始...');

  try {
    // モック戦略を作成
    const mockStrategy = {
      initialize: async () => true,
      generateSignals: async () => [
        {
          id: 'test-signal-1',
          symbol: 'AAPL',
          market: 'US',
          side: 'BUY',
          strength: 0.8,
          confidence: 0.7,
          price: 100,
          quantity: 10,
          reason: 'テストシグナル',
          indicators: { momentum: 0.5 },
          createdAt: new Date(),
          strategy: 'TestStrategy',
        },
      ],
      executeOrders: async (signals: any[]) =>
        signals.map((s) => ({ success: true, signal: s })),
      rebalance: async () => ({
        success: true,
        orders: [],
        totalOrders: 0,
        successfulOrders: 0,
      }),
      getConfig: () => ({ name: 'TestStrategy' }),
    } as any;

    const backtestEngine = new BacktestEngine({
      strategy: mockStrategy,
      symbols: ['AAPL'],
      markets: ['US'],
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30日前
      endDate: new Date(),
      initialCapital: 1000000,
      timeframe: '1d',
      commission: 0.001,
      slippage: 0.001,
      riskManagement: {
        maxPositionSize: 100000,
        stopLossPercent: 5,
        takeProfitPercent: 10,
        maxDailyLoss: 50000,
      },
      dataSource: 'yahoo',
    });

    // バックテスト実行テスト
    const result = await backtestEngine.runBacktest();
    console.log(
      `✅ バックテスト実行: 総リターン=${result.performance.totalReturnPercent.toFixed(2)}%`
    );
    console.log(
      `  - シャープレシオ: ${result.performance.sharpeRatio.toFixed(2)}`
    );
    console.log(
      `  - 最大ドローダウン: ${result.performance.maxDrawdownPercent.toFixed(2)}%`
    );
    console.log(`  - 勝率: ${result.performance.winRate.toFixed(1)}%`);
    console.log(`  - 総取引数: ${result.performance.totalTrades}`);
    console.log(
      `  - プロフィットファクター: ${result.performance.profitFactor.toFixed(2)}`
    );

    // パフォーマンス分析テスト
    const analysis = await backtestEngine.analyzePerformance(result);
    console.log(
      `✅ パフォーマンス分析: 推奨事項=${analysis.recommendations.length}個`
    );
    analysis.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    // パラメータ最適化テスト
    const optimizationResult =
      await backtestEngine.optimizeParameters(mockStrategy);
    console.log(
      `✅ パラメータ最適化: 最良イテレーション=${optimizationResult.bestIteration}/${optimizationResult.totalIterations}`
    );
    console.log(
      `  - 最良パラメータ: ${JSON.stringify(optimizationResult.bestParameters)}`
    );
    console.log(
      `  - 最良パフォーマンス: ${optimizationResult.bestPerformance.performance.totalReturnPercent.toFixed(2)}%`
    );

    // バックテスト状態取得テスト
    const status = backtestEngine.getStatus();
    console.log(
      `✅ バックテスト状態: 実行中=${status.running}, 進捗=${status.progress}`
    );

    console.log('✅ バックテストエンジンテスト完了');
  } catch (error) {
    console.error('❌ バックテストエンジンテストエラー:', error);
  }
}

async function testIntegrationWorkflow(): Promise<void> {
  console.log('\n🧪 統合ワークフローテスト開始...');

  try {
    // モックサービスを作成
    const mockTradingService = {
      initialize: async () => true,
      getCurrentPrice: async (symbol: string, market: string) => 100,
      placeOrder: async (order: any) => ({
        success: true,
        orderId: 'test-order',
      }),
      getPositions: async () => [],
      getOrders: async () => [],
    } as any;

    const mockDataService = {
      initialize: async () => true,
      getHistoricalData: async (
        symbol: string,
        market: string,
        days: number
      ) => ({
        data: Array.from({ length: days }, (_, i) => ({
          close: 100 + Math.sin(i * 0.1) * 10,
          volume: 1000 + Math.random() * 500,
          high: 105 + Math.sin(i * 0.1) * 10,
          low: 95 + Math.sin(i * 0.1) * 10,
          open: 99 + Math.sin(i * 0.1) * 10,
        })),
      }),
    } as any;

    // モメンタム戦略
    const momentumStrategy = new MomentumStrategy(
      {
        name: 'IntegrationMomentumStrategy',
        description: '統合テスト用モメンタム戦略',
        symbols: ['AAPL'],
        markets: ['US'],
        timeframe: '1h',
        lookbackPeriod: 50,
        riskManagement: {
          maxPositionSize: 100000,
          stopLossPercent: 5,
          takeProfitPercent: 10,
          maxDailyLoss: 50000,
        },
        technicalIndicators: {
          sma: { periods: [5, 10, 20] },
          ema: { periods: [5, 10, 20] },
          rsi: { period: 14, oversold: 30, overbought: 70 },
          macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          bollinger: { period: 20, stdDev: 2 },
        },
        momentumPeriods: [5, 10, 20],
        volumeThreshold: 0.1,
        priceChangeThreshold: 0.02,
        trendConfirmation: true,
        volumeConfirmation: true,
        enabled: true,
      },
      mockTradingService,
      mockDataService
    );

    // 取引機械学習サービス
    const tradingMLService = new TradingMLService(
      {
        models: {
          lstm: {
            enabled: true,
            sequenceLength: 10,
            hiddenUnits: 50,
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
          },
          multiTimeframe: {
            enabled: true,
            timeframes: ['1h', '4h', '1d'],
            weights: [0.4, 0.3, 0.3],
          },
          onlineLearning: {
            enabled: true,
            updateInterval: 3600000,
            minDataPoints: 100,
            retrainThreshold: 0.1,
          },
        },
        prediction: {
          confidenceThreshold: 0.6,
          maxPredictions: 10,
          predictionHorizon: 24,
        },
        trading: {
          minConfidence: 0.7,
          maxPositionSize: 100000,
          stopLossPercent: 5,
          takeProfitPercent: 10,
        },
      },
      mockDataService,
      mockTradingService
    );

    // バックテストエンジン
    const backtestEngine = new BacktestEngine({
      strategy: momentumStrategy,
      symbols: ['AAPL'],
      markets: ['US'],
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7日前
      endDate: new Date(),
      initialCapital: 1000000,
      timeframe: '1d',
      commission: 0.001,
      slippage: 0.001,
      riskManagement: {
        maxPositionSize: 100000,
        stopLossPercent: 5,
        takeProfitPercent: 10,
        maxDailyLoss: 50000,
      },
      dataSource: 'yahoo',
    });

    // 統合ワークフロー実行
    console.log('🔄 統合ワークフロー実行中...');

    // 1. 戦略初期化
    const strategyInitialized = await momentumStrategy.initialize();
    console.log(`✅ 戦略初期化: ${strategyInitialized ? '成功' : '失敗'}`);

    // 2. 機械学習サービス初期化
    const mlInitialized = await tradingMLService.initialize();
    console.log(
      `✅ 機械学習サービス初期化: ${mlInitialized ? '成功' : '失敗'}`
    );

    // 3. 戦略実行
    if (strategyInitialized) {
      const strategyStarted = await momentumStrategy.start();
      console.log(`✅ 戦略開始: ${strategyStarted ? '成功' : '失敗'}`);

      if (strategyStarted) {
        // シグナル生成
        const signals = await momentumStrategy.generateSignals();
        console.log(`✅ シグナル生成: ${signals.length}個`);

        // 注文執行
        const orderResults = await momentumStrategy.executeOrders(signals);
        const successfulOrders = orderResults.filter((r) => r.success).length;
        console.log(
          `✅ 注文執行: ${successfulOrders}/${orderResults.length} 成功`
        );

        // 戦略停止
        momentumStrategy.stop();
        console.log('✅ 戦略停止');
      }
    }

    // 4. 機械学習予測
    if (mlInitialized) {
      const prediction = await tradingMLService.predict('AAPL', 'US');
      if (prediction) {
        console.log(
          `✅ 機械学習予測: ${prediction.symbol} 方向=${prediction.prediction.direction} 信頼度=${prediction.prediction.confidence.toFixed(2)}`
        );
      }

      const signal = await tradingMLService.generateTradingSignal('AAPL', 'US');
      if (signal) {
        console.log(
          `✅ 機械学習シグナル: ${signal.symbol} ${signal.side} 強度=${signal.strength.toFixed(2)} 信頼度=${signal.confidence.toFixed(2)}`
        );
      }
    }

    // 5. バックテスト実行
    const backtestResult = await backtestEngine.runBacktest();
    console.log(
      `✅ バックテスト実行: 総リターン=${backtestResult.performance.totalReturnPercent.toFixed(2)}%`
    );

    // 6. パフォーマンス分析
    const analysis = await backtestEngine.analyzePerformance(backtestResult);
    console.log(
      `✅ パフォーマンス分析: 推奨事項=${analysis.recommendations.length}個`
    );

    // 7. 結果サマリー
    console.log(`✅ 統合ワークフロー結果:`);
    console.log(`  - 戦略実行: ${strategyInitialized ? '成功' : '失敗'}`);
    console.log(`  - 機械学習: ${mlInitialized ? '成功' : '失敗'}`);
    console.log(`  - バックテスト: 成功`);
    console.log(
      `  - 総リターン: ${backtestResult.performance.totalReturnPercent.toFixed(2)}%`
    );
    console.log(
      `  - シャープレシオ: ${backtestResult.performance.sharpeRatio.toFixed(2)}`
    );
    console.log(
      `  - 最大ドローダウン: ${backtestResult.performance.maxDrawdownPercent.toFixed(2)}%`
    );

    console.log('✅ 統合ワークフローテスト完了');
  } catch (error) {
    console.error('❌ 統合ワークフローテストエラー:', error);
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Phase3機能テスト開始...');

  try {
    await testRealTradingService();
    await testMomentumStrategy();
    await testTradingMLService();
    await testBacktestEngine();
    await testIntegrationWorkflow();

    console.log('\n✅ Phase3機能テスト完了');
  } catch (error) {
    console.error('❌ Phase3機能テストエラー:', error);
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}
