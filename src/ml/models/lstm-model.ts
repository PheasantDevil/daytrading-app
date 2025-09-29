/**
 * LSTM（Long Short-Term Memory）モデル
 * 時系列データの予測に特化した深層学習モデル
 */

export interface LSTMConfig {
  sequenceLength: number; // 入力シーケンス長
  hiddenUnits: number; // 隠れ層のユニット数
  dropout: number; // ドロップアウト率
  learningRate: number; // 学習率
  epochs: number; // エポック数
  batchSize: number; // バッチサイズ
}

export interface LSTMPrediction {
  prediction: number;
  confidence: number;
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  volatility: number;
  nextPrices: number[]; // 複数ステップ先の予測
}

export interface TrainingData {
  features: number[][]; // 入力特徴量
  targets: number[]; // 目標値
  timestamps: Date[]; // タイムスタンプ
}

export class LSTMModel {
  private config: LSTMConfig;
  private isTrained: boolean = false;
  private model: any = null;
  private scaler: any = null;
  private trainingHistory: any = null;

  constructor(config: LSTMConfig) {
    this.config = config;
  }

  /**
   * モデルを初期化
   */
  async initialize(): Promise<void> {
    try {
      // TensorFlow.jsを動的インポート
      const tf = await import('@tensorflow/tfjs');

      // シーケンシャルモデルを作成
      this.model = tf.sequential({
        layers: [
          // LSTM層
          tf.layers.lstm({
            units: this.config.hiddenUnits,
            returnSequences: true,
            inputShape: [this.config.sequenceLength, 1],
            dropout: this.config.dropout,
            recurrentDropout: this.config.dropout,
          }),

          // 2番目のLSTM層
          tf.layers.lstm({
            units: Math.floor(this.config.hiddenUnits / 2),
            returnSequences: false,
            dropout: this.config.dropout,
            recurrentDropout: this.config.dropout,
          }),

          // ドロップアウト層
          tf.layers.dropout({
            rate: this.config.dropout,
          }),

          // 全結合層
          tf.layers.dense({
            units: 32,
            activation: 'relu',
          }),

          // 出力層
          tf.layers.dense({
            units: 1,
            activation: 'linear',
          }),
        ],
      });

      // モデルをコンパイル
      this.model.compile({
        optimizer: tf.train.adam(this.config.learningRate),
        loss: 'meanSquaredError',
        metrics: ['mae', 'mse'],
      });

      console.log('✅ LSTMモデル初期化完了');
    } catch (error) {
      console.error('❌ LSTMモデル初期化エラー:', error);
      throw error;
    }
  }

  /**
   * データを前処理
   */
  private preprocessData(data: number[]): {
    features: number[][];
    targets: number[];
    scaler: any;
  } {
    // データを正規化
    const min = Math.min(...data);
    const max = Math.max(...data);
    const scaledData = data.map((value) => (value - min) / (max - min));

    // シーケンスデータを作成
    const features: number[][] = [];
    const targets: number[] = [];

    for (let i = this.config.sequenceLength; i < scaledData.length; i++) {
      features.push(scaledData.slice(i - this.config.sequenceLength, i));
      targets.push(scaledData[i]);
    }

    return {
      features,
      targets,
      scaler: { min, max },
    };
  }

  /**
   * モデルを訓練
   */
  async train(data: number[]): Promise<void> {
    if (!this.model) {
      await this.initialize();
    }

    try {
      console.log('🔄 LSTMモデル訓練開始...');

      // データを前処理
      const { features, targets, scaler } = this.preprocessData(data);
      this.scaler = scaler;

      if (features.length === 0) {
        throw new Error('訓練データが不足しています');
      }

      // TensorFlow.jsを動的インポート
      const tf = await import('@tensorflow/tfjs');

      // データをテンソルに変換
      const featureTensor = tf.tensor3d(
        features.map((seq) => seq.map((val) => [val])),
        [features.length, this.config.sequenceLength, 1]
      );

      const targetTensor = tf.tensor2d(
        targets.map((val) => [val]),
        [targets.length, 1]
      );

      // 訓練を実行
      this.trainingHistory = await this.model.fit(featureTensor, targetTensor, {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationSplit: 0.2,
        shuffle: true,
        verbose: 1,
      });

      // メモリを解放
      featureTensor.dispose();
      targetTensor.dispose();

      this.isTrained = true;
      console.log('✅ LSTMモデル訓練完了');
    } catch (error) {
      console.error('❌ LSTMモデル訓練エラー:', error);
      throw error;
    }
  }

  /**
   * 予測を実行
   */
  async predict(inputData: number[]): Promise<LSTMPrediction> {
    if (!this.isTrained || !this.model || !this.scaler) {
      throw new Error('モデルが訓練されていません');
    }

    try {
      // TensorFlow.jsを動的インポート
      const tf = await import('@tensorflow/tfjs');

      // 入力データを正規化
      const normalizedData = inputData.map(
        (value) =>
          (value - this.scaler.min) / (this.scaler.max - this.scaler.min)
      );

      // 最後のシーケンスを取得
      const sequence = normalizedData.slice(-this.config.sequenceLength);

      // テンソルに変換
      const inputTensor = tf.tensor3d(
        [sequence.map((val) => [val])],
        [1, this.config.sequenceLength, 1]
      );

      // 予測を実行
      const prediction = await this.model.predict(inputTensor);
      const predictionArray = await prediction.data();

      // 予測値を逆正規化
      const denormalizedPrediction =
        predictionArray[0] * (this.scaler.max - this.scaler.min) +
        this.scaler.min;

      // メモリを解放
      inputTensor.dispose();
      prediction.dispose();

      // 信頼度を計算（簡略化）
      const confidence = this.calculateConfidence(
        inputData,
        denormalizedPrediction
      );

      // トレンドを判定
      const trend = this.determineTrend(inputData, denormalizedPrediction);

      // ボラティリティを計算
      const volatility = this.calculateVolatility(inputData);

      // 複数ステップ先の予測
      const nextPrices = await this.predictMultipleSteps(inputData, 5);

      return {
        prediction: denormalizedPrediction,
        confidence,
        trend,
        volatility,
        nextPrices,
      };
    } catch (error) {
      console.error('❌ LSTM予測エラー:', error);
      throw error;
    }
  }

  /**
   * 複数ステップ先の予測
   */
  private async predictMultipleSteps(
    inputData: number[],
    steps: number
  ): Promise<number[]> {
    const predictions: number[] = [];
    let currentData = [...inputData];

    for (let i = 0; i < steps; i++) {
      try {
        const prediction = await this.predict(currentData);
        predictions.push(prediction.prediction);
        currentData.push(prediction.prediction);
        currentData = currentData.slice(-this.config.sequenceLength);
      } catch (error) {
        console.error(`複数ステップ予測エラー (ステップ ${i}):`, error);
        break;
      }
    }

    return predictions;
  }

  /**
   * 信頼度を計算
   */
  private calculateConfidence(inputData: number[], prediction: number): number {
    // 簡略化された信頼度計算
    const recentVolatility = this.calculateVolatility(inputData);
    const priceChange = Math.abs(prediction - inputData[inputData.length - 1]);
    const changePercent = (priceChange / inputData[inputData.length - 1]) * 100;

    // ボラティリティが低く、変化率が適度な場合に高い信頼度
    let confidence = 100;
    confidence -= recentVolatility * 2; // ボラティリティが高いと信頼度低下
    confidence -= Math.min(changePercent * 5, 50); // 変化率が大きいと信頼度低下

    return Math.max(confidence, 0);
  }

  /**
   * トレンドを判定
   */
  private determineTrend(
    inputData: number[],
    prediction: number
  ): 'UP' | 'DOWN' | 'SIDEWAYS' {
    const currentPrice = inputData[inputData.length - 1];
    const changePercent = ((prediction - currentPrice) / currentPrice) * 100;

    if (changePercent > 1) return 'UP';
    if (changePercent < -1) return 'DOWN';
    return 'SIDEWAYS';
  }

  /**
   * ボラティリティを計算
   */
  private calculateVolatility(data: number[]): number {
    if (data.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push((data[i] - data[i - 1]) / data[i - 1]);
    }

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) /
      returns.length;

    return Math.sqrt(variance) * 100; // パーセンテージで返す
  }

  /**
   * モデルを保存
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('モデルが初期化されていません');
    }

    try {
      // TensorFlow.jsを動的インポート
      const tf = await import('@tensorflow/tfjs');

      await this.model.save(`file://${path}`);
      console.log(`✅ モデルを保存しました: ${path}`);
    } catch (error) {
      console.error('❌ モデル保存エラー:', error);
      throw error;
    }
  }

  /**
   * モデルを読み込み
   */
  async loadModel(path: string): Promise<void> {
    try {
      // TensorFlow.jsを動的インポート
      const tf = await import('@tensorflow/tfjs');

      this.model = await tf.loadLayersModel(`file://${path}`);
      this.isTrained = true;
      console.log(`✅ モデルを読み込みました: ${path}`);
    } catch (error) {
      console.error('❌ モデル読み込みエラー:', error);
      throw error;
    }
  }

  /**
   * 訓練履歴を取得
   */
  getTrainingHistory(): any {
    return this.trainingHistory;
  }

  /**
   * モデルが訓練済みかチェック
   */
  isModelTrained(): boolean {
    return this.isTrained;
  }

  /**
   * モデル設定を取得
   */
  getConfig(): LSTMConfig {
    return { ...this.config };
  }

  /**
   * モデル設定を更新
   */
  updateConfig(newConfig: Partial<LSTMConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
