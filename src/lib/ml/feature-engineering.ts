import { StockPrice } from '@/types';

export interface TechnicalIndicators {
  sma5: number;
  sma10: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerMiddle: number;
  volumeSma: number;
  priceChange: number;
  priceChangePercent: number;
  volatility: number;
}

export interface MLFeatures {
  technicalIndicators: TechnicalIndicators;
  price: number;
  volume: number;
  timestamp: Date;
  target: number; // 次の日の価格
}

export class FeatureEngineering {
  /**
   * 単純移動平均線（SMA）を計算
   */
  static calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    
    return sma;
  }

  /**
   * 指数移動平均線（EMA）を計算
   */
  static calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // 最初の値はSMAを使用
    const sma = this.calculateSMA(prices, period);
    ema.push(sma[0]);
    
    for (let i = 1; i < sma.length; i++) {
      const value = (prices[i + period - 1] - ema[i - 1]) * multiplier + ema[i - 1];
      ema.push(value);
    }
    
    return ema;
  }

  /**
   * RSI（相対力指数）を計算
   */
  static calculateRSI(prices: number[], period: number = 14): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // 価格変動を計算
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // RSIを計算
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsiValue = 100 - (100 / (1 + rs));
        rsi.push(rsiValue);
      }
    }
    
    return rsi;
  }

  /**
   * MACDを計算
   */
  static calculateMACD(prices: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    const macd: number[] = [];
    const minLength = Math.min(ema12.length, ema26.length);
    
    for (let i = 0; i < minLength; i++) {
      macd.push(ema12[i] - ema26[i]);
    }
    
    const signal = this.calculateEMA(macd, 9);
    const histogram: number[] = [];
    
    for (let i = 0; i < Math.min(macd.length, signal.length); i++) {
      histogram.push(macd[i] - signal[i]);
    }
    
    return { macd, signal, histogram };
  }

  /**
   * ボリンジャーバンドを計算
   */
  static calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const sma = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = sma[i - period + 1];
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      upper.push(mean + (stdDev * standardDeviation));
      lower.push(mean - (stdDev * standardDeviation));
    }
    
    return { upper, middle: sma, lower };
  }

  /**
   * ボラティリティを計算
   */
  static calculateVolatility(prices: number[], period: number = 20): number[] {
    const volatility: number[] = [];
    
    for (let i = period; i < prices.length; i++) {
      const slice = prices.slice(i - period, i);
      const returns = slice.slice(1).map((price, idx) => 
        Math.log(price / slice[idx])
      );
      
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
      const vol = Math.sqrt(variance) * Math.sqrt(252); // 年率換算
      
      volatility.push(vol);
    }
    
    return volatility;
  }

  /**
   * 株価データから技術指標を計算
   */
  static calculateTechnicalIndicators(prices: StockPrice[]): TechnicalIndicators[] {
    const priceValues = prices.map(p => p.price);
    const volumeValues = prices.map(p => p.volume || 0);
    
    const sma5 = this.calculateSMA(priceValues, 5);
    const sma10 = this.calculateSMA(priceValues, 10);
    const sma20 = this.calculateSMA(priceValues, 20);
    const sma50 = this.calculateSMA(priceValues, 50);
    const ema12 = this.calculateEMA(priceValues, 12);
    const ema26 = this.calculateEMA(priceValues, 26);
    const rsi = this.calculateRSI(priceValues, 14);
    const macd = this.calculateMACD(priceValues);
    const bollinger = this.calculateBollingerBands(priceValues, 20, 2);
    const volumeSma = this.calculateSMA(volumeValues, 20);
    const volatility = this.calculateVolatility(priceValues, 20);
    
    const indicators: TechnicalIndicators[] = [];
    const minLength = Math.min(
      sma5.length, sma10.length, sma20.length, sma50.length,
      ema12.length, ema26.length, rsi.length,
      macd.macd.length, macd.signal.length, macd.histogram.length,
      bollinger.upper.length, bollinger.lower.length, bollinger.middle.length,
      volumeSma.length, volatility.length
    );
    
    for (let i = 0; i < minLength; i++) {
      const priceChange = i > 0 ? priceValues[i + prices.length - minLength] - priceValues[i + prices.length - minLength - 1] : 0;
      const priceChangePercent = i > 0 ? (priceChange / priceValues[i + prices.length - minLength - 1]) * 100 : 0;
      
      indicators.push({
        sma5: sma5[i],
        sma10: sma10[i],
        sma20: sma20[i],
        sma50: sma50[i],
        ema12: ema12[i],
        ema26: ema26[i],
        rsi: rsi[i],
        macd: macd.macd[i],
        macdSignal: macd.signal[i],
        macdHistogram: macd.histogram[i],
        bollingerUpper: bollinger.upper[i],
        bollingerLower: bollinger.lower[i],
        bollingerMiddle: bollinger.middle[i],
        volumeSma: volumeSma[i],
        priceChange,
        priceChangePercent,
        volatility: volatility[i],
      });
    }
    
    return indicators;
  }

  /**
   * 機械学習用の特徴量を生成
   */
  static generateMLFeatures(prices: StockPrice[]): MLFeatures[] {
    const indicators = this.calculateTechnicalIndicators(prices);
    const features: MLFeatures[] = [];
    
    for (let i = 0; i < indicators.length - 1; i++) {
      const currentPrice = prices[i + prices.length - indicators.length];
      const nextPrice = prices[i + prices.length - indicators.length + 1];
      
      features.push({
        technicalIndicators: indicators[i],
        price: currentPrice.price,
        volume: currentPrice.volume || 0,
        timestamp: currentPrice.timestamp,
        target: nextPrice.price,
      });
    }
    
    return features;
  }
}
