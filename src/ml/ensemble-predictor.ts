import { LSTMPredictor } from './lstm-predictor';

interface PredictionResult {
  predictedPrice: number;
  confidence: number;
  trend: 'up' | 'down' | 'neutral';
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  timestamp: Date;
  modelWeights: Record<string, number>;
}

interface ModelPrediction {
  modelName: string;
  prediction: PredictionResult;
  weight: number;
}

interface TrainingData {
  features: number[][];
  targets: number[];
  timestamps: Date[];
}

/**
 * アンサンブル予測モデル
 * 複数のMLモデルを組み合わせてより精度の高い予測を行う
 */
export class EnsemblePredictor {
  private models: Map<string, LSTMPredictor> = new Map();
  private modelWeights: Map<string, number> = new Map();
  private isTrained: boolean = false;

  constructor() {
    this.initializeModels();
  }

  /**
   * 複数のモデルを初期化
   */
  private initializeModels(): void {
    // LSTMモデル（異なる設定）
    this.models.set('lstm_short', new LSTMPredictor());
    this.models.set('lstm_medium', new LSTMPredictor());
    this.models.set('lstm_long', new LSTMPredictor());

    // 初期重みを設定
    this.modelWeights.set('lstm_short', 0.4);  // 短期予測重視
    this.modelWeights.set('lstm_medium', 0.4); // 中期予測重視
    this.modelWeights.set('lstm_long', 0.2);   // 長期予測重視
  }

  /**
   * 全モデルを学習
   */
  async train(trainingData: TrainingData): Promise<Record<string, any>> {
    try {
      console.log('Starting ensemble model training...');
      
      const results: Record<string, any> = {};
      
      // 各モデルを個別に学習
      for (const [modelName, model] of this.models) {
        try {
          console.log(`Training ${modelName}...`);
          
          // モデルごとに異なるデータセットを作成
          const modelData = this.prepareModelData(trainingData, modelName);
          
          const metrics = await model.train(modelData);
          results[modelName] = metrics;
          
          console.log(`${modelName} training completed:`, metrics);
        } catch (error) {
          console.error(`Failed to train ${modelName}:`, error);
          results[modelName] = { error: error.message };
        }
      }

      // 重みを動的に調整（簡易実装）
      this.adjustModelWeights(results);
      
      this.isTrained = true;
      console.log('Ensemble model training completed');
      
      return results;
    } catch (error) {
      console.error('Failed to train ensemble model:', error);
      throw error;
    }
  }

  /**
   * モデルごとにデータを準備
   */
  private prepareModelData(trainingData: TrainingData, modelName: string): TrainingData {
    // モデルごとに異なるデータ処理を適用
    switch (modelName) {
      case 'lstm_short':
        // 短期予測用：最近のデータを重視
        return {
          features: trainingData.features.slice(-Math.floor(trainingData.features.length * 0.7)),
          targets: trainingData.targets.slice(-Math.floor(trainingData.targets.length * 0.7)),
          timestamps: trainingData.timestamps.slice(-Math.floor(trainingData.timestamps.length * 0.7)),
        };
        
      case 'lstm_medium':
        // 中期予測用：全データを使用
        return trainingData;
        
      case 'lstm_long':
        // 長期予測用：より多くの履歴データを使用
        return {
          features: trainingData.features,
          targets: trainingData.targets,
          timestamps: trainingData.timestamps,
        };
        
      default:
        return trainingData;
    }
  }

  /**
   * モデルの重みを動的に調整
   */
  private adjustModelWeights(trainingResults: Record<string, any>): void {
    try {
      // 各モデルの性能に基づいて重みを調整
      const weights: Record<string, number> = {};
      let totalWeight = 0;

      for (const [modelName, result] of Object.entries(trainingResults)) {
        if (result.error) {
          // エラーが発生したモデルの重みを下げる
          weights[modelName] = 0.1;
        } else {
          // 損失が低いほど重みを高くする
          const performance = 1 / (result.loss + 0.001); // 0除算を防ぐ
          weights[modelName] = performance;
        }
        totalWeight += weights[modelName];
      }

      // 重みを正規化
      for (const [modelName, weight] of Object.entries(weights)) {
        const normalizedWeight = weight / totalWeight;
        this.modelWeights.set(modelName, normalizedWeight);
        console.log(`${modelName} weight: ${normalizedWeight.toFixed(3)}`);
      }
    } catch (error) {
      console.error('Failed to adjust model weights:', error);
    }
  }

  /**
   * アンサンブル予測を実行
   */
  async predict(inputData: number[][]): Promise<PredictionResult> {
    try {
      if (!this.isTrained) {
        throw new Error('Ensemble model not trained');
      }

      console.log('Making ensemble prediction...');
      
      const predictions: ModelPrediction[] = [];
      
      // 各モデルで予測を実行
      for (const [modelName, model] of this.models) {
        try {
          const prediction = await model.predict(inputData);
          const weight = this.modelWeights.get(modelName) || 0;
          
          predictions.push({
            modelName,
            prediction,
            weight,
          });
          
          console.log(`${modelName} prediction: ${prediction.predictedPrice.toFixed(2)} (weight: ${weight.toFixed(3)})`);
        } catch (error) {
          console.error(`Failed to get prediction from ${modelName}:`, error);
        }
      }

      if (predictions.length === 0) {
        throw new Error('No valid predictions available');
      }

      // 重み付き平均で最終予測を計算
      const ensembleResult = this.combinePredictions(predictions);
      
      console.log(`Ensemble prediction: ${ensembleResult.predictedPrice.toFixed(2)} (confidence: ${ensembleResult.confidence.toFixed(3)})`);
      
      return ensembleResult;
    } catch (error) {
      console.error('Failed to make ensemble prediction:', error);
      throw error;
    }
  }

  /**
   * 複数の予測結果を組み合わせ
   */
  private combinePredictions(predictions: ModelPrediction[]): PredictionResult {
    let weightedPriceSum = 0;
    let weightedConfidenceSum = 0;
    let totalWeight = 0;
    
    const modelWeights: Record<string, number> = {};
    
    // 重み付き平均を計算
    for (const pred of predictions) {
      const weight = pred.weight;
      weightedPriceSum += pred.prediction.predictedPrice * weight;
      weightedConfidenceSum += pred.prediction.confidence * weight;
      totalWeight += weight;
      modelWeights[pred.modelName] = weight;
    }
    
    const finalPrice = weightedPriceSum / totalWeight;
    const finalConfidence = weightedConfidenceSum / totalWeight;
    
    // トレンドを決定
    const currentPrice = predictions[0].prediction.predictedPrice; // 簡易実装
    const trend = finalPrice > currentPrice ? 'up' : 
                 finalPrice < currentPrice ? 'down' : 'neutral';
    
    // 信頼区間を計算
    const variance = predictions.reduce((sum, pred) => {
      const diff = pred.prediction.predictedPrice - finalPrice;
      return sum + (diff * diff * pred.weight);
    }, 0) / totalWeight;
    
    const stdDev = Math.sqrt(variance);
    const margin = stdDev * (1 - finalConfidence);
    
    return {
      predictedPrice: finalPrice,
      confidence: finalConfidence,
      trend,
      confidenceInterval: {
        lower: finalPrice - margin,
        upper: finalPrice + margin,
      },
      timestamp: new Date(),
      modelWeights,
    };
  }

  /**
   * モデルの性能を評価
   */
  async evaluate(testData: TrainingData): Promise<Record<string, any>> {
    try {
      console.log('Evaluating ensemble model...');
      
      const results: Record<string, any> = {};
      
      for (const [modelName, model] of this.models) {
        try {
          const testMetrics = await this.evaluateModel(model, testData);
          results[modelName] = testMetrics;
        } catch (error) {
          console.error(`Failed to evaluate ${modelName}:`, error);
          results[modelName] = { error: error.message };
        }
      }
      
      return results;
    } catch (error) {
      console.error('Failed to evaluate ensemble model:', error);
      throw error;
    }
  }

  /**
   * 個別モデルの性能を評価
   */
  private async evaluateModel(model: LSTMPredictor, testData: TrainingData): Promise<any> {
    // 簡易的な評価実装
    const predictions: number[] = [];
    const actuals: number[] = [];
    
    // テストデータの一部で予測を実行
    const testSize = Math.min(10, testData.features.length);
    
    for (let i = 0; i < testSize; i++) {
      try {
        const prediction = await model.predict(testData.features.slice(0, i + 60));
        predictions.push(prediction.predictedPrice);
        actuals.push(testData.targets[i + 60]);
      } catch (error) {
        // エラーが発生した場合はスキップ
        continue;
      }
    }
    
    if (predictions.length === 0) {
      return { error: 'No valid predictions' };
    }
    
    // MAE（平均絶対誤差）を計算
    const mae = predictions.reduce((sum, pred, index) => 
      sum + Math.abs(pred - actuals[index]), 0) / predictions.length;
    
    // RMSE（二乗平均平方根誤差）を計算
    const mse = predictions.reduce((sum, pred, index) => 
      sum + Math.pow(pred - actuals[index], 2), 0) / predictions.length;
    const rmse = Math.sqrt(mse);
    
    return {
      mae,
      rmse,
      predictions: predictions.length,
    };
  }

  /**
   * モデルの状態を取得
   */
  getModelStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [modelName, model] of this.models) {
      status[modelName] = {
        ...model.getModelStatus(),
        weight: this.modelWeights.get(modelName) || 0,
      };
    }
    
    return {
      ensemble: {
        trained: this.isTrained,
        modelCount: this.models.size,
      },
      models: status,
    };
  }

  /**
   * モデルを破棄
   */
  dispose(): void {
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
    this.modelWeights.clear();
    this.isTrained = false;
  }
}
