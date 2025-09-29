/**
 * テクニカル分析サービス
 * RSI、MACD、ボリンジャーバンド等のテクニカル指標を計算
 */

export interface TechnicalIndicators {
  sma: {
    period5: number;
    period10: number;
    period20: number;
    period50: number;
  };
  ema: {
    period12: number;
    period26: number;
  };
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    width: number;
  };
  stochastic: {
    k: number;
    d: number;
  };
  volume: {
    sma: number;
    ratio: number;
  };
}

export interface PriceData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TechnicalAnalyzer {
  /**
   * 単純移動平均（SMA）を計算
   * @param prices 価格配列
   * @param period 期間
   * @returns SMA値
   */
  static calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  /**
   * 指数移動平均（EMA）を計算
   * @param prices 価格配列
   * @param period 期間
   * @returns EMA値
   */
  static calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  /**
   * RSI（相対力指数）を計算
   * @param prices 価格配列
   * @param period 期間（デフォルト14）
   * @returns RSI値
   */
  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);
    
    const avgGain = gains.slice(-period).reduce((acc, gain) => acc + gain, 0) / period;
    const avgLoss = losses.slice(-period).reduce((acc, loss) => acc + loss, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * MACDを計算
   * @param prices 価格配列
   * @param fastPeriod 短期EMA期間（デフォルト12）
   * @param slowPeriod 長期EMA期間（デフォルト26）
   * @param signalPeriod シグナル期間（デフォルト9）
   * @returns MACD値
   */
  static calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): { macd: number; signal: number; histogram: number } {
    if (prices.length < slowPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }
    
    const ema12 = this.calculateEMA(prices, fastPeriod);
    const ema26 = this.calculateEMA(prices, slowPeriod);
    const macd = ema12 - ema26;
    
    // シグナルライン（MACDのEMA）
    const macdValues = [macd];
    const signal = this.calculateEMA(macdValues, signalPeriod);
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  /**
   * ボリンジャーバンドを計算
   * @param prices 価格配列
   * @param period 期間（デフォルト20）
   * @param stdDev 標準偏差の倍数（デフォルト2）
   * @returns ボリンジャーバンド値
   */
  static calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number; middle: number; lower: number; width: number } {
    if (prices.length < period) {
      return { upper: 0, middle: 0, lower: 0, width: 0 };
    }
    
    const sma = this.calculateSMA(prices, period);
    const recentPrices = prices.slice(-period);
    
    // 標準偏差を計算
    const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    const upper = sma + (stdDev * standardDeviation);
    const lower = sma - (stdDev * standardDeviation);
    const width = (upper - lower) / sma;
    
    return { upper, middle: sma, lower, width };
  }

  /**
   * ストキャスティクスを計算
   * @param highPrices 高値配列
   * @param lowPrices 安値配列
   * @param closePrices 終値配列
   * @param kPeriod K期間（デフォルト14）
   * @param dPeriod D期間（デフォルト3）
   * @returns ストキャスティクス値
   */
  static calculateStochastic(
    highPrices: number[],
    lowPrices: number[],
    closePrices: number[],
    kPeriod: number = 14,
    dPeriod: number = 3
  ): { k: number; d: number } {
    if (highPrices.length < kPeriod || lowPrices.length < kPeriod || closePrices.length < kPeriod) {
      return { k: 50, d: 50 };
    }
    
    const recentHighs = highPrices.slice(-kPeriod);
    const recentLows = lowPrices.slice(-kPeriod);
    const recentCloses = closePrices.slice(-kPeriod);
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    const currentClose = recentCloses[recentCloses.length - 1];
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // Dライン（Kの移動平均）
    const kValues = [k];
    const d = this.calculateSMA(kValues, dPeriod);
    
    return { k, d };
  }

  /**
   * 出来高分析を計算
   * @param volumes 出来高配列
   * @param period 期間（デフォルト20）
   * @returns 出来高分析値
   */
  static calculateVolumeAnalysis(
    volumes: number[],
    period: number = 20
  ): { sma: number; ratio: number } {
    if (volumes.length < period) {
      return { sma: 0, ratio: 1 };
    }
    
    const sma = this.calculateSMA(volumes, period);
    const currentVolume = volumes[volumes.length - 1];
    const ratio = currentVolume / sma;
    
    return { sma, ratio };
  }

  /**
   * 全テクニカル指標を計算
   * @param priceData 価格データ配列
   * @returns テクニカル指標
   */
  static calculateAllIndicators(priceData: PriceData[]): TechnicalIndicators {
    if (priceData.length < 50) {
      return {
        sma: { period5: 0, period10: 0, period20: 0, period50: 0 },
        ema: { period12: 0, period26: 0 },
        rsi: 50,
        macd: { macd: 0, signal: 0, histogram: 0 },
        bollinger: { upper: 0, middle: 0, lower: 0, width: 0 },
        stochastic: { k: 50, d: 50 },
        volume: { sma: 0, ratio: 1 },
      };
    }
    
    const closes = priceData.map(d => d.close);
    const highs = priceData.map(d => d.high);
    const lows = priceData.map(d => d.low);
    const volumes = priceData.map(d => d.volume);
    
    return {
      sma: {
        period5: this.calculateSMA(closes, 5),
        period10: this.calculateSMA(closes, 10),
        period20: this.calculateSMA(closes, 20),
        period50: this.calculateSMA(closes, 50),
      },
      ema: {
        period12: this.calculateEMA(closes, 12),
        period26: this.calculateEMA(closes, 26),
      },
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes, 12, 26, 9),
      bollinger: this.calculateBollingerBands(closes, 20, 2),
      stochastic: this.calculateStochastic(highs, lows, closes, 14, 3),
      volume: this.calculateVolumeAnalysis(volumes, 20),
    };
  }

  /**
   * トレンド分析を実行
   * @param indicators テクニカル指標
   * @returns トレンド分析結果
   */
  static analyzeTrend(indicators: TechnicalIndicators): {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number; // 0-100
    signals: string[];
  } {
    const signals: string[] = [];
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    // SMA分析
    if (indicators.sma.period5 > indicators.sma.period20) {
      bullishSignals++;
      signals.push('SMA5 > SMA20');
    } else if (indicators.sma.period5 < indicators.sma.period20) {
      bearishSignals++;
      signals.push('SMA5 < SMA20');
    }
    
    // RSI分析
    if (indicators.rsi > 70) {
      bearishSignals++;
      signals.push('RSI overbought');
    } else if (indicators.rsi < 30) {
      bullishSignals++;
      signals.push('RSI oversold');
    }
    
    // MACD分析
    if (indicators.macd.macd > indicators.macd.signal) {
      bullishSignals++;
      signals.push('MACD bullish');
    } else if (indicators.macd.macd < indicators.macd.signal) {
      bearishSignals++;
      signals.push('MACD bearish');
    }
    
    // ボリンジャーバンド分析
    const currentPrice = indicators.sma.period20; // 仮の現在価格
    if (currentPrice > indicators.bollinger.upper) {
      bearishSignals++;
      signals.push('Price above upper Bollinger');
    } else if (currentPrice < indicators.bollinger.lower) {
      bullishSignals++;
      signals.push('Price below lower Bollinger');
    }
    
    // ストキャスティクス分析
    if (indicators.stochastic.k > 80) {
      bearishSignals++;
      signals.push('Stochastic overbought');
    } else if (indicators.stochastic.k < 20) {
      bullishSignals++;
      signals.push('Stochastic oversold');
    }
    
    const totalSignals = bullishSignals + bearishSignals;
    const strength = totalSignals > 0 ? (Math.abs(bullishSignals - bearishSignals) / totalSignals) * 100 : 0;
    
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (bullishSignals > bearishSignals) {
      trend = 'BULLISH';
    } else if (bearishSignals > bullishSignals) {
      trend = 'BEARISH';
    }
    
    return { trend, strength, signals };
  }
}
