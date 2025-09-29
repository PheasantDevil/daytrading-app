import { MLFeatures } from '../feature-engineering';

export interface DecisionTree {
  featureIndex: number;
  threshold: number;
  left: DecisionTree | null;
  right: DecisionTree | null;
  prediction: number | null;
}

export interface RandomForestModel {
  trees: DecisionTree[];
  featureNames: string[];
  nEstimators: number;
  maxDepth: number;
  minSamplesSplit: number;
}

export interface PredictionResult {
  predicted: number;
  confidence: number;
  features: number[];
}

export class RandomForestPredictor {
  private model: RandomForestModel | null = null;

  /**
   * モデルが学習済みかどうか
   */
  isTrained(): boolean {
    return this.model !== null;
  }

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
   * モデルを学習
   */
  train(
    trainingData: MLFeatures[],
    nEstimators: number = 100,
    maxDepth: number = 10,
    minSamplesSplit: number = 2
  ): void {
    if (trainingData.length < 2) {
      throw new Error('Insufficient training data');
    }

    const trees: DecisionTree[] = [];
    const featureNames = [
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
    ];

    // 各決定木を学習
    for (let i = 0; i < nEstimators; i++) {
      const bootstrapSample = this.bootstrapSample(trainingData);
      const tree = this.buildTree(bootstrapSample, maxDepth, minSamplesSplit);
      trees.push(tree);
    }

    this.model = {
      trees,
      featureNames,
      nEstimators,
      maxDepth,
      minSamplesSplit,
    };
  }

  /**
   * ブートストラップサンプリング
   */
  private bootstrapSample(data: MLFeatures[]): MLFeatures[] {
    const sample: MLFeatures[] = [];
    for (let i = 0; i < data.length; i++) {
      const randomIndex = Math.floor(Math.random() * data.length);
      sample.push(data[randomIndex]);
    }
    return sample;
  }

  /**
   * 決定木を構築
   */
  private buildTree(
    data: MLFeatures[],
    maxDepth: number,
    minSamplesSplit: number,
    currentDepth: number = 0
  ): DecisionTree {
    // 終了条件
    if (currentDepth >= maxDepth || data.length < minSamplesSplit) {
      return {
        featureIndex: -1,
        threshold: 0,
        left: null,
        right: null,
        prediction: this.calculateMean(data.map((d) => d.target)),
      };
    }

    // 最適な分割を見つける
    const bestSplit = this.findBestSplit(data);

    if (bestSplit === null) {
      return {
        featureIndex: -1,
        threshold: 0,
        left: null,
        right: null,
        prediction: this.calculateMean(data.map((d) => d.target)),
      };
    }

    // データを分割
    const leftData = data.filter(
      (d) =>
        this.extractFeatures(d)[bestSplit.featureIndex] <= bestSplit.threshold
    );
    const rightData = data.filter(
      (d) =>
        this.extractFeatures(d)[bestSplit.featureIndex] > bestSplit.threshold
    );

    // 再帰的に子ノードを構築
    const left = this.buildTree(
      leftData,
      maxDepth,
      minSamplesSplit,
      currentDepth + 1
    );
    const right = this.buildTree(
      rightData,
      maxDepth,
      minSamplesSplit,
      currentDepth + 1
    );

    return {
      featureIndex: bestSplit.featureIndex,
      threshold: bestSplit.threshold,
      left,
      right,
      prediction: null,
    };
  }

  /**
   * 最適な分割を見つける
   */
  private findBestSplit(
    data: MLFeatures[]
  ): { featureIndex: number; threshold: number; score: number } | null {
    if (data.length < 2) return null;

    const features = data.map((d) => this.extractFeatures(d));
    const targets = data.map((d) => d.target);
    const nFeatures = features[0].length;

    let bestSplit: {
      featureIndex: number;
      threshold: number;
      score: number;
    } | null = null;
    let bestScore = -Infinity;

    // 各特徴量について最適な分割を探す
    for (let featureIndex = 0; featureIndex < nFeatures; featureIndex++) {
      const values = features.map((f) => f[featureIndex]);
      const uniqueValues = [...new Set(values)].sort((a, b) => a - b);

      // 各閾値で分割を試す
      for (let i = 0; i < uniqueValues.length - 1; i++) {
        const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
        const score = this.calculateSplitScore(
          features,
          targets,
          featureIndex,
          threshold
        );

        if (score > bestScore) {
          bestScore = score;
          bestSplit = { featureIndex, threshold, score };
        }
      }
    }

    return bestSplit;
  }

  /**
   * 分割スコアを計算（分散の減少）
   */
  private calculateSplitScore(
    features: number[][],
    targets: number[],
    featureIndex: number,
    threshold: number
  ): number {
    const leftIndices: number[] = [];
    const rightIndices: number[] = [];

    for (let i = 0; i < features.length; i++) {
      if (features[i][featureIndex] <= threshold) {
        leftIndices.push(i);
      } else {
        rightIndices.push(i);
      }
    }

    if (leftIndices.length === 0 || rightIndices.length === 0) {
      return -Infinity;
    }

    const leftTargets = leftIndices.map((i) => targets[i]);
    const rightTargets = rightIndices.map((i) => targets[i]);

    const leftVariance = this.calculateVariance(leftTargets);
    const rightVariance = this.calculateVariance(rightTargets);
    const totalVariance = this.calculateVariance(targets);

    const leftWeight = leftIndices.length / features.length;
    const rightWeight = rightIndices.length / features.length;

    const weightedVariance =
      leftWeight * leftVariance + rightWeight * rightVariance;
    return totalVariance - weightedVariance;
  }

  /**
   * 分散を計算
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = this.calculateMean(values);
    const sumSquaredDiffs = values.reduce(
      (sum, val) => sum + Math.pow(val - mean, 2),
      0
    );
    return sumSquaredDiffs / values.length;
  }

  /**
   * 平均を計算
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 予測を実行
   */
  predict(features: MLFeatures): PredictionResult {
    if (!this.model) {
      throw new Error('Model not trained');
    }

    const featureVector = this.extractFeatures(features);
    const predictions: number[] = [];

    // 各決定木から予測を取得
    for (const tree of this.model.trees) {
      const prediction = this.predictTree(tree, featureVector);
      predictions.push(prediction);
    }

    // 平均を計算
    const predicted = this.calculateMean(predictions);

    // 信頼度を計算（予測の分散の逆数）
    const variance = this.calculateVariance(predictions);
    const confidence = Math.max(0, Math.min(1, 1 / (1 + variance)));

    return {
      predicted,
      confidence,
      features: featureVector,
    };
  }

  /**
   * 単一の決定木で予測
   */
  private predictTree(tree: DecisionTree, features: number[]): number {
    if (tree.prediction !== null) {
      return tree.prediction;
    }

    if (tree.left === null || tree.right === null) {
      return 0;
    }

    if (features[tree.featureIndex] <= tree.threshold) {
      return this.predictTree(tree.left, features);
    } else {
      return this.predictTree(tree.right, features);
    }
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
   * モデルを保存
   */
  save(): RandomForestModel | null {
    return this.model;
  }

  /**
   * モデルを読み込み
   */
  load(model: RandomForestModel): void {
    this.model = model;
  }
}
