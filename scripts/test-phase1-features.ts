/**
 * Phase1機能テストスクリプト
 * デモトレード機能の拡張、Mark1エージェントの最適化、予測システムの改善をテスト
 */

import { MultiStockMonitor } from '../src/agents/multi-stock-monitor';
import { PositionSizer } from '../src/agents/position-sizer';
import { TechnicalAnalyzer } from '../src/agents/technical-analyzer';
import { LSTMModel } from '../src/ml/models/lstm-model';
import { OnlineLearner } from '../src/ml/online-learner';
import { BacktestEngine } from '../src/services/backtest-engine';
import { FeeCalculator } from '../src/services/fee-calculator';
import { RiskManager } from '../src/services/risk-manager';

async function testFeeCalculator(): Promise<void> {
  console.log('\n🧪 手数料計算テスト開始...');

  try {
    // 基本的な手数料計算
    const commission = FeeCalculator.calculateCommission(100000, 'sbi');
    console.log(`✅ 10万円取引の手数料: ${commission.total}円`);

    // 利益計算
    const netProfit = FeeCalculator.calculateNetProfit(100000, 105000, 'sbi');
    console.log(`✅ 10万円→10.5万円の純利益: ${netProfit}円`);

    // 利益率計算
    const profitRate = FeeCalculator.calculateProfitRate(100000, 105000, 'sbi');
    console.log(`✅ 利益率: ${profitRate.toFixed(2)}%`);

    console.log('✅ 手数料計算テスト完了');
  } catch (error) {
    console.error('❌ 手数料計算テストエラー:', error);
  }
}

async function testRiskManager(): Promise<void> {
  console.log('\n🧪 リスク管理テスト開始...');

  try {
    const riskManager = new RiskManager({
      maxPositionSize: 100000,
      maxPortfolioRisk: 10,
      stopLossPercent: 5,
      takeProfitPercent: 10,
      maxDailyLoss: 50000,
      maxDrawdown: 20,
    });

    // ポジションサイジング
    const positionSize = riskManager.calculatePositionSize(
      1000000,
      1000,
      950,
      2
    );
    console.log(`✅ 推奨ポジションサイズ: ${positionSize}株`);

    // ポジションリスク分析
    const positionRisk = riskManager.analyzePositionRisk(100, 1000, 1050);
    console.log(`✅ ポジションリスク: ${positionRisk.riskAmount}円`);

    // ポートフォリオリスク分析
    const portfolioRisk = riskManager.analyzePortfolioRisk(
      [
        { symbol: 'AAPL', size: 100, entryPrice: 1000, currentPrice: 1050 },
        { symbol: 'GOOGL', size: 50, entryPrice: 2000, currentPrice: 1950 },
      ],
      1000000
    );

    console.log(
      `✅ ポートフォリオリスク: ${portfolioRisk.riskPercentage.toFixed(2)}%`
    );
    console.log(`✅ 推奨アクション: ${portfolioRisk.recommendedAction}`);

    console.log('✅ リスク管理テスト完了');
  } catch (error) {
    console.error('❌ リスク管理テストエラー:', error);
  }
}

async function testTechnicalAnalyzer(): Promise<void> {
  console.log('\n🧪 テクニカル分析テスト開始...');

  try {
    // モック価格データを生成
    const priceData = [];
    let basePrice = 1000;

    for (let i = 0; i < 100; i++) {
      basePrice += (Math.random() - 0.5) * 20;
      priceData.push({
        timestamp: new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000),
        open: basePrice,
        high: basePrice + Math.random() * 10,
        low: basePrice - Math.random() * 10,
        close: basePrice + (Math.random() - 0.5) * 5,
        volume: Math.floor(Math.random() * 1000000),
      });
    }

    // テクニカル指標を計算
    const indicators = TechnicalAnalyzer.calculateAllIndicators(priceData);
    console.log(`✅ RSI: ${indicators.rsi.toFixed(2)}`);
    console.log(`✅ MACD: ${indicators.macd.macd.toFixed(2)}`);
    console.log(
      `✅ ボリンジャーバンド幅: ${indicators.bollinger.width.toFixed(4)}`
    );

    // トレンド分析
    const trend = TechnicalAnalyzer.analyzeTrend(indicators);
    console.log(`✅ トレンド: ${trend.trend}`);
    console.log(`✅ 強度: ${trend.strength.toFixed(2)}%`);
    console.log(`✅ シグナル: ${trend.signals.join(', ')}`);

    console.log('✅ テクニカル分析テスト完了');
  } catch (error) {
    console.error('❌ テクニカル分析テストエラー:', error);
  }
}

async function testPositionSizer(): Promise<void> {
  console.log('\n🧪 ポジションサイジングテスト開始...');

  try {
    const positionSizer = new PositionSizer({
      accountBalance: 1000000,
      riskPerTrade: 2,
      maxPositionSize: 100000,
      minPositionSize: 10000,
      maxPortfolioRisk: 10,
    });

    // 固定リスクポジションサイジング
    const fixedRisk = positionSizer.calculateFixedRisk(1000, 950, 2);
    console.log(`✅ 固定リスク推奨サイズ: ${fixedRisk.recommendedSize}株`);
    console.log(
      `✅ ポジション価値: ${fixedRisk.positionValue.toLocaleString()}円`
    );
    console.log(`✅ リスク金額: ${fixedRisk.riskAmount.toLocaleString()}円`);

    // ケリー基準
    const kelly = positionSizer.calculateKellyCriterion(60, 5000, 3000, 1000);
    console.log(`✅ ケリー基準推奨割合: ${kelly.kellyPercent.toFixed(2)}%`);
    console.log(`✅ ケリー基準推奨サイズ: ${kelly.positionSize}株`);
    console.log(`✅ 推奨可否: ${kelly.isRecommended ? 'YES' : 'NO'}`);

    // 統合ポジションサイジング
    const integrated = positionSizer.calculateIntegrated(
      1000,
      950,
      15,
      60,
      5000,
      3000,
      5
    );
    console.log(`✅ 統合推奨サイズ: ${integrated.recommendedSize}株`);
    console.log(`✅ 信頼度: ${integrated.confidence}%`);

    console.log('✅ ポジションサイジングテスト完了');
  } catch (error) {
    console.error('❌ ポジションサイジングテストエラー:', error);
  }
}

async function testLSTMModel(): Promise<void> {
  console.log('\n🧪 LSTMモデルテスト開始...');

  try {
    const model = new LSTMModel({
      sequenceLength: 20,
      hiddenUnits: 32,
      dropout: 0.2,
      learningRate: 0.001,
      epochs: 10,
      batchSize: 16,
    });

    // モデルを初期化
    await model.initialize();
    console.log('✅ LSTMモデル初期化完了');

    // モックデータを生成
    const mockData = [];
    let basePrice = 1000;

    for (let i = 0; i < 200; i++) {
      basePrice += (Math.random() - 0.5) * 10;
      mockData.push(basePrice);
    }

    // モデルを訓練
    await model.train(mockData);
    console.log('✅ LSTMモデル訓練完了');

    // 予測を実行
    const prediction = await model.predict(mockData.slice(-20));
    console.log(`✅ 予測価格: ${prediction.prediction.toFixed(2)}`);
    console.log(`✅ 信頼度: ${prediction.confidence.toFixed(2)}%`);
    console.log(`✅ トレンド: ${prediction.trend}`);
    console.log(`✅ ボラティリティ: ${prediction.volatility.toFixed(2)}%`);

    console.log('✅ LSTMモデルテスト完了');
  } catch (error) {
    console.error('❌ LSTMモデルテストエラー:', error);
  }
}

async function testMultiStockMonitor(): Promise<void> {
  console.log('\n🧪 複数銘柄監視テスト開始...');

  try {
    const monitor = new MultiStockMonitor({
      symbols: ['AAPL', 'GOOGL', 'MSFT'],
      updateInterval: 5000,
      maxConcurrent: 3,
      riskThreshold: 5,
    });

    // 監視を開始
    await monitor.startMonitoring();
    console.log('✅ 複数銘柄監視開始');

    // 少し待機
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 分析結果を取得
    const analyses = monitor.getAnalyses();
    console.log(`✅ 分析完了銘柄数: ${analyses.length}`);

    analyses.forEach((analysis) => {
      console.log(
        `  - ${analysis.symbol}: ${analysis.recommendation} (信頼度: ${analysis.confidence.toFixed(2)}%)`
      );
    });

    // ポートフォリオ分析
    const portfolioAnalysis = await monitor.analyzePortfolio();
    console.log(
      `✅ ポートフォリオ総価値: ${portfolioAnalysis.totalValue.toLocaleString()}円`
    );
    console.log(`✅ 総損益: ${portfolioAnalysis.totalPnL.toLocaleString()}円`);
    console.log(`✅ リスクスコア: ${portfolioAnalysis.riskScore.toFixed(2)}`);

    // 監視を停止
    monitor.stopMonitoring();
    console.log('✅ 複数銘柄監視停止');

    console.log('✅ 複数銘柄監視テスト完了');
  } catch (error) {
    console.error('❌ 複数銘柄監視テストエラー:', error);
  }
}

async function testOnlineLearner(): Promise<void> {
  console.log('\n🧪 オンライン学習テスト開始...');

  try {
    const learner = new OnlineLearner({
      updateInterval: 1000,
      batchSize: 10,
      learningRate: 0.001,
      minDataPoints: 50,
      maxDataPoints: 1000,
      retrainThreshold: 10,
    });

    // LSTMモデルを作成して登録
    const model = new LSTMModel({
      sequenceLength: 10,
      hiddenUnits: 16,
      dropout: 0.1,
      learningRate: 0.001,
      epochs: 5,
      batchSize: 8,
    });

    await model.initialize();
    learner.registerModel('test-model', model);
    console.log('✅ モデル登録完了');

    // モックデータを追加
    const mockData = [];
    let basePrice = 1000;

    for (let i = 0; i < 100; i++) {
      basePrice += (Math.random() - 0.5) * 5;
      mockData.push(basePrice);
    }

    learner.addData('test-model', mockData);
    console.log('✅ データ追加完了');

    // 学習を開始
    await learner.startLearning();
    console.log('✅ オンライン学習開始');

    // 少し待機
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // メトリクスを取得
    const metrics = learner.getMetrics('test-model');
    if (metrics) {
      console.log(`✅ 精度: ${metrics.accuracy.toFixed(2)}%`);
      console.log(`✅ 損失: ${metrics.loss.toFixed(4)}`);
      console.log(`✅ MAE: ${metrics.mae.toFixed(4)}`);
      console.log(`✅ MSE: ${metrics.mse.toFixed(4)}`);
    }

    // 学習を停止
    learner.stopLearning();
    console.log('✅ オンライン学習停止');

    console.log('✅ オンライン学習テスト完了');
  } catch (error) {
    console.error('❌ オンライン学習テストエラー:', error);
  }
}

async function testBacktestEngine(): Promise<void> {
  console.log('\n🧪 バックテストエンジンテスト開始...');

  try {
    const backtestEngine = new BacktestEngine({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      initialCapital: 1000000,
      commissionRate: 0.001,
      slippage: 0.001,
      riskParameters: {
        maxPositionSize: 100000,
        maxPortfolioRisk: 10,
        stopLossPercent: 5,
        takeProfitPercent: 10,
        maxDailyLoss: 50000,
        maxDrawdown: 20,
      },
    });

    // モック価格データを生成
    const priceData = [];
    let basePrice = 1000;

    for (let i = 0; i < 30; i++) {
      basePrice += (Math.random() - 0.5) * 20;
      priceData.push({
        date: new Date(2024, 0, i + 1),
        symbol: 'TEST',
        open: basePrice,
        high: basePrice + Math.random() * 10,
        low: basePrice - Math.random() * 10,
        close: basePrice + (Math.random() - 0.5) * 5,
        volume: Math.floor(Math.random() * 1000000),
      });
    }

    // 簡単な戦略を定義
    const strategy = async (data: any) => {
      const signals: Array<{
        symbol: string;
        action: 'BUY' | 'SELL' | 'HOLD';
        quantity?: number;
        price?: number;
      }> = [];

      // ランダムな買いシグナル
      if (Math.random() > 0.7) {
        signals.push({
          symbol: 'TEST',
          action: 'BUY' as const,
          quantity: 10,
          price: data.close,
        });
      }

      return signals;
    };

    // バックテストを実行
    const result = await backtestEngine.runBacktest(strategy, priceData);

    console.log(`✅ 総取引数: ${result.performance.totalTrades}`);
    console.log(`✅ 勝率: ${result.performance.winRate.toFixed(2)}%`);
    console.log(
      `✅ 総リターン: ${result.performance.totalReturnPercent.toFixed(2)}%`
    );
    console.log(
      `✅ 最大ドローダウン: ${result.performance.maxDrawdown.toFixed(2)}%`
    );

    console.log('✅ バックテストエンジンテスト完了');
  } catch (error) {
    console.error('❌ バックテストエンジンテストエラー:', error);
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Phase1機能テスト開始...');

  try {
    await testFeeCalculator();
    await testRiskManager();
    await testTechnicalAnalyzer();
    await testPositionSizer();
    await testLSTMModel();
    await testMultiStockMonitor();
    await testOnlineLearner();
    await testBacktestEngine();

    console.log('\n✅ Phase1機能テスト完了');
  } catch (error) {
    console.error('❌ Phase1機能テストエラー:', error);
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}
