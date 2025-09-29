/**
 * 取引機械学習サービス
 * 予測モデルと取引戦略の統合
 */

import { LSTMModel } from './models/lstm-model';
import { MultiTimeframePredictor } from './multi-timeframe-predictor';
import { OnlineLearner } from './online-learner';
import { DataIntegrationService } from '../services/data-integration-service';
import { RealTradingService } from '../services/real-trading-service';

export interface TradingMLConfig {
  models: {
    lstm: {
      enabled: boolean;
      sequenceLength: number;
      hiddenUnits: number;
      epochs: number;
      batchSize: number;
      learningRate: number;
    };
    multiTimeframe: {
      enabled: boolean;
      timeframes: ('1m' | '5m' | '15m' | '1h' | '4h' | '1d')[];
      weights: number[];
    };
    onlineLearning: {
      enabled: boolean;
      updateInterval: number;
      minDataPoints: number;
      retrainThreshold: number;
    };
  };
  prediction: {
    confidenceThreshold: number;
    maxPredictions: number;
    predictionHorizon: number;
  };
  trading: {
    minConfidence: number;
    maxPositionSize: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  };
}

export interface TradingPrediction {
  id: string;
  symbol: string;
  market: 'FX' | 'US' | 'JP';
  timeframe: string;
  prediction: {
    price: number;
    direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    confidence: number;
    probability: number;
  };
  technicalIndicators: {
    sma: number[];
    ema: number[];
    rsi: number;
    macd: number;
    bollinger: { upper: number; middle: number; lower: number };
  };
  marketConditions: {
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    volume: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  createdAt: Date;
  model: string;
  accuracy?: number;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  market: 'FX' | 'US' | 'JP';
  side: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-1の範囲
  confidence: number; // 0-1の範囲
  price: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
  predictions: TradingPrediction[];
  technicalAnalysis: Record<string, number>;
  riskScore: number;
  createdAt: Date;
  strategy: string;
}

export interface ModelPerformance {
  model: string;
  symbol: string;
  market: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalReturn: number;
  winRate: number;
  lastUpdated: Date;
}

export class TradingMLService {
  private config: TradingMLConfig;
  private dataService: DataIntegrationService;
  private tradingService: RealTradingService;
  private lstmModel: LSTMModel | null = null;
  private multiTimeframePredictor: MultiTimeframePredictor | null = null;
  private onlineLearner: OnlineLearner | null = null;
  private predictions: Map<string, TradingPrediction> = new Map();
  private signals: Map<string, TradingSignal> = new Map();
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  private isInitialized: boolean = false;

  constructor(
    config: TradingMLConfig,
    dataService: DataIntegrationService,
    tradingService: RealTradingService
  ) {
    this.config = config;
    this.dataService = dataService;
    this.tradingService = tradingService;
  }

  /**
   * サービスを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 取引機械学習サービス初期化中...');

      // データサービスの初期化
      const dataInitialized = await this.dataService.initialize();
      if (!dataInitialized) {
        console.log('❌ データサービス初期化失敗');
        return false;
      }

      // LSTMモデルの初期化
      if (this.config.models.lstm.enabled) {
        this.lstmModel = new LSTMModel({
          sequenceLength: this.config.models.lstm.sequenceLength,
          hiddenUnits: this.config.models.lstm.hiddenUnits,
          epochs: this.config.models.lstm.epochs,
          batchSize: this.config.models.lstm.batchSize,
          learningRate: this.config.models.lstm.learningRate,
        });
        console.log('✅ LSTMモデル初期化完了');
      }

      // マルチタイムフレーム予測器の初期化
      if (this.config.models.multiTimeframe.enabled) {
        this.multiTimeframePredictor = new MultiTimeframePredictor();
        console.log('✅ マルチタイムフレーム予測器初期化完了');
      }

      // オンライン学習器の初期化
      if (this.config.models.onlineLearning.enabled) {
        this.onlineLearner = new OnlineLearner({
          updateInterval: this.config.models.onlineLearning.updateInterval,
          minDataPoints: this.config.models.onlineLearning.minDataPoints,
          retrainThreshold: this.config.models.onlineLearning.retrainThreshold,
        });
        console.log('✅ オンライン学習器初期化完了');
      }

      this.isInitialized = true;
      console.log('✅ 取引機械学習サービス初期化完了');
      return true;
    } catch (error) {
      console.error('❌ 取引機械学習サービス初期化エラー:', error);
      return false;
    }
  }

  /**
   * 予測を実行
   */
  async predict(symbol: string, market: 'FX' | 'US' | 'JP'): Promise<TradingPrediction | null> {
    try {
      if (!this.isInitialized) {
        console.log('❌ サービスが初期化されていません');
        return null;
      }

      // 履歴データを取得
      const historicalData = await this.dataService.getHistoricalData(symbol, market, 100);
      if (!historicalData || historicalData.data.length < 50) {
        console.log(`❌ 十分なデータがありません: ${symbol}`);
        return null;
      }

      const prices = historicalData.data.map(d => d.close);
      const volumes = historicalData.data.map(d => d.volume);

      // LSTM予測
      let lstmPrediction: TradingPrediction | null = null;
      if (this.lstmModel) {
        lstmPrediction = await this.predictWithLSTM(symbol, market, prices, volumes);
      }

      // マルチタイムフレーム予測
      let multiTimeframePrediction: TradingPrediction | null = null;
      if (this.multiTimeframePredictor) {
        multiTimeframePrediction = await this.predictWithMultiTimeframe(symbol, market, prices, volumes);
      }

      // 予測を統合
      const finalPrediction = this.combinePredictions(lstmPrediction, multiTimeframePrediction, symbol, market);
      
      if (finalPrediction) {
        this.predictions.set(finalPrediction.id, finalPrediction);
      }

      return finalPrediction;
    } catch (error) {
      console.error(`❌ 予測実行エラー (${symbol}):`, error);
      return null;
    }
  }

  /**
   * LSTMで予測
   */
  private async predictWithLSTM(
    symbol: string,
    market: 'FX' | 'US' | 'JP',
    prices: number[],
    volumes: number[]
  ): Promise<TradingPrediction | null> {
    try {
      if (!this.lstmModel) return null;

      const prediction = await this.lstmModel.predict(prices);
      if (!prediction) return null;

      const currentPrice = prices[prices.length - 1];
      const predictedPrice = prediction.price;
      const direction = predictedPrice > currentPrice ? 'UP' : 'DOWN';
      const confidence = prediction.confidence;

      return {
        id: `lstm_${symbol}_${Date.now()}`,
        symbol,
        market,
        timeframe: '1h',
        prediction: {
          price: predictedPrice,
          direction,
          confidence,
          probability: confidence,
        },
        technicalIndicators: {
          sma: [currentPrice],
          ema: [currentPrice],
          rsi: 50,
          macd: 0,
          bollinger: { upper: currentPrice * 1.02, middle: currentPrice, lower: currentPrice * 0.98 },
        },
        marketConditions: {
          trend: direction === 'UP' ? 'BULLISH' : 'BEARISH',
          volatility: 'MEDIUM',
          volume: 'MEDIUM',
        },
        createdAt: new Date(),
        model: 'LSTM',
        accuracy: prediction.accuracy,
      };
    } catch (error) {
      console.error(`❌ LSTM予測エラー (${symbol}):`, error);
      return null;
    }
  }

  /**
   * マルチタイムフレームで予測
   */
  private async predictWithMultiTimeframe(
    symbol: string,
    market: 'FX' | 'US' | 'JP',
    prices: number[],
    volumes: number[]
  ): Promise<TradingPrediction | null> {
    try {
      if (!this.multiTimeframePredictor) return null;

      const prediction = await this.multiTimeframePredictor.predict(symbol, prices);
      if (!prediction) return null;

      const currentPrice = prices[prices.length - 1];
      const predictedPrice = prediction.price;
      const direction = predictedPrice > currentPrice ? 'UP' : 'DOWN';
      const confidence = prediction.confidence;

      return {
        id: `mtf_${symbol}_${Date.now()}`,
        symbol,
        market,
        timeframe: 'multi',
        prediction: {
          price: predictedPrice,
          direction,
          confidence,
          probability: confidence,
        },
        technicalIndicators: {
          sma: [currentPrice],
          ema: [currentPrice],
          rsi: 50,
          macd: 0,
          bollinger: { upper: currentPrice * 1.02, middle: currentPrice, lower: currentPrice * 0.98 },
        },
        marketConditions: {
          trend: direction === 'UP' ? 'BULLISH' : 'BEARISH',
          volatility: 'MEDIUM',
          volume: 'MEDIUM',
        },
        createdAt: new Date(),
        model: 'MultiTimeframe',
        accuracy: prediction.accuracy,
      };
    } catch (error) {
      console.error(`❌ マルチタイムフレーム予測エラー (${symbol}):`, error);
      return null;
    }
  }

  /**
   * 予測を統合
   */
  private combinePredictions(
    lstmPrediction: TradingPrediction | null,
    multiTimeframePrediction: TradingPrediction | null,
    symbol: string,
    market: 'FX' | 'US' | 'JP'
  ): TradingPrediction | null {
    try {
      const predictions = [lstmPrediction, multiTimeframePrediction].filter(p => p !== null) as TradingPrediction[];
      
      if (predictions.length === 0) return null;

      // 重み付き平均で予測を統合
      const weights = [0.6, 0.4]; // LSTMとマルチタイムフレームの重み
      const weightedPrice = predictions.reduce((sum, pred, index) => {
        return sum + pred.prediction.price * weights[index];
      }, 0);

      const weightedConfidence = predictions.reduce((sum, pred, index) => {
        return sum + pred.prediction.confidence * weights[index];
      }, 0);

      const currentPrice = predictions[0].prediction.price; // 仮の現在価格
      const direction = weightedPrice > currentPrice ? 'UP' : 'DOWN';

      return {
        id: `combined_${symbol}_${Date.now()}`,
        symbol,
        market,
        timeframe: 'combined',
        prediction: {
          price: weightedPrice,
          direction,
          confidence: weightedConfidence,
          probability: weightedConfidence,
        },
        technicalIndicators: predictions[0].technicalIndicators,
        marketConditions: predictions[0].marketConditions,
        createdAt: new Date(),
        model: 'Combined',
        accuracy: predictions.reduce((sum, pred) => sum + (pred.accuracy || 0), 0) / predictions.length,
      };
    } catch (error) {
      console.error(`❌ 予測統合エラー (${symbol}):`, error);
      return null;
    }
  }

  /**
   * 取引シグナルを生成
   */
  async generateTradingSignal(symbol: string, market: 'FX' | 'US' | 'JP'): Promise<TradingSignal | null> {
    try {
      // 予測を実行
      const prediction = await this.predict(symbol, market);
      if (!prediction) return null;

      // 信頼度チェック
      if (prediction.prediction.confidence < this.config.prediction.confidenceThreshold) {
        return null;
      }

      // シグナル生成
      const side = this.determineSignalSide(prediction);
      if (side === 'HOLD') return null;

      const strength = this.calculateSignalStrength(prediction);
      const confidence = prediction.prediction.confidence;
      const currentPrice = await this.tradingService.getCurrentPrice(symbol, market);
      
      if (!currentPrice) return null;

      const quantity = this.calculateQuantity(symbol, market, currentPrice, strength);
      const stopLoss = this.calculateStopLoss(currentPrice, side);
      const takeProfit = this.calculateTakeProfit(currentPrice, side);

      const signal: TradingSignal = {
        id: `ml_${symbol}_${Date.now()}`,
        symbol,
        market,
        side,
        strength,
        confidence,
        price: currentPrice,
        quantity,
        stopLoss,
        takeProfit,
        reason: this.generateSignalReason(prediction, side),
        predictions: [prediction],
        technicalAnalysis: {
          rsi: prediction.technicalIndicators.rsi,
          macd: prediction.technicalIndicators.macd,
          sma: prediction.technicalIndicators.sma[0],
          ema: prediction.technicalIndicators.ema[0],
        },
        riskScore: this.calculateRiskScore(prediction),
        createdAt: new Date(),
        strategy: 'ML_Trading',
      };

      this.signals.set(signal.id, signal);
      return signal;
    } catch (error) {
      console.error(`❌ 取引シグナル生成エラー (${symbol}):`, error);
      return null;
    }
  }

  /**
   * シグナルの方向を決定
   */
  private determineSignalSide(prediction: TradingPrediction): 'BUY' | 'SELL' | 'HOLD' {
    const direction = prediction.prediction.direction;
    const confidence = prediction.prediction.confidence;

    if (confidence < this.config.trading.minConfidence) {
      return 'HOLD';
    }

    return direction === 'UP' ? 'BUY' : 'SELL';
  }

  /**
   * シグナル強度を計算
   */
  private calculateSignalStrength(prediction: TradingPrediction): number {
    const confidence = prediction.prediction.confidence;
    const volatility = prediction.marketConditions.volatility;
    const volume = prediction.marketConditions.volume;

    let strength = confidence;

    // ボラティリティ調整
    if (volatility === 'HIGH') strength *= 0.8;
    else if (volatility === 'LOW') strength *= 1.2;

    // ボリューム調整
    if (volume === 'HIGH') strength *= 1.1;
    else if (volume === 'LOW') strength *= 0.9;

    return Math.min(Math.max(strength, 0), 1);
  }

  /**
   * 数量を計算
   */
  private calculateQuantity(symbol: string, market: 'FX' | 'US' | 'JP', price: number, strength: number): number {
    const baseQuantity = this.config.trading.maxPositionSize / price;
    return Math.floor(baseQuantity * strength);
  }

  /**
   * ストップロスを計算
   */
  private calculateStopLoss(price: number, side: 'BUY' | 'SELL'): number {
    if (side === 'BUY') {
      return price * (1 - this.config.trading.stopLossPercent / 100);
    } else {
      return price * (1 + this.config.trading.stopLossPercent / 100);
    }
  }

  /**
   * テイクプロフィットを計算
   */
  private calculateTakeProfit(price: number, side: 'BUY' | 'SELL'): number {
    if (side === 'BUY') {
      return price * (1 + this.config.trading.takeProfitPercent / 100);
    } else {
      return price * (1 - this.config.trading.takeProfitPercent / 100);
    }
  }

  /**
   * シグナル理由を生成
   */
  private generateSignalReason(prediction: TradingPrediction, side: 'BUY' | 'SELL'): string {
    const direction = side === 'BUY' ? '上昇' : '下降';
    const confidence = (prediction.prediction.confidence * 100).toFixed(1);
    const model = prediction.model;

    return `${model}予測による${direction}シグナル: 信頼度${confidence}%, 予測価格${prediction.prediction.price.toFixed(2)}, 方向${prediction.prediction.direction}`;
  }

  /**
   * リスクスコアを計算
   */
  private calculateRiskScore(prediction: TradingPrediction): number {
    const confidence = prediction.prediction.confidence;
    const volatility = prediction.marketConditions.volatility;
    const volume = prediction.marketConditions.volume;

    let riskScore = 1 - confidence; // 信頼度が低いほどリスクが高い

    // ボラティリティ調整
    if (volatility === 'HIGH') riskScore += 0.2;
    else if (volatility === 'LOW') riskScore -= 0.1;

    // ボリューム調整
    if (volume === 'LOW') riskScore += 0.1;
    else if (volume === 'HIGH') riskScore -= 0.1;

    return Math.min(Math.max(riskScore, 0), 1);
  }

  /**
   * モデルを更新
   */
  async updateModel(symbol: string, newData: any[]): Promise<boolean> {
    try {
      if (!this.onlineLearner) return false;

      const updated = await this.onlineLearner.updateModel(symbol, newData);
      if (updated) {
        console.log(`✅ モデル更新完了: ${symbol}`);
      }

      return updated;
    } catch (error) {
      console.error(`❌ モデル更新エラー (${symbol}):`, error);
      return false;
    }
  }

  /**
   * アンサンブル予測を取得
   */
  async getEnsemblePrediction(symbol: string, market: 'FX' | 'US' | 'JP'): Promise<TradingPrediction | null> {
    try {
      const predictions = await Promise.all([
        this.predictWithLSTM(symbol, market, [], []),
        this.predictWithMultiTimeframe(symbol, market, [], []),
      ]);

      const validPredictions = predictions.filter(p => p !== null) as TradingPrediction[];
      if (validPredictions.length === 0) return null;

      return this.combinePredictions(validPredictions[0], validPredictions[1], symbol, market);
    } catch (error) {
      console.error(`❌ アンサンブル予測エラー (${symbol}):`, error);
      return null;
    }
  }

  /**
   * 予測を取得
   */
  getPrediction(predictionId: string): TradingPrediction | null {
    return this.predictions.get(predictionId) || null;
  }

  /**
   * シグナルを取得
   */
  getSignal(signalId: string): TradingSignal | null {
    return this.signals.get(signalId) || null;
  }

  /**
   * 全予測を取得
   */
  getAllPredictions(): TradingPrediction[] {
    return Array.from(this.predictions.values());
  }

  /**
   * 全シグナルを取得
   */
  getAllSignals(): TradingSignal[] {
    return Array.from(this.signals.values());
  }

  /**
   * モデルパフォーマンスを取得
   */
  getModelPerformance(symbol: string): ModelPerformance | null {
    return this.modelPerformance.get(symbol) || null;
  }

  /**
   * サービスを停止
   */
  stop(): void {
    this.isInitialized = false;
    console.log('⏹️ 取引機械学習サービス停止');
  }
}
