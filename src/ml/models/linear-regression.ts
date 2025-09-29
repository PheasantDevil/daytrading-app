import { MLFeatures } from '../feature-engineering';

export interface LinearRegressionModel {
  coefficients: number[];
  intercept: number;
  featureNames: string[];
}

export interface PredictionResult {
  predicted: number;
  confidence: number;
  features: number[];
}

export class LinearRegressionPredictor {
  private model: LinearRegressionModel | null = null;

  /**
   * 特徴量を数値配列に変換
   */
  private extractFeatures(features: MLFeatures): number[] {
    const tech = features.technicalIndicators;
    return [
      tech.sma5,
      tech.sma10,
      tech.sma20,
      tech.sma50,
      tech.ema12,
      tech.ema26,
      tech.rsi,
      tech.macd,
      tech.macdSignal,
      tech.macdHistogram,
      tech.bollingerUpper,
      tech.bollingerLower,
      tech.bollingerMiddle,
      tech.volumeSma,
      tech.priceChange,
      tech.priceChangePercent,
      tech.volatility,
      features.price,
      features.volume,
    ];
  }

  /**
   * モデルが学習済みかどうか
   */
  isTrained(): boolean {
    return this.model !== null;
  }

  /**
   * モデルを学習
   */
  train(trainingData: MLFeatures[]): void {
    if (trainingData.length < 2) {
      throw new Error('Insufficient training data');
    }

    const X: number[][] = [];
    const y: number[] = [];

    // 特徴量とターゲットを分離
    for (const data of trainingData) {
      X.push(this.extractFeatures(data));
      y.push(data.target);
    }

    // 正規方程式を使用して線形回帰を解く
    const result = this.solveNormalEquation(X, y);

    this.model = {
      coefficients: result.coefficients,
      intercept: result.intercept,
      featureNames: [
        'sma5',
        'sma10',
        'sma20',
        'sma50',
        'ema12',
        'ema26',
        'rsi',
        'macd',
        'macdSignal',
        'macdHistogram',
        'bollingerUpper',
        'bollingerLower',
        'bollingerMiddle',
        'volumeSma',
        'priceChange',
        'priceChangePercent',
        'volatility',
        'price',
        'volume',
      ],
    };
  }

  /**
   * 正規方程式を解く
   */
  private solveNormalEquation(
    X: number[][],
    y: number[]
  ): { coefficients: number[]; intercept: number } {
    const n = X.length;
    const m = X[0].length;

    // バイアス項を追加
    const XWithBias = X.map((row) => [1, ...row]);

    // X^T * X を計算
    const XTX = this.matrixMultiply(this.transpose(XWithBias), XWithBias);

    // X^T * y を計算
    const XTy = this.matrixVectorMultiply(this.transpose(XWithBias), y);

    // (X^T * X)^-1 * X^T * y を計算
    const XTXInv = this.matrixInverse(XTX);
    const coefficients = this.matrixVectorMultiply(XTXInv, XTy);

    return {
      intercept: coefficients[0],
      coefficients: coefficients.slice(1),
    };
  }

  /**
   * 予測を実行
   */
  predict(features: MLFeatures): PredictionResult {
    if (!this.model) {
      throw new Error('Model not trained');
    }

    const featureVector = this.extractFeatures(features);
    let prediction = this.model.intercept;

    for (let i = 0; i < featureVector.length; i++) {
      prediction += featureVector[i] * this.model.coefficients[i];
    }

    // 信頼度を計算（簡易版）
    const confidence = Math.max(
      0,
      Math.min(1, 1 - Math.abs(prediction - features.price) / features.price)
    );

    return {
      predicted: prediction,
      confidence,
      features: featureVector,
    };
  }

  /**
   * 複数の予測を実行
   */
  predictBatch(features: MLFeatures[]): PredictionResult[] {
    return features.map((f) => this.predict(f));
  }

  /**
   * モデルの精度を評価
   */
  evaluate(testData: MLFeatures[]): { mse: number; mae: number; r2: number } {
    if (!this.model) {
      throw new Error('Model not trained');
    }

    const predictions = this.predictBatch(testData);
    const actual = testData.map((d) => d.target);
    const predicted = predictions.map((p) => p.predicted);

    // 平均二乗誤差
    const mse =
      predictions.reduce(
        (sum, p, i) => sum + Math.pow(p.predicted - actual[i], 2),
        0
      ) / predictions.length;

    // 平均絶対誤差
    const mae =
      predictions.reduce(
        (sum, p, i) => sum + Math.abs(p.predicted - actual[i]),
        0
      ) / predictions.length;

    // R²スコア
    const meanActual =
      actual.reduce((sum, val) => sum + val, 0) / actual.length;
    const ssRes = predictions.reduce(
      (sum, p, i) => sum + Math.pow(actual[i] - p.predicted, 2),
      0
    );
    const ssTot = actual.reduce(
      (sum, val) => sum + Math.pow(val - meanActual, 2),
      0
    );
    const r2 = 1 - ssRes / ssTot;

    return { mse, mae, r2 };
  }

  /**
   * 行列の転置
   */
  private transpose(matrix: number[][]): number[][] {
    return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
  }

  /**
   * 行列の掛け算
   */
  private matrixMultiply(A: number[][], B: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < A.length; i++) {
      result[i] = [];
      for (let j = 0; j < B[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < B.length; k++) {
          sum += A[i][k] * B[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  /**
   * 行列とベクトルの掛け算
   */
  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) =>
      row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
  }

  /**
   * 2x2行列の逆行列（簡易版）
   */
  private matrixInverse(matrix: number[][]): number[][] {
    if (matrix.length !== matrix[0].length) {
      throw new Error('Matrix must be square');
    }

    const n = matrix.length;
    const identity: number[][] = Array(n)
      .fill(null)
      .map((_, i) =>
        Array(n)
          .fill(0)
          .map((_, j) => (i === j ? 1 : 0))
      );

    // ガウス・ジョルダン法
    const augmented = matrix.map((row, i) => [...row, ...identity[i]]);

    for (let i = 0; i < n; i++) {
      // ピボット要素を1にする
      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) {
        throw new Error('Matrix is singular');
      }

      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }

      // 他の行から引く
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    return augmented.map((row) => row.slice(n));
  }

  /**
   * モデルを保存
   */
  save(): LinearRegressionModel | null {
    return this.model;
  }

  /**
   * モデルを読み込み
   */
  load(model: LinearRegressionModel): void {
    this.model = model;
  }
}
