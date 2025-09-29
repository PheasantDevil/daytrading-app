/**
 * オンライン学習サービス
 * 新しいデータでの継続学習とモデル更新
 */

import { LSTMModel } from './models/lstm-model';

export interface OnlineLearningConfig {
  updateInterval: number; // ミリ秒
  batchSize: number; // バッチサイズ
  learningRate: number; // 学習率
  minDataPoints: number; // 最小データポイント数
  maxDataPoints: number; // 最大データポイント数
  retrainThreshold: number; // 再訓練閾値（精度低下率）
}

export interface LearningMetrics {
  accuracy: number;
  loss: number;
  mae: number;
  mse: number;
  lastUpdate: Date;
  dataPoints: number;
}

export interface ModelUpdate {
  modelId: string;
  updateType: 'INCREMENTAL' | 'RETRAIN' | 'RESET';
  metrics: LearningMetrics;
  timestamp: Date;
}

export class OnlineLearner {
  private config: OnlineLearningConfig;
  private models: Map<string, LSTMModel> = new Map();
  private dataBuffers: Map<string, number[]> = new Map();
  private metrics: Map<string, LearningMetrics> = new Map();
  private updateCallbacks: Array<(update: ModelUpdate) => void> = [];
  private isLearning: boolean = false;
  private learningInterval: NodeJS.Timeout | null = null;

  constructor(config: OnlineLearningConfig) {
    this.config = config;
  }

  /**
   * オンライン学習を開始
   */
  async startLearning(): Promise<void> {
    if (this.isLearning) {
      console.log('⚠️ オンライン学習は既に開始されています');
      return;
    }

    console.log('🔄 オンライン学習開始...');
    this.isLearning = true;

    // 定期更新を開始
    this.learningInterval = setInterval(async () => {
      await this.performLearningCycle();
    }, this.config.updateInterval);
  }

  /**
   * オンライン学習を停止
   */
  stopLearning(): void {
    if (!this.isLearning) {
      console.log('⚠️ オンライン学習は開始されていません');
      return;
    }

    console.log('⏹️ オンライン学習停止');
    this.isLearning = false;

    if (this.learningInterval) {
      clearInterval(this.learningInterval);
      this.learningInterval = null;
    }
  }

  /**
   * モデルを登録
   */
  registerModel(modelId: string, model: LSTMModel): void {
    this.models.set(modelId, model);
    this.dataBuffers.set(modelId, []);
    this.metrics.set(modelId, {
      accuracy: 0,
      loss: 0,
      mae: 0,
      mse: 0,
      lastUpdate: new Date(),
      dataPoints: 0,
    });
  }

  /**
   * 新しいデータを追加
   */
  addData(modelId: string, newData: number[]): void {
    const buffer = this.dataBuffers.get(modelId);
    if (!buffer) {
      console.warn(`⚠️ モデルが見つかりません: ${modelId}`);
      return;
    }

    // 新しいデータを追加
    buffer.push(...newData);

    // 最大データポイント数を超えた場合は古いデータを削除
    if (buffer.length > this.config.maxDataPoints) {
      buffer.splice(0, buffer.length - this.config.maxDataPoints);
    }

    console.log(`📊 ${modelId} にデータを追加: ${newData.length}ポイント`);
  }

  /**
   * 学習サイクルを実行
   */
  private async performLearningCycle(): Promise<void> {
    const updatePromises = Array.from(this.models.keys()).map((modelId) =>
      this.updateModel(modelId)
    );

    await Promise.allSettled(updatePromises);
  }

  /**
   * 個別モデルを更新
   */
  private async updateModel(modelId: string): Promise<void> {
    try {
      const model = this.models.get(modelId);
      const buffer = this.dataBuffers.get(modelId);
      const currentMetrics = this.metrics.get(modelId);

      if (!model || !buffer || !currentMetrics) {
        return;
      }

      // 最小データポイント数をチェック
      if (buffer.length < this.config.minDataPoints) {
        return;
      }

      // モデルが訓練済みかチェック
      if (!model.isModelTrained()) {
        console.log(`🔄 ${modelId} 初回訓練実行...`);
        await model.train(buffer);
        await this.updateMetrics(modelId, 'RESET');
        return;
      }

      // 増分学習を実行
      const newMetrics = await this.performIncrementalLearning(modelId, buffer);

      // 精度低下をチェック
      const accuracyDrop = currentMetrics.accuracy - newMetrics.accuracy;
      if (accuracyDrop > this.config.retrainThreshold) {
        console.log(`🔄 ${modelId} 精度低下検出、再訓練実行...`);
        await model.train(buffer);
        await this.updateMetrics(modelId, 'RETRAIN');
      } else {
        await this.updateMetrics(modelId, 'INCREMENTAL', newMetrics);
      }
    } catch (error) {
      console.error(`❌ ${modelId} モデル更新エラー:`, error);
    }
  }

  /**
   * 増分学習を実行
   */
  private async performIncrementalLearning(
    modelId: string,
    data: number[]
  ): Promise<LearningMetrics> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`モデルが見つかりません: ${modelId}`);
    }

    // 最新のデータで予測を実行
    const recentData = data.slice(-this.config.batchSize);
    const predictions: number[] = [];
    const actuals: number[] = [];

    for (let i = 0; i < recentData.length - 1; i++) {
      try {
        const inputData = data.slice(i, i + model.getConfig().sequenceLength);
        if (inputData.length < model.getConfig().sequenceLength) continue;

        const prediction = await model.predict(inputData);
        predictions.push(prediction.prediction);
        actuals.push(recentData[i + 1]);
      } catch (error) {
        console.error(`予測エラー:`, error);
      }
    }

    // メトリクスを計算
    const accuracy = this.calculateAccuracy(predictions, actuals);
    const mae = this.calculateMAE(predictions, actuals);
    const mse = this.calculateMSE(predictions, actuals);
    const loss = mse; // 簡略化

    return {
      accuracy,
      loss,
      mae,
      mse,
      lastUpdate: new Date(),
      dataPoints: data.length,
    };
  }

  /**
   * メトリクスを更新
   */
  private async updateMetrics(
    modelId: string,
    updateType: 'INCREMENTAL' | 'RETRAIN' | 'RESET',
    newMetrics?: LearningMetrics
  ): Promise<void> {
    const currentMetrics = this.metrics.get(modelId);
    if (!currentMetrics) return;

    const updatedMetrics: LearningMetrics = newMetrics || {
      accuracy: 0,
      loss: 0,
      mae: 0,
      mse: 0,
      lastUpdate: new Date(),
      dataPoints: currentMetrics.dataPoints,
    };

    this.metrics.set(modelId, updatedMetrics);

    // コールバックを通知
    const update: ModelUpdate = {
      modelId,
      updateType,
      metrics: updatedMetrics,
      timestamp: new Date(),
    };

    this.notifyCallbacks(update);
  }

  /**
   * 精度を計算
   */
  private calculateAccuracy(predictions: number[], actuals: number[]): number {
    if (predictions.length === 0) return 0;

    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      const predDirection = predictions[i] > actuals[i] ? 1 : -1;
      const actualDirection =
        actuals[i] > (actuals[i - 1] || actuals[i]) ? 1 : -1;
      if (predDirection === actualDirection) correct++;
    }
    return (correct / predictions.length) * 100;
  }

  /**
   * 平均絶対誤差を計算
   */
  private calculateMAE(predictions: number[], actuals: number[]): number {
    if (predictions.length === 0) return 0;

    const errors = predictions.map((pred, i) => Math.abs(pred - actuals[i]));
    return errors.reduce((sum, error) => sum + error, 0) / errors.length;
  }

  /**
   * 平均二乗誤差を計算
   */
  private calculateMSE(predictions: number[], actuals: number[]): number {
    if (predictions.length === 0) return 0;

    const errors = predictions.map((pred, i) => Math.pow(pred - actuals[i], 2));
    return errors.reduce((sum, error) => sum + error, 0) / errors.length;
  }

  /**
   * 更新コールバックを登録
   */
  onUpdate(callback: (update: ModelUpdate) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * コールバックを通知
   */
  private notifyCallbacks(update: ModelUpdate): void {
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(update);
      } catch (error) {
        console.error('コールバック実行エラー:', error);
      }
    });
  }

  /**
   * モデルのメトリクスを取得
   */
  getMetrics(modelId: string): LearningMetrics | null {
    return this.metrics.get(modelId) || null;
  }

  /**
   * 全モデルのメトリクスを取得
   */
  getAllMetrics(): Map<string, LearningMetrics> {
    return new Map(this.metrics);
  }

  /**
   * データバッファを取得
   */
  getDataBuffer(modelId: string): number[] {
    return this.dataBuffers.get(modelId) || [];
  }

  /**
   * 学習状態を取得
   */
  isLearningActive(): boolean {
    return this.isLearning;
  }

  /**
   * 学習設定を更新
   */
  updateConfig(newConfig: Partial<OnlineLearningConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 学習設定を取得
   */
  getConfig(): OnlineLearningConfig {
    return { ...this.config };
  }

  /**
   * モデルを削除
   */
  removeModel(modelId: string): void {
    this.models.delete(modelId);
    this.dataBuffers.delete(modelId);
    this.metrics.delete(modelId);
  }

  /**
   * 全モデルをクリア
   */
  clearAllModels(): void {
    this.models.clear();
    this.dataBuffers.clear();
    this.metrics.clear();
  }

  /**
   * 学習履歴を取得
   */
  getLearningHistory(): ModelUpdate[] {
    // 簡略化された実装
    return [];
  }

  /**
   * モデル性能を評価
   */
  async evaluateModelPerformance(modelId: string): Promise<{
    overallScore: number;
    accuracy: number;
    stability: number;
    adaptability: number;
  }> {
    const metrics = this.metrics.get(modelId);
    if (!metrics) {
      return {
        overallScore: 0,
        accuracy: 0,
        stability: 0,
        adaptability: 0,
      };
    }

    const accuracy = metrics.accuracy;
    const stability = Math.max(0, 100 - metrics.mae * 10); // 簡略化
    const adaptability = Math.max(0, 100 - metrics.mse * 5); // 簡略化
    const overallScore = (accuracy + stability + adaptability) / 3;

    return {
      overallScore,
      accuracy,
      stability,
      adaptability,
    };
  }
}
