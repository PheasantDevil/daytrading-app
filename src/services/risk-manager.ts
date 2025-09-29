/**
 * リスク管理サービス
 * ポジションサイジング、ストップロス、テイクプロフィット等のリスク管理機能
 */

export interface RiskParameters {
  maxPositionSize: number; // 最大ポジションサイズ（円）
  maxPortfolioRisk: number; // 最大ポートフォリオリスク（%）
  stopLossPercent: number; // ストップロス率（%）
  takeProfitPercent: number; // テイクプロフィット率（%）
  maxDailyLoss: number; // 最大日次損失（円）
  maxDrawdown: number; // 最大ドローダウン（%）
}

export interface PositionRisk {
  positionSize: number;
  riskAmount: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  riskRewardRatio: number;
  isWithinRiskLimit: boolean;
}

export interface PortfolioRisk {
  totalValue: number;
  totalRisk: number;
  riskPercentage: number;
  isWithinRiskLimit: boolean;
  recommendedAction: 'HOLD' | 'REDUCE' | 'STOP';
}

export class RiskManager {
  private riskParameters: RiskParameters;

  constructor(riskParameters: RiskParameters) {
    this.riskParameters = riskParameters;
  }

  /**
   * ポジションサイジングを計算
   * @param accountBalance 口座残高
   * @param entryPrice エントリー価格
   * @param stopLossPrice ストップロス価格
   * @param riskPercent リスク率（%）
   * @returns 推奨ポジションサイズ
   */
  calculatePositionSize(
    accountBalance: number,
    entryPrice: number,
    stopLossPrice: number,
    riskPercent: number = 2
  ): number {
    // リスク金額を計算
    const riskAmount = accountBalance * (riskPercent / 100);

    // 1株あたりのリスクを計算
    const riskPerShare = Math.abs(entryPrice - stopLossPrice);

    // ポジションサイズを計算
    const positionSize = Math.floor(riskAmount / riskPerShare);

    // 最大ポジションサイズを適用
    const maxPositionSize = Math.floor(
      this.riskParameters.maxPositionSize / entryPrice
    );

    return Math.min(positionSize, maxPositionSize);
  }

  /**
   * ポジションリスクを分析
   * @param positionSize ポジションサイズ
   * @param entryPrice エントリー価格
   * @param currentPrice 現在価格
   * @returns ポジションリスク分析結果
   */
  analyzePositionRisk(
    positionSize: number,
    entryPrice: number,
    currentPrice: number
  ): PositionRisk {
    const positionValue = positionSize * currentPrice;
    const riskAmount = positionSize * Math.abs(entryPrice - currentPrice);

    // ストップロス価格を計算
    const stopLossPrice =
      entryPrice * (1 - this.riskParameters.stopLossPercent / 100);

    // テイクプロフィット価格を計算
    const takeProfitPrice =
      entryPrice * (1 + this.riskParameters.takeProfitPercent / 100);

    // リスクリワード比を計算
    const riskRewardRatio =
      (takeProfitPrice - entryPrice) / (entryPrice - stopLossPrice);

    // リスク制限内かチェック
    const isWithinRiskLimit =
      positionValue <= this.riskParameters.maxPositionSize;

    return {
      positionSize,
      riskAmount,
      stopLossPrice,
      takeProfitPrice,
      riskRewardRatio,
      isWithinRiskLimit,
    };
  }

  /**
   * ポートフォリオリスクを分析
   * @param positions ポジション一覧
   * @param accountBalance 口座残高
   * @returns ポートフォリオリスク分析結果
   */
  analyzePortfolioRisk(
    positions: Array<{
      symbol: string;
      size: number;
      entryPrice: number;
      currentPrice: number;
    }>,
    accountBalance: number
  ): PortfolioRisk {
    let totalValue = 0;
    let totalRisk = 0;

    // 各ポジションのリスクを計算
    for (const position of positions) {
      const positionValue = position.size * position.currentPrice;
      const positionRisk =
        position.size * Math.abs(position.entryPrice - position.currentPrice);

      totalValue += positionValue;
      totalRisk += positionRisk;
    }

    // リスク率を計算
    const riskPercentage = (totalRisk / accountBalance) * 100;

    // リスク制限内かチェック
    const isWithinRiskLimit =
      riskPercentage <= this.riskParameters.maxPortfolioRisk;

    // 推奨アクションを決定
    let recommendedAction: 'HOLD' | 'REDUCE' | 'STOP' = 'HOLD';
    if (riskPercentage > this.riskParameters.maxPortfolioRisk * 1.5) {
      recommendedAction = 'STOP';
    } else if (riskPercentage > this.riskParameters.maxPortfolioRisk) {
      recommendedAction = 'REDUCE';
    }

    return {
      totalValue,
      totalRisk,
      riskPercentage,
      isWithinRiskLimit,
      recommendedAction,
    };
  }

  /**
   * 日次損失制限をチェック
   * @param dailyPnL 日次損益
   * @returns 制限内かどうか
   */
  checkDailyLossLimit(dailyPnL: number): boolean {
    return dailyPnL >= -this.riskParameters.maxDailyLoss;
  }

  /**
   * ドローダウンをチェック
   * @param currentValue 現在価値
   * @param peakValue ピーク価値
   * @returns 制限内かどうか
   */
  checkDrawdownLimit(currentValue: number, peakValue: number): boolean {
    const drawdown = ((peakValue - currentValue) / peakValue) * 100;
    return drawdown <= this.riskParameters.maxDrawdown;
  }

  /**
   * リスクパラメータを更新
   * @param newParameters 新しいリスクパラメータ
   */
  updateRiskParameters(newParameters: Partial<RiskParameters>): void {
    this.riskParameters = { ...this.riskParameters, ...newParameters };
  }

  /**
   * 現在のリスクパラメータを取得
   * @returns リスクパラメータ
   */
  getRiskParameters(): RiskParameters {
    return { ...this.riskParameters };
  }

  /**
   * リスクレポートを生成
   * @param positions ポジション一覧
   * @param accountBalance 口座残高
   * @param dailyPnL 日次損益
   * @returns リスクレポート
   */
  generateRiskReport(
    positions: Array<{
      symbol: string;
      size: number;
      entryPrice: number;
      currentPrice: number;
    }>,
    accountBalance: number,
    dailyPnL: number
  ): {
    portfolioRisk: PortfolioRisk;
    positionRisks: PositionRisk[];
    dailyLossStatus: boolean;
    recommendations: string[];
  } {
    const portfolioRisk = this.analyzePortfolioRisk(positions, accountBalance);

    const positionRisks = positions.map((position) =>
      this.analyzePositionRisk(
        position.size,
        position.entryPrice,
        position.currentPrice
      )
    );

    const dailyLossStatus = this.checkDailyLossLimit(dailyPnL);

    const recommendations: string[] = [];

    if (!portfolioRisk.isWithinRiskLimit) {
      recommendations.push(
        'ポートフォリオリスクが制限を超えています。ポジションを縮小してください。'
      );
    }

    if (!dailyLossStatus) {
      recommendations.push(
        '日次損失制限に達しました。取引を停止してください。'
      );
    }

    if (portfolioRisk.recommendedAction === 'STOP') {
      recommendations.push(
        '緊急停止が必要です。全ポジションをクローズしてください。'
      );
    } else if (portfolioRisk.recommendedAction === 'REDUCE') {
      recommendations.push('リスク軽減のため、ポジションを縮小してください。');
    }

    return {
      portfolioRisk,
      positionRisks,
      dailyLossStatus,
      recommendations,
    };
  }
}
