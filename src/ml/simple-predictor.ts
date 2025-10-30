import { prisma } from '@/core/database';

export interface SimplePredictionResult {
  modelName: string;
  predictedPrice: number;
  confidence: number;
  timestamp: Date;
  features: number[];
}

export class SimplePredictor {
  /**
   * 移動平均ベースの簡単な予測
   */
  async predict(stockId: number): Promise<SimplePredictionResult[]> {
    try {
      // 過去30日分の価格データを取得
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

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

      if (prices.length < 10) {
        throw new Error('Insufficient data for prediction');
      }

      const priceValues = prices.map((p) => p.price);
      const latestPrice = priceValues[priceValues.length - 1];

      // 5日移動平均
      const sma5 = this.calculateSMA(priceValues, 5);
      const sma5Value = sma5[sma5.length - 1] || latestPrice;

      // 10日移動平均
      const sma10 = this.calculateSMA(priceValues, 10);
      const sma10Value = sma10[sma10.length - 1] || latestPrice;

      // 20日移動平均
      const sma20 = this.calculateSMA(priceValues, 20);
      const sma20Value = sma20[sma20.length - 1] || latestPrice;

      // 価格トレンドを計算
      const trend = this.calculateTrend(priceValues);

      // ボラティリティを計算
      const volatility = this.calculateVolatility(priceValues);

      // 予測価格を計算（移動平均の加重平均 + トレンド調整）
      const predictedPrice =
        sma5Value * 0.5 + sma10Value * 0.3 + sma20Value * 0.2 + trend * 0.1;

      // 信頼度を計算（ボラティリティに基づく）
      const confidence = Math.max(
        0.1,
        Math.min(0.9, 1 - volatility / latestPrice)
      );

      const results: SimplePredictionResult[] = [
        {
          modelName: 'simple_moving_average',
          predictedPrice: Math.round(predictedPrice * 100) / 100,
          confidence: Math.round(confidence * 100) / 100,
          timestamp: new Date(),
          features: [sma5Value, sma10Value, sma20Value, trend, volatility],
        },
      ];

      // 予測結果をデータベースに保存
      for (const result of results) {
        await this.savePrediction(stockId, result);
      }

      return results;
    } catch (error) {
      console.error('Error in simple prediction:', error);
      throw error;
    }
  }

  /**
   * 単純移動平均を計算
   */
  private calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices
        .slice(i - period + 1, i + 1)
        .reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }

    return sma;
  }

  /**
   * 価格トレンドを計算
   */
  private calculateTrend(prices: number[]): number {
    if (prices.length < 10) return 0;

    const recent = prices.slice(-10);
    const older = prices.slice(-20, -10);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    return recentAvg - olderAvg;
  }

  /**
   * ボラティリティを計算
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 10) return 0;

    const recent = prices.slice(-10);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance =
      recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;

    return Math.sqrt(variance);
  }

  /**
   * 予測結果をデータベースに保存
   */
  private async savePrediction(
    stockId: number,
    result: SimplePredictionResult
  ): Promise<void> {
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
    } catch (error) {
      console.warn('Error saving prediction:', error);
    }
  }
}

export const simplePredictor = new SimplePredictor();
