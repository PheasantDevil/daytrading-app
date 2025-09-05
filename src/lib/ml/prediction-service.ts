import { prisma } from '../database';
import { redis } from '../redis';
import { FeatureEngineering, MLFeatures } from './feature-engineering';
import { LinearRegressionPredictor } from './models/linear-regression';
import { RandomForestPredictor } from './models/random-forest';
import { StockPrice } from '@/types';

export interface PredictionResult {
  modelName: string;
  predictedPrice: number;
  confidence: number;
  timestamp: Date;
  features: number[];
}

export interface ModelPerformance {
  modelName: string;
  mse: number;
  mae: number;
  r2: number;
  lastUpdated: Date;
}

export class PredictionService {
  private static instance: PredictionService;
  private linearRegression: LinearRegressionPredictor;
  private randomForest: RandomForestPredictor;
  private isTraining = false;

  private constructor() {
    this.linearRegression = new LinearRegressionPredictor();
    this.randomForest = new RandomForestPredictor();
  }

  public static getInstance(): PredictionService {
    if (!PredictionService.instance) {
      PredictionService.instance = new PredictionService();
    }
    return PredictionService.instance;
  }

  /**
   * 株価データから特徴量を生成
   */
  private async generateFeatures(stockId: number, days: number = 100): Promise<MLFeatures[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const prices = await prisma.stockPrice.findMany({
      where: {
        stockId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    if (prices.length < 50) {
      throw new Error('Insufficient data for feature generation');
    }

    return FeatureEngineering.generateMLFeatures(prices);
  }

  /**
   * モデルを学習
   */
  async trainModels(stockId: number): Promise<void> {
    if (this.isTraining) {
      throw new Error('Training already in progress');
    }

    this.isTraining = true;
    console.log(`Training models for stock ${stockId}...`);

    try {
      const features = await this.generateFeatures(stockId, 200);
      
      if (features.length < 50) {
        throw new Error('Insufficient training data');
      }

      // データを学習用とテスト用に分割
      const splitIndex = Math.floor(features.length * 0.8);
      const trainingData = features.slice(0, splitIndex);
      const testData = features.slice(splitIndex);

      // 線形回帰モデルを学習
      console.log('Training Linear Regression...');
      this.linearRegression.train(trainingData);
      const lrPerformance = this.linearRegression.evaluate(testData);
      console.log('Linear Regression Performance:', lrPerformance);

      // ランダムフォレストモデルを学習
      console.log('Training Random Forest...');
      this.randomForest.train(trainingData, 50, 10, 2);
      const rfPerformance = this.randomForest.evaluate(testData);
      console.log('Random Forest Performance:', rfPerformance);

      // 性能を保存
      await this.saveModelPerformance('linear_regression', lrPerformance);
      await this.saveModelPerformance('random_forest', rfPerformance);

      console.log('Model training completed');
    } catch (error) {
      console.error('Error training models:', error);
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * 予測を実行
   */
  async predict(stockId: number): Promise<PredictionResult[]> {
    try {
      const features = await this.generateFeatures(stockId, 50);
      
      if (features.length === 0) {
        throw new Error('No features available for prediction');
      }

      const latestFeatures = features[features.length - 1];
      const results: PredictionResult[] = [];

      // 線形回帰で予測
      try {
        const lrResult = this.linearRegression.predict(latestFeatures);
        results.push({
          modelName: 'linear_regression',
          predictedPrice: lrResult.predicted,
          confidence: lrResult.confidence,
          timestamp: new Date(),
          features: lrResult.features,
        });
      } catch (error) {
        console.error('Linear regression prediction failed:', error);
      }

      // ランダムフォレストで予測
      try {
        const rfResult = this.randomForest.predict(latestFeatures);
        results.push({
          modelName: 'random_forest',
          predictedPrice: rfResult.predicted,
          confidence: rfResult.confidence,
          timestamp: new Date(),
          features: rfResult.features,
        });
      } catch (error) {
        console.error('Random forest prediction failed:', error);
      }

      // 予測結果をデータベースに保存
      for (const result of results) {
        await this.savePrediction(stockId, result);
      }

      return results;
    } catch (error) {
      console.error('Error making prediction:', error);
      throw error;
    }
  }

  /**
   * 予測結果をデータベースに保存
   */
  private async savePrediction(stockId: number, result: PredictionResult): Promise<void> {
    try {
      await prisma.prediction.create({
        data: {
          stockId,
          predictedPrice: result.predictedPrice,
          confidenceScore: result.confidence,
          modelName: result.modelName,
          predictionDate: result.timestamp,
        },
      });

      // Redisにキャッシュ
      await redis.setex(
        `prediction:${stockId}:${result.modelName}`,
        3600, // 1時間キャッシュ
        JSON.stringify(result)
      );
    } catch (error) {
      console.error('Error saving prediction:', error);
    }
  }

  /**
   * モデル性能を保存
   */
  private async saveModelPerformance(modelName: string, performance: { mse: number; mae: number; r2: number }): Promise<void> {
    try {
      await redis.setex(
        `model_performance:${modelName}`,
        86400, // 24時間キャッシュ
        JSON.stringify({
          ...performance,
          lastUpdated: new Date(),
        })
      );
    } catch (error) {
      console.error('Error saving model performance:', error);
    }
  }

  /**
   * キャッシュから予測結果を取得
   */
  async getCachedPrediction(stockId: number, modelName: string): Promise<PredictionResult | null> {
    try {
      const cached = await redis.get(`prediction:${stockId}:${modelName}`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Error getting cached prediction:', error);
      return null;
    }
  }

  /**
   * モデル性能を取得
   */
  async getModelPerformance(modelName: string): Promise<ModelPerformance | null> {
    try {
      const cached = await redis.get(`model_performance:${modelName}`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Error getting model performance:', error);
      return null;
    }
  }

  /**
   * 全モデルの性能を取得
   */
  async getAllModelPerformance(): Promise<ModelPerformance[]> {
    const models = ['linear_regression', 'random_forest'];
    const performances: ModelPerformance[] = [];

    for (const modelName of models) {
      const performance = await this.getModelPerformance(modelName);
      if (performance) {
        performances.push(performance);
      }
    }

    return performances;
  }

  /**
   * 予測履歴を取得
   */
  async getPredictionHistory(stockId: number, limit: number = 10): Promise<PredictionResult[]> {
    try {
      const predictions = await prisma.prediction.findMany({
        where: { stockId },
        orderBy: { predictionDate: 'desc' },
        take: limit,
      });

      return predictions.map(p => ({
        modelName: p.modelName || 'unknown',
        predictedPrice: p.predictedPrice,
        confidence: p.confidenceScore || 0,
        timestamp: p.predictionDate,
        features: [], // 履歴では特徴量は保存しない
      }));
    } catch (error) {
      console.error('Error getting prediction history:', error);
      return [];
    }
  }

  /**
   * 定期学習を開始
   */
  startPeriodicTraining(intervalHours: number = 24): void {
    console.log(`Starting periodic training every ${intervalHours} hours`);
    
    setInterval(async () => {
      try {
        // 全銘柄のモデルを再学習
        const stocks = await prisma.stock.findMany({
          select: { id: true },
        });

        for (const stock of stocks) {
          await this.trainModels(stock.id);
        }
      } catch (error) {
        console.error('Error in periodic training:', error);
      }
    }, intervalHours * 60 * 60 * 1000);
  }
}

export const predictionService = PredictionService.getInstance();
