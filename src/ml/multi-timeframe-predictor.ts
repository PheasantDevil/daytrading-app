/**
 * 複数時間軸予測サービス
 * 1分、5分、15分、1時間等の複数時間軸での予測
 */

import { LSTMModel, LSTMPrediction } from './models/lstm-model';

export interface TimeframeConfig {
  name: string;
  interval: number; // 分
  sequenceLength: number;
  predictionSteps: number;
}

export interface MultiTimeframePrediction {
  symbol: string;
  timeframes: {
    [timeframe: string]: {
      prediction: number;
      confidence: number;
      trend: 'UP' | 'DOWN' | 'SIDEWAYS';
      volatility: number;
      nextPrices: number[];
    };
  };
  consensus: {
    trend: 'UP' | 'DOWN' | 'SIDEWAYS';
    confidence: number;
    volatility: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD';
  };
  timestamp: Date;
}

export interface PriceData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class MultiTimeframePredictor {
  private timeframes: TimeframeConfig[];
  private models: Map<string, LSTMModel> = new Map();
  private isInitialized: boolean = false;

  constructor(timeframes: TimeframeConfig[] = [
    { name: '1m', interval: 1, sequenceLength: 60, predictionSteps: 5 },
    { name: '5m', interval: 5, sequenceLength: 48, predictionSteps: 4 },
    { name: '15m', interval: 15, sequenceLength: 32, predictionSteps: 3 },
    { name: '1h', interval: 60, sequenceLength: 24, predictionSteps: 2 },
    { name: '4h', interval: 240, sequenceLength: 12, predictionSteps: 2 },
  ]) {
    this.timeframes = timeframes;
  }

  /**
   * 予測器を初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ 予測器は既に初期化されています');
      return;
    }

    console.log('🔄 複数時間軸予測器初期化中...');

    for (const timeframe of this.timeframes) {
      const model = new LSTMModel({
        sequenceLength: timeframe.sequenceLength,
        hiddenUnits: 64,
        dropout: 0.2,
        learningRate: 0.001,
        epochs: 50,
        batchSize: 32,
      });

      await model.initialize();
      this.models.set(timeframe.name, model);
    }

    this.isInitialized = true;
    console.log('✅ 複数時間軸予測器初期化完了');
  }

  /**
   * 各時間軸のデータを準備
   */
  private prepareTimeframeData(
    priceData: PriceData[],
    timeframe: TimeframeConfig
  ): number[] {
    // 時間軸に応じてデータを集約
    const aggregatedData: number[] = [];
    const intervalMs = timeframe.interval * 60 * 1000; // ミリ秒に変換

    let currentTime = priceData[0].timestamp.getTime();
    let currentOHLC = {
      open: priceData[0].open,
      high: priceData[0].high,
      low: priceData[0].low,
      close: priceData[0].close,
      volume: priceData[0].volume,
    };

    for (let i = 1; i < priceData.length; i++) {
      const dataTime = priceData[i].timestamp.getTime();
      
      if (dataTime - currentTime >= intervalMs) {
        // 新しい時間軸のデータポイント
        aggregatedData.push(currentOHLC.close);
        
        currentTime = dataTime;
        currentOHLC = {
          open: priceData[i].open,
          high: priceData[i].high,
          low: priceData[i].low,
          close: priceData[i].close,
          volume: priceData[i].volume,
        };
      } else {
        // 現在の時間軸内のデータを更新
        currentOHLC.high = Math.max(currentOHLC.high, priceData[i].high);
        currentOHLC.low = Math.min(currentOHLC.low, priceData[i].low);
        currentOHLC.close = priceData[i].close;
        currentOHLC.volume += priceData[i].volume;
      }
    }

    // 最後のデータポイントを追加
    aggregatedData.push(currentOHLC.close);

    return aggregatedData;
  }

  /**
   * 各時間軸でモデルを訓練
   */
  async trainModels(priceData: PriceData[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('🔄 複数時間軸モデル訓練開始...');

    const trainingPromises = this.timeframes.map(async (timeframe) => {
      try {
        const model = this.models.get(timeframe.name);
        if (!model) {
          throw new Error(`モデルが見つかりません: ${timeframe.name}`);
        }

        // 時間軸データを準備
        const timeframeData = this.prepareTimeframeData(priceData, timeframe);
        
        if (timeframeData.length < timeframe.sequenceLength + 10) {
          console.warn(`⚠️ ${timeframe.name} のデータが不足しています`);
          return;
        }

        // モデルを訓練
        await model.train(timeframeData);
        console.log(`✅ ${timeframe.name} モデル訓練完了`);
      } catch (error) {
        console.error(`❌ ${timeframe.name} モデル訓練エラー:`, error);
      }
    });

    await Promise.allSettled(trainingPromises);
    console.log('✅ 複数時間軸モデル訓練完了');
  }

  /**
   * 複数時間軸で予測を実行
   */
  async predict(symbol: string, priceData: PriceData[]): Promise<MultiTimeframePrediction> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const timeframePredictions: { [timeframe: string]: any } = {};

    // 各時間軸で予測を実行
    for (const timeframe of this.timeframes) {
      try {
        const model = this.models.get(timeframe.name);
        if (!model || !model.isModelTrained()) {
          console.warn(`⚠️ ${timeframe.name} モデルが訓練されていません`);
          continue;
        }

        // 時間軸データを準備
        const timeframeData = this.prepareTimeframeData(priceData, timeframe);
        
        if (timeframeData.length < timeframe.sequenceLength) {
          console.warn(`⚠️ ${timeframe.name} のデータが不足しています`);
          continue;
        }

        // 予測を実行
        const prediction = await model.predict(timeframeData);
        timeframePredictions[timeframe.name] = prediction;
      } catch (error) {
        console.error(`❌ ${timeframe.name} 予測エラー:`, error);
      }
    }

    // コンセンサスを計算
    const consensus = this.calculateConsensus(timeframePredictions);

    return {
      symbol,
      timeframes: timeframePredictions,
      consensus,
      timestamp: new Date(),
    };
  }

  /**
   * コンセンサスを計算
   */
  private calculateConsensus(timeframePredictions: { [timeframe: string]: any }): {
    trend: 'UP' | 'DOWN' | 'SIDEWAYS';
    confidence: number;
    volatility: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD';
  } {
    const predictions = Object.values(timeframePredictions);
    
    if (predictions.length === 0) {
      return {
        trend: 'SIDEWAYS',
        confidence: 0,
        volatility: 0,
        recommendation: 'HOLD',
      };
    }

    // トレンドの重み付け投票
    const trendVotes = { UP: 0, DOWN: 0, SIDEWAYS: 0 };
    let totalConfidence = 0;
    let totalVolatility = 0;

    predictions.forEach((prediction: any) => {
      const weight = prediction.confidence / 100;
      trendVotes[prediction.trend] += weight;
      totalConfidence += prediction.confidence;
      totalVolatility += prediction.volatility;
    });

    // 最も多い投票のトレンドを決定
    const consensusTrend = Object.entries(trendVotes)
      .sort(([, a], [, b]) => b - a)[0][0] as 'UP' | 'DOWN' | 'SIDEWAYS';

    // 平均信頼度とボラティリティ
    const avgConfidence = totalConfidence / predictions.length;
    const avgVolatility = totalVolatility / predictions.length;

    // 推奨アクションを決定
    let recommendation: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (consensusTrend === 'UP' && avgConfidence > 60) {
      recommendation = 'BUY';
    } else if (consensusTrend === 'DOWN' && avgConfidence > 60) {
      recommendation = 'SELL';
    }

    return {
      trend: consensusTrend,
      confidence: avgConfidence,
      volatility: avgVolatility,
      recommendation,
    };
  }

  /**
   * 時間軸の重みを計算
   */
  private calculateTimeframeWeights(): { [timeframe: string]: number } {
    const weights: { [timeframe: string]: number } = {};
    
    // 短時間軸ほど重みを大きく（短期トレンド重視）
    this.timeframes.forEach((timeframe, index) => {
      const weight = 1 / (index + 1);
      weights[timeframe.name] = weight;
    });

    return weights;
  }

  /**
   * 予測精度を評価
   */
  async evaluateAccuracy(
    symbol: string,
    historicalData: PriceData[],
    testPeriod: number = 7 // 日
  ): Promise<{
    [timeframe: string]: {
      accuracy: number;
      mae: number;
      mse: number;
    };
  }> {
    const results: { [timeframe: string]: any } = {};

    for (const timeframe of this.timeframes) {
      try {
        const model = this.models.get(timeframe.name);
        if (!model || !model.isModelTrained()) {
          continue;
        }

        // テストデータを準備
        const timeframeData = this.prepareTimeframeData(historicalData, timeframe);
        const testData = timeframeData.slice(-testPeriod);
        const trainData = timeframeData.slice(0, -testPeriod);

        if (testData.length === 0 || trainData.length < timeframe.sequenceLength) {
          continue;
        }

        // 予測を実行
        const predictions: number[] = [];
        const actuals: number[] = [];

        for (let i = 0; i < testData.length; i++) {
          const inputData = trainData.slice(-timeframe.sequenceLength);
          const prediction = await model.predict(inputData);
          predictions.push(prediction.prediction);
          actuals.push(testData[i]);
          
          // 次の予測のためにデータを更新
          trainData.push(testData[i]);
        }

        // 精度を計算
        const accuracy = this.calculateAccuracy(predictions, actuals);
        const mae = this.calculateMAE(predictions, actuals);
        const mse = this.calculateMSE(predictions, actuals);

        results[timeframe.name] = { accuracy, mae, mse };
      } catch (error) {
        console.error(`❌ ${timeframe.name} 精度評価エラー:`, error);
      }
    }

    return results;
  }

  /**
   * 精度を計算
   */
  private calculateAccuracy(predictions: number[], actuals: number[]): number {
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      const predDirection = predictions[i] > actuals[i] ? 1 : -1;
      const actualDirection = actuals[i] > (actuals[i - 1] || actuals[i]) ? 1 : -1;
      if (predDirection === actualDirection) correct++;
    }
    return (correct / predictions.length) * 100;
  }

  /**
   * 平均絶対誤差を計算
   */
  private calculateMAE(predictions: number[], actuals: number[]): number {
    const errors = predictions.map((pred, i) => Math.abs(pred - actuals[i]));
    return errors.reduce((sum, error) => sum + error, 0) / errors.length;
  }

  /**
   * 平均二乗誤差を計算
   */
  private calculateMSE(predictions: number[], actuals: number[]): number {
    const errors = predictions.map((pred, i) => Math.pow(pred - actuals[i], 2));
    return errors.reduce((sum, error) => sum + error, 0) / errors.length;
  }

  /**
   * モデルを保存
   */
  async saveModels(basePath: string): Promise<void> {
    const savePromises = Array.from(this.models.entries()).map(async ([timeframe, model]) => {
      try {
        await model.saveModel(`${basePath}/lstm_${timeframe}.json`);
      } catch (error) {
        console.error(`❌ ${timeframe} モデル保存エラー:`, error);
      }
    });

    await Promise.allSettled(savePromises);
    console.log('✅ 複数時間軸モデル保存完了');
  }

  /**
   * モデルを読み込み
   */
  async loadModels(basePath: string): Promise<void> {
    const loadPromises = this.timeframes.map(async (timeframe) => {
      try {
        const model = this.models.get(timeframe.name);
        if (model) {
          await model.loadModel(`${basePath}/lstm_${timeframe.name}.json`);
        }
      } catch (error) {
        console.error(`❌ ${timeframe.name} モデル読み込みエラー:`, error);
      }
    });

    await Promise.allSettled(loadPromises);
    console.log('✅ 複数時間軸モデル読み込み完了');
  }

  /**
   * 利用可能な時間軸を取得
   */
  getAvailableTimeframes(): string[] {
    return this.timeframes.map(tf => tf.name);
  }

  /**
   * 特定の時間軸のモデルを取得
   */
  getModel(timeframe: string): LSTMModel | null {
    return this.models.get(timeframe) || null;
  }
}
