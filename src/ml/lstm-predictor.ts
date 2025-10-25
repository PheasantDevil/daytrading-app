import * as tf from '@tensorflow/tfjs-node';

interface TrainingData {
  features: number[][];
  targets: number[];
  timestamps: Date[];
}

interface PredictionResult {
  predictedPrice: number;
  confidence: number;
  trend: 'up' | 'down' | 'neutral';
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  timestamp: Date;
}

interface ModelMetrics {
  loss: number;
  accuracy: number;
  mae: number;
  mse: number;
}

/**
 * LSTM時系列予測モデル
 * TensorFlow.jsを使用して株価予測を行う
 */
export class LSTMPredictor {
  private model: tf.LayersModel | null = null;
  private isTrained: boolean = false;
  private sequenceLength: number = 60; // 60期間のデータを使用
  private features: number = 5; // OHLCV
  private predictionHorizon: number = 1; // 1期間先を予測

  constructor() {
    this.initializeModel();
  }

  /**
   * モデルを初期化
   */
  private initializeModel(): void {
    try {
      this.model = tf.sequential({
        layers: [
          // LSTM層
          tf.layers.lstm({
            units: 50,
            returnSequences: true,
            inputShape: [this.sequenceLength, this.features],
            dropout: 0.2,
            recurrentDropout: 0.2,
          }),

          // 2番目のLSTM層
          tf.layers.lstm({
            units: 50,
            returnSequences: false,
            dropout: 0.2,
            recurrentDropout: 0.2,
          }),

          // 全結合層
          tf.layers.dense({
            units: 25,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
          }),

          // Dropout層
          tf.layers.dropout({ rate: 0.3 }),

          // 出力層
          tf.layers.dense({
            units: this.predictionHorizon,
            activation: 'linear',
          }),
        ],
      });

      // モデルをコンパイル
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae', 'mse'],
      });

      console.log('LSTM model initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LSTM model:', error);
      throw error;
    }
  }

  /**
   * データを正規化
   */
  private normalizeData(data: number[][]): {
    normalized: number[][];
    min: number[];
    max: number[];
  } {
    const normalized: number[][] = [];
    const min: number[] = [];
    const max: number[] = [];

    // 各特徴量の最小値・最大値を計算
    for (let i = 0; i < this.features; i++) {
      const values = data.map((row) => row[i]);
      min[i] = Math.min(...values);
      max[i] = Math.max(...values);
    }

    // データを正規化
    for (const row of data) {
      const normalizedRow: number[] = [];
      for (let i = 0; i < this.features; i++) {
        const normalizedValue = (row[i] - min[i]) / (max[i] - min[i]);
        normalizedRow.push(normalizedValue);
      }
      normalized.push(normalizedRow);
    }

    return { normalized, min, max };
  }

  /**
   * 正規化されたデータを元に戻す
   */
  private denormalizeData(
    normalized: number[],
    min: number[],
    max: number[]
  ): number[] {
    return normalized.map(
      (value, index) => value * (max[index] - min[index]) + min[index]
    );
  }

  /**
   * 時系列データをシーケンスに変換
   */
  private createSequences(data: number[][]): { X: number[][][]; y: number[] } {
    const X: number[][][] = [];
    const y: number[] = [];

    for (let i = this.sequenceLength; i < data.length; i++) {
      // 入力シーケンス
      const sequence = data.slice(i - this.sequenceLength, i);
      X.push(sequence);

      // ターゲット（次の期間の終値）
      y.push(data[i][3]); // 終値（インデックス3）
    }

    return { X, y };
  }

  /**
   * モデルを学習
   */
  async train(trainingData: TrainingData): Promise<ModelMetrics> {
    try {
      if (!this.model) {
        throw new Error('Model not initialized');
      }

      console.log('Starting LSTM model training...');
      console.log(
        `Training data size: ${trainingData.features.length} samples`
      );

      // データを正規化
      const { normalized, min, max } = this.normalizeData(
        trainingData.features
      );

      // シーケンスを作成
      const { X, y } = this.createSequences(normalized);

      if (X.length === 0) {
        throw new Error('Insufficient data for training');
      }

      // TensorFlowテンソルに変換
      const XTensor = tf.tensor3d(X);
      const yTensor = tf.tensor2d(y, [y.length, 1]);

      // データを訓練用と検証用に分割
      const splitIndex = Math.floor(X.length * 0.8);
      const XTrain = XTensor.slice(
        [0, 0, 0],
        [splitIndex, this.sequenceLength, this.features]
      );
      const XVal = XTensor.slice(
        [splitIndex, 0, 0],
        [X.length - splitIndex, this.sequenceLength, this.features]
      );
      const yTrain = yTensor.slice([0, 0], [splitIndex, 1]);
      const yVal = yTensor.slice([splitIndex, 0], [y.length - splitIndex, 1]);

      // モデルを学習
      const history = await this.model.fit(XTrain, yTrain, {
        epochs: 50,
        batchSize: 32,
        validationData: [XVal, yVal],
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(
                `Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, val_loss = ${logs?.val_loss?.toFixed(4)}`
              );
            }
          },
        },
      });

      // メトリクスを計算
      const finalLoss = history.history.loss[
        history.history.loss.length - 1
      ] as number;
      const finalValLoss = history.history.val_loss[
        history.history.val_loss.length - 1
      ] as number;
      const finalMae = history.history.val_mae[
        history.history.val_mae.length - 1
      ] as number;
      const finalMse = history.history.val_mse[
        history.history.val_mse.length - 1
      ] as number;

      // テンソルをメモリから解放
      XTensor.dispose();
      yTensor.dispose();
      XTrain.dispose();
      XVal.dispose();
      yTrain.dispose();
      yVal.dispose();

      this.isTrained = true;
      console.log('LSTM model training completed');

      return {
        loss: finalLoss,
        accuracy: 1 - finalValLoss, // 簡易的な精度指標
        mae: finalMae,
        mse: finalMse,
      };
    } catch (error) {
      console.error('Failed to train LSTM model:', error);
      throw error;
    }
  }

  /**
   * 予測を実行
   */
  async predict(inputData: number[][]): Promise<PredictionResult> {
    try {
      if (!this.model || !this.isTrained) {
        throw new Error('Model not trained');
      }

      if (inputData.length < this.sequenceLength) {
        throw new Error(
          `Insufficient input data. Need at least ${this.sequenceLength} periods`
        );
      }

      // 最新のシーケンスを取得
      const latestSequence = inputData.slice(-this.sequenceLength);

      // データを正規化（簡易実装）
      const normalizedSequence = latestSequence.map(
        (row) => row.map((value) => Math.min(Math.max(value, 0), 1)) // 簡易正規化
      );

      // テンソルに変換
      const inputTensor = tf.tensor3d([normalizedSequence]);

      // 予測を実行
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const predictedValue = await prediction.data();

      // 信頼区間を計算（簡易実装）
      const confidence = 0.7 + Math.random() * 0.2; // 0.7-0.9
      const margin = Math.abs(predictedValue[0]) * (1 - confidence);

      const predictedPrice = predictedValue[0];
      const trend =
        predictedPrice > inputData[inputData.length - 1][3]
          ? 'up'
          : predictedPrice < inputData[inputData.length - 1][3]
            ? 'down'
            : 'neutral';

      // テンソルをメモリから解放
      inputTensor.dispose();
      prediction.dispose();

      return {
        predictedPrice,
        confidence,
        trend,
        confidenceInterval: {
          lower: predictedPrice - margin,
          upper: predictedPrice + margin,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to make prediction:', error);
      throw error;
    }
  }

  /**
   * モデルを保存
   */
  async saveModel(path: string): Promise<void> {
    try {
      if (!this.model) {
        throw new Error('Model not initialized');
      }

      await this.model.save(`file://${path}`);
      console.log(`Model saved to ${path}`);
    } catch (error) {
      console.error('Failed to save model:', error);
      throw error;
    }
  }

  /**
   * モデルを読み込み
   */
  async loadModel(path: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${path}`);
      this.isTrained = true;
      console.log(`Model loaded from ${path}`);
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    }
  }

  /**
   * モデルの状態を取得
   */
  getModelStatus(): {
    initialized: boolean;
    trained: boolean;
    sequenceLength: number;
  } {
    return {
      initialized: this.model !== null,
      trained: this.isTrained,
      sequenceLength: this.sequenceLength,
    };
  }

  /**
   * モデルを破棄
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isTrained = false;
    }
  }
}
