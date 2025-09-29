/**
 * ポジションサイジングサービス
 * リスクに応じた動的なポジションサイジング
 */

export interface PositionSizingConfig {
  accountBalance: number;
  riskPerTrade: number; // 1トレードあたりのリスク（%）
  maxPositionSize: number; // 最大ポジションサイズ（円）
  minPositionSize: number; // 最小ポジションサイズ（円）
  maxPortfolioRisk: number; // 最大ポートフォリオリスク（%）
}

export interface PositionSizingResult {
  recommendedSize: number; // 推奨ポジションサイズ（株数）
  positionValue: number; // ポジション価値（円）
  riskAmount: number; // リスク金額（円）
  riskPercent: number; // リスク率（%）
  method: string; // 使用した手法
  confidence: number; // 信頼度（0-100）
}

export interface KellyCriterionResult {
  kellyPercent: number; // ケリー基準による推奨割合（%）
  positionSize: number; // ポジションサイズ（株数）
  isRecommended: boolean; // 推奨可否
}

export interface RiskParityResult {
  targetRisk: number; // 目標リスク（円）
  positionSize: number; // ポジションサイズ（株数）
  riskContribution: number; // リスク寄与度（%）
}

export class PositionSizer {
  private config: PositionSizingConfig;

  constructor(config: PositionSizingConfig) {
    this.config = config;
  }

  /**
   * 基本的なポジションサイジング（固定リスク）
   * @param entryPrice エントリー価格
   * @param stopLossPrice ストップロス価格
   * @param riskPercent リスク率（%）
   * @returns ポジションサイジング結果
   */
  calculateFixedRisk(
    entryPrice: number,
    stopLossPrice: number,
    riskPercent: number = 2
  ): PositionSizingResult {
    const riskAmount = this.config.accountBalance * (riskPercent / 100);
    const riskPerShare = Math.abs(entryPrice - stopLossPrice);

    if (riskPerShare <= 0) {
      return {
        recommendedSize: 0,
        positionValue: 0,
        riskAmount: 0,
        riskPercent: 0,
        method: 'Fixed Risk',
        confidence: 0,
      };
    }

    const recommendedSize = Math.floor(riskAmount / riskPerShare);
    const positionValue = recommendedSize * entryPrice;

    // 最大ポジションサイズを適用
    const maxSize = Math.floor(this.config.maxPositionSize / entryPrice);
    const finalSize = Math.min(recommendedSize, maxSize);

    return {
      recommendedSize: finalSize,
      positionValue: finalSize * entryPrice,
      riskAmount: finalSize * riskPerShare,
      riskPercent:
        ((finalSize * riskPerShare) / this.config.accountBalance) * 100,
      method: 'Fixed Risk',
      confidence: 85,
    };
  }

  /**
   * ケリー基準によるポジションサイジング
   * @param winRate 勝率（%）
   * @param averageWin 平均利益（円）
   * @param averageLoss 平均損失（円）
   * @param entryPrice エントリー価格
   * @returns ケリー基準結果
   */
  calculateKellyCriterion(
    winRate: number,
    averageWin: number,
    averageLoss: number,
    entryPrice: number
  ): KellyCriterionResult {
    if (averageLoss <= 0 || winRate <= 0 || winRate >= 100) {
      return {
        kellyPercent: 0,
        positionSize: 0,
        isRecommended: false,
      };
    }

    // ケリー基準の計算
    const winRateDecimal = winRate / 100;
    const lossRateDecimal = 1 - winRateDecimal;
    const kellyPercent =
      (winRateDecimal * averageWin - lossRateDecimal * averageLoss) /
      averageWin;

    // ケリー基準を制限（最大25%）
    const limitedKellyPercent = Math.min(Math.max(kellyPercent, 0), 0.25);

    if (limitedKellyPercent <= 0) {
      return {
        kellyPercent: 0,
        positionSize: 0,
        isRecommended: false,
      };
    }

    const positionValue = this.config.accountBalance * limitedKellyPercent;
    const positionSize = Math.floor(positionValue / entryPrice);

    return {
      kellyPercent: limitedKellyPercent * 100,
      positionSize,
      isRecommended: limitedKellyPercent > 0.05, // 5%以上の場合のみ推奨
    };
  }

  /**
   * リスクパリティによるポジションサイジング
   * @param targetRisk 目標リスク（円）
   * @param entryPrice エントリー価格
   * @param stopLossPrice ストップロス価格
   * @param portfolioRisk 現在のポートフォリオリスク（%）
   * @returns リスクパリティ結果
   */
  calculateRiskParity(
    targetRisk: number,
    entryPrice: number,
    stopLossPrice: number,
    portfolioRisk: number = 0
  ): RiskParityResult {
    const riskPerShare = Math.abs(entryPrice - stopLossPrice);

    if (riskPerShare <= 0) {
      return {
        targetRisk: 0,
        positionSize: 0,
        riskContribution: 0,
      };
    }

    // ポートフォリオリスクを考慮
    const availableRisk = Math.min(
      targetRisk,
      this.config.accountBalance * (this.config.maxPortfolioRisk / 100) -
        portfolioRisk
    );

    const positionSize = Math.floor(availableRisk / riskPerShare);
    const riskContribution =
      ((positionSize * riskPerShare) / this.config.accountBalance) * 100;

    return {
      targetRisk: availableRisk,
      positionSize,
      riskContribution,
    };
  }

  /**
   * ボラティリティベースのポジションサイジング
   * @param entryPrice エントリー価格
   * @param volatility ボラティリティ（%）
   * @param riskPercent リスク率（%）
   * @returns ポジションサイジング結果
   */
  calculateVolatilityBased(
    entryPrice: number,
    volatility: number,
    riskPercent: number = 2
  ): PositionSizingResult {
    if (volatility <= 0) {
      return {
        recommendedSize: 0,
        positionValue: 0,
        riskAmount: 0,
        riskPercent: 0,
        method: 'Volatility Based',
        confidence: 0,
      };
    }

    // ボラティリティを考慮したリスク金額
    const baseRiskAmount = this.config.accountBalance * (riskPercent / 100);
    const volatilityAdjustment = Math.min(volatility / 20, 2); // 20%を基準に調整
    const adjustedRiskAmount = baseRiskAmount / volatilityAdjustment;

    // ボラティリティベースのストップロス
    const stopLossPrice = entryPrice * (1 - volatility / 100);
    const riskPerShare = Math.abs(entryPrice - stopLossPrice);

    if (riskPerShare <= 0) {
      return {
        recommendedSize: 0,
        positionValue: 0,
        riskAmount: 0,
        riskPercent: 0,
        method: 'Volatility Based',
        confidence: 0,
      };
    }

    const recommendedSize = Math.floor(adjustedRiskAmount / riskPerShare);
    const positionValue = recommendedSize * entryPrice;

    // 最大ポジションサイズを適用
    const maxSize = Math.floor(this.config.maxPositionSize / entryPrice);
    const finalSize = Math.min(recommendedSize, maxSize);

    return {
      recommendedSize: finalSize,
      positionValue: finalSize * entryPrice,
      riskAmount: finalSize * riskPerShare,
      riskPercent:
        ((finalSize * riskPerShare) / this.config.accountBalance) * 100,
      method: 'Volatility Based',
      confidence: 80,
    };
  }

  /**
   * 統合ポジションサイジング
   * @param entryPrice エントリー価格
   * @param stopLossPrice ストップロス価格
   * @param volatility ボラティリティ（%）
   * @param winRate 勝率（%）
   * @param averageWin 平均利益（円）
   * @param averageLoss 平均損失（円）
   * @param portfolioRisk 現在のポートフォリオリスク（%）
   * @returns 統合ポジションサイジング結果
   */
  calculateIntegrated(
    entryPrice: number,
    stopLossPrice: number,
    volatility: number,
    winRate: number,
    averageWin: number,
    averageLoss: number,
    portfolioRisk: number = 0
  ): PositionSizingResult {
    // 各手法で計算
    const fixedRisk = this.calculateFixedRisk(entryPrice, stopLossPrice);
    const volatilityBased = this.calculateVolatilityBased(
      entryPrice,
      volatility
    );
    const kelly = this.calculateKellyCriterion(
      winRate,
      averageWin,
      averageLoss,
      entryPrice
    );

    // 重み付け平均
    const weights = {
      fixedRisk: 0.4,
      volatilityBased: 0.3,
      kelly: 0.3,
    };

    let recommendedSize = 0;
    let confidence = 0;

    if (kelly.isRecommended) {
      recommendedSize = Math.floor(
        fixedRisk.recommendedSize * weights.fixedRisk +
          volatilityBased.recommendedSize * weights.volatilityBased +
          kelly.positionSize * weights.kelly
      );
      confidence = 90;
    } else {
      recommendedSize = Math.floor(
        fixedRisk.recommendedSize * 0.6 + volatilityBased.recommendedSize * 0.4
      );
      confidence = 75;
    }

    // ポートフォリオリスク制限を適用
    const riskPerShare = Math.abs(entryPrice - stopLossPrice);
    const maxRiskAmount =
      this.config.accountBalance * (this.config.maxPortfolioRisk / 100) -
      portfolioRisk;
    const maxSizeByRisk = Math.floor(maxRiskAmount / riskPerShare);

    recommendedSize = Math.min(recommendedSize, maxSizeByRisk);

    // 最小・最大ポジションサイズを適用
    const minSize = Math.floor(this.config.minPositionSize / entryPrice);
    const maxSize = Math.floor(this.config.maxPositionSize / entryPrice);
    recommendedSize = Math.max(minSize, Math.min(recommendedSize, maxSize));

    return {
      recommendedSize,
      positionValue: recommendedSize * entryPrice,
      riskAmount: recommendedSize * riskPerShare,
      riskPercent:
        ((recommendedSize * riskPerShare) / this.config.accountBalance) * 100,
      method: 'Integrated',
      confidence,
    };
  }

  /**
   * ポジションサイジング設定を更新
   */
  updateConfig(newConfig: Partial<PositionSizingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): PositionSizingConfig {
    return { ...this.config };
  }

  /**
   * リスク分析を実行
   */
  analyzeRisk(
    positionSize: number,
    entryPrice: number,
    stopLossPrice: number,
    portfolioRisk: number = 0
  ): {
    positionRisk: number;
    portfolioRiskAfter: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendations: string[];
  } {
    const positionRisk = positionSize * Math.abs(entryPrice - stopLossPrice);
    const portfolioRiskAfter =
      portfolioRisk + (positionRisk / this.config.accountBalance) * 100;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const recommendations: string[] = [];

    if (portfolioRiskAfter > this.config.maxPortfolioRisk) {
      riskLevel = 'HIGH';
      recommendations.push('ポートフォリオリスクが制限を超えています');
    } else if (portfolioRiskAfter > this.config.maxPortfolioRisk * 0.8) {
      riskLevel = 'MEDIUM';
      recommendations.push('ポートフォリオリスクが高くなっています');
    }

    if (positionSize * entryPrice > this.config.maxPositionSize) {
      riskLevel = 'HIGH';
      recommendations.push('ポジションサイズが制限を超えています');
    }

    if (positionRisk > this.config.accountBalance * 0.05) {
      riskLevel = 'HIGH';
      recommendations.push('個別ポジションのリスクが高すぎます');
    }

    return {
      positionRisk,
      portfolioRiskAfter,
      riskLevel,
      recommendations,
    };
  }
}
