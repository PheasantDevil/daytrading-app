/**
 * モメンタム戦略
 * 価格の勢いを利用した取引戦略
 */

import { TradingStrategy, StrategyConfig, Signal, OrderResult, RebalanceResult } from './trading-strategy';
import { RealTradingService } from '../services/real-trading-service';
import { DataIntegrationService } from '../services/data-integration-service';

export interface MomentumStrategyConfig extends StrategyConfig {
  momentumPeriods: number[];
  volumeThreshold: number;
  priceChangeThreshold: number;
  trendConfirmation: boolean;
  volumeConfirmation: boolean;
}

export class MomentumStrategy extends TradingStrategy {
  private momentumConfig: MomentumStrategyConfig;

  constructor(
    config: MomentumStrategyConfig,
    tradingService: RealTradingService,
    dataService: DataIntegrationService
  ) {
    super(config, tradingService, dataService);
    this.momentumConfig = config;
  }

  /**
   * モメンタムシグナルを生成
   */
  async generateSignals(): Promise<Signal[]> {
    try {
      const signals: Signal[] = [];

      for (const symbol of this.momentumConfig.symbols) {
        for (const market of this.momentumConfig.markets) {
          try {
            const signal = await this.generateMomentumSignal(symbol, market);
            if (signal) {
              signals.push(signal);
              this.saveSignal(signal);
            }
          } catch (error) {
            console.error(`❌ モメンタムシグナル生成エラー (${symbol}):`, error);
          }
        }
      }

      console.log(`✅ モメンタムシグナル生成完了: ${signals.length}個`);
      return signals;
    } catch (error) {
      console.error('❌ モメンタムシグナル生成エラー:', error);
      return [];
    }
  }

  /**
   * 個別のモメンタムシグナルを生成
   */
  private async generateMomentumSignal(symbol: string, market: 'FX' | 'US' | 'JP'): Promise<Signal | null> {
    try {
      // 履歴データを取得
      const historicalData = await this.dataService.getHistoricalData(symbol, market, this.momentumConfig.lookbackPeriod);
      if (!historicalData || historicalData.data.length < Math.max(...this.momentumConfig.momentumPeriods)) {
        return null;
      }

      const prices = historicalData.data.map(d => d.close);
      const volumes = historicalData.data.map(d => d.volume);

      // モメンタム計算
      const momentum = this.calculateMomentum(prices, this.momentumConfig.momentumPeriods);
      const volumeMomentum = this.calculateVolumeMomentum(volumes, this.momentumConfig.momentumPeriods);

      // 価格変化率計算
      const priceChange = this.calculatePriceChange(prices);
      const volumeChange = this.calculateVolumeChange(volumes);

      // シグナル強度計算
      const signalStrength = this.calculateSignalStrength(momentum, volumeMomentum, priceChange, volumeChange);
      
      if (Math.abs(signalStrength) < this.momentumConfig.priceChangeThreshold) {
        return null;
      }

      // トレンド確認
      if (this.momentumConfig.trendConfirmation) {
        const trendConfirmed = this.confirmTrend(prices, momentum);
        if (!trendConfirmed) {
          return null;
        }
      }

      // ボリューム確認
      if (this.momentumConfig.volumeConfirmation) {
        const volumeConfirmed = this.confirmVolume(volumes, volumeMomentum);
        if (!volumeConfirmed) {
          return null;
        }
      }

      // シグナル生成
      const side = signalStrength > 0 ? 'BUY' : 'SELL';
      const strength = Math.min(Math.abs(signalStrength), 1);
      const confidence = this.calculateConfidence(momentum, volumeMomentum, priceChange, volumeChange);

      const indicators = {
        momentum: momentum,
        volumeMomentum: volumeMomentum,
        priceChange: priceChange,
        volumeChange: volumeChange,
        signalStrength: signalStrength,
      };

      const reason = this.generateReason(side, momentum, volumeMomentum, priceChange, volumeChange);

      return await this.generateSignal(
        symbol,
        market,
        side,
        strength,
        confidence,
        reason,
        indicators
      );
    } catch (error) {
      console.error(`❌ モメンタムシグナル生成エラー (${symbol}):`, error);
      return null;
    }
  }

  /**
   * モメンタムを計算
   */
  private calculateMomentum(prices: number[], periods: number[]): number {
    const momentums = periods.map(period => {
      if (prices.length < period) return 0;
      const currentPrice = prices[prices.length - 1];
      const pastPrice = prices[prices.length - period - 1];
      return (currentPrice - pastPrice) / pastPrice;
    });

    // 重み付き平均
    const weights = periods.map(p => 1 / p);
    const weightedSum = momentums.reduce((sum, momentum, index) => sum + momentum * weights[index], 0);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    return weightedSum / totalWeight;
  }

  /**
   * ボリュームモメンタムを計算
   */
  private calculateVolumeMomentum(volumes: number[], periods: number[]): number {
    const volumeMomentums = periods.map(period => {
      if (volumes.length < period) return 0;
      const currentVolume = volumes[volumes.length - 1];
      const pastVolume = volumes[volumes.length - period - 1];
      return (currentVolume - pastVolume) / pastVolume;
    });

    // 重み付き平均
    const weights = periods.map(p => 1 / p);
    const weightedSum = volumeMomentums.reduce((sum, momentum, index) => sum + momentum * weights[index], 0);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    return weightedSum / totalWeight;
  }

  /**
   * 価格変化率を計算
   */
  private calculatePriceChange(prices: number[]): number {
    if (prices.length < 2) return 0;
    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[prices.length - 2];
    return (currentPrice - previousPrice) / previousPrice;
  }

  /**
   * ボリューム変化率を計算
   */
  private calculateVolumeChange(volumes: number[]): number {
    if (volumes.length < 2) return 0;
    const currentVolume = volumes[volumes.length - 1];
    const previousVolume = volumes[volumes.length - 2];
    return (currentVolume - previousVolume) / previousVolume;
  }

  /**
   * シグナル強度を計算
   */
  private calculateSignalStrength(
    momentum: number,
    volumeMomentum: number,
    priceChange: number,
    volumeChange: number
  ): number {
    // モメンタムとボリュームの重み付き平均
    const momentumWeight = 0.6;
    const volumeWeight = 0.4;

    const signalStrength = (momentum * momentumWeight) + (volumeMomentum * volumeWeight);
    
    // 価格変化率で調整
    const adjustedStrength = signalStrength * (1 + priceChange * 0.1);
    
    return adjustedStrength;
  }

  /**
   * トレンドを確認
   */
  private confirmTrend(prices: number[], momentum: number): boolean {
    // 短期と中期の移動平均を比較
    const shortPeriod = 5;
    const longPeriod = 20;

    if (prices.length < longPeriod) return false;

    const shortMA = this.calculateSMA(prices, shortPeriod);
    const longMA = this.calculateSMA(prices, longPeriod);

    // モメンタムの方向と移動平均の方向が一致しているか確認
    const maTrend = shortMA > longMA ? 1 : -1;
    const momentumTrend = momentum > 0 ? 1 : -1;

    return maTrend === momentumTrend;
  }

  /**
   * ボリュームを確認
   */
  private confirmVolume(volumes: number[], volumeMomentum: number): boolean {
    // 平均ボリュームと比較
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1];

    // ボリュームが平均を上回り、モメンタムが正の場合は確認
    return currentVolume > avgVolume && volumeMomentum > 0;
  }

  /**
   * 信頼度を計算
   */
  private calculateConfidence(
    momentum: number,
    volumeMomentum: number,
    priceChange: number,
    volumeChange: number
  ): number {
    // 各指標の信頼度を計算
    const momentumConfidence = Math.min(Math.abs(momentum) * 10, 1);
    const volumeConfidence = Math.min(Math.abs(volumeMomentum) * 5, 1);
    const priceConfidence = Math.min(Math.abs(priceChange) * 20, 1);
    const volumeChangeConfidence = Math.min(Math.abs(volumeChange) * 10, 1);

    // 重み付き平均
    const weights = [0.4, 0.3, 0.2, 0.1];
    const confidences = [momentumConfidence, volumeConfidence, priceConfidence, volumeChangeConfidence];

    const weightedSum = confidences.reduce((sum, conf, index) => sum + conf * weights[index], 0);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    return weightedSum / totalWeight;
  }

  /**
   * 理由を生成
   */
  private generateReason(
    side: 'BUY' | 'SELL',
    momentum: number,
    volumeMomentum: number,
    priceChange: number,
    volumeChange: number
  ): string {
    const direction = side === 'BUY' ? '上昇' : '下降';
    const momentumStr = momentum > 0 ? '正の' : '負の';
    const volumeStr = volumeMomentum > 0 ? '増加' : '減少';

    return `${direction}モメンタム検出: ${momentumStr}モメンタム(${momentum.toFixed(4)}), ボリューム${volumeStr}(${volumeMomentum.toFixed(4)}), 価格変化(${priceChange.toFixed(4)}), ボリューム変化(${volumeChange.toFixed(4)})`;
  }

  /**
   * 単純移動平均を計算
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const sum = prices.slice(-period).reduce((sum, price) => sum + price, 0);
    return sum / period;
  }

  /**
   * 注文を執行
   */
  async executeOrders(signals: Signal[]): Promise<OrderResult[]> {
    try {
      const results: OrderResult[] = [];

      for (const signal of signals) {
        try {
          // リスクチェック
          const riskCheck = await this.riskManager.checkOrderRisk({
            symbol: signal.symbol,
            market: signal.market,
            side: signal.side,
            quantity: signal.quantity,
            price: signal.price,
          });

          if (!riskCheck.allowed) {
            results.push({
              success: false,
              error: riskCheck.reason,
              signal,
            });
            continue;
          }

          // 注文発注
          const orderResult = await this.tradingService.placeOrder({
            symbol: signal.symbol,
            market: signal.market,
            side: signal.side,
            quantity: signal.quantity,
            type: 'MARKET',
            timeInForce: 'GTC',
            clientOrderId: signal.id,
          });

          results.push({
            success: orderResult.success,
            orderId: orderResult.orderId,
            error: orderResult.error,
            signal,
          });

          if (orderResult.success) {
            console.log(`✅ モメンタム注文執行成功: ${signal.symbol} ${signal.side} ${signal.quantity}`);
          } else {
            console.log(`❌ モメンタム注文執行失敗: ${signal.symbol} ${signal.side} - ${orderResult.error}`);
          }
        } catch (error) {
          console.error(`❌ モメンタム注文執行エラー (${signal.symbol}):`, error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : '不明なエラー',
            signal,
          });
        }
      }

      console.log(`✅ モメンタム注文執行完了: ${results.length}件`);
      return results;
    } catch (error) {
      console.error('❌ モメンタム注文執行エラー:', error);
      return [];
    }
  }

  /**
   * リバランスを実行
   */
  async rebalance(): Promise<RebalanceResult> {
    try {
      console.log('🔄 モメンタム戦略リバランス実行中...');

      // 現在のポジションを取得
      const positions = await this.tradingService.getPositions();
      
      // 新しいシグナルを生成
      const signals = await this.generateSignals();
      
      // 既存ポジションと新しいシグナルの比較
      const rebalanceOrders: OrderResult[] = [];

      for (const position of positions) {
        const signal = signals.find(s => s.symbol === position.symbol && s.market === position.market);
        
        if (!signal) {
          // シグナルがない場合はポジションをクローズ
          const closeOrder = await this.tradingService.placeOrder({
            symbol: position.symbol,
            market: position.market,
            side: position.side === 'LONG' ? 'SELL' : 'BUY',
            quantity: position.quantity,
            type: 'MARKET',
            timeInForce: 'GTC',
          });

          rebalanceOrders.push({
            success: closeOrder.success,
            orderId: closeOrder.orderId,
            error: closeOrder.error,
            signal: {
              id: `rebalance_${position.symbol}`,
              symbol: position.symbol,
              market: position.market,
              side: position.side === 'LONG' ? 'SELL' : 'BUY',
              strength: 1,
              confidence: 1,
              price: position.currentPrice,
              quantity: position.quantity,
              reason: 'リバランス: シグナルなし',
              indicators: {},
              createdAt: new Date(),
              strategy: this.config.name,
            },
          });
        } else if (signal.side !== (position.side === 'LONG' ? 'BUY' : 'SELL')) {
          // シグナルの方向が異なる場合はポジションを反転
          const reverseOrder = await this.tradingService.placeOrder({
            symbol: position.symbol,
            market: position.market,
            side: signal.side,
            quantity: position.quantity + signal.quantity,
            type: 'MARKET',
            timeInForce: 'GTC',
          });

          rebalanceOrders.push({
            success: reverseOrder.success,
            orderId: reverseOrder.orderId,
            error: reverseOrder.error,
            signal,
          });
        }
      }

      // 新しいシグナルの注文を執行
      const newSignals = signals.filter(s => !positions.some(p => p.symbol === s.symbol && p.market === s.market));
      const newOrders = await this.executeOrders(newSignals);
      rebalanceOrders.push(...newOrders);

      const successfulOrders = rebalanceOrders.filter(r => r.success).length;
      const totalOrders = rebalanceOrders.length;

      console.log(`✅ モメンタム戦略リバランス完了: ${successfulOrders}/${totalOrders} 成功`);

      return {
        success: successfulOrders > 0,
        orders: rebalanceOrders,
        totalOrders,
        successfulOrders,
      };
    } catch (error) {
      console.error('❌ モメンタム戦略リバランスエラー:', error);
      return {
        success: false,
        orders: [],
        totalOrders: 0,
        successfulOrders: 0,
        error: error instanceof Error ? error.message : '不明なエラー',
      };
    }
  }
}
