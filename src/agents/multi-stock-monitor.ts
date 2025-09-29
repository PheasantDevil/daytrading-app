/**
 * 複数銘柄同時監視サービス
 * 複数の銘柄を並列で監視し、分析結果を統合
 */

import { PriceData, TechnicalAnalyzer } from './technical-analyzer';

export interface StockMonitorConfig {
  symbols: string[];
  updateInterval: number; // ミリ秒
  maxConcurrent: number; // 最大同時監視数
  riskThreshold: number; // リスク閾値
}

export interface StockAnalysis {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  technicalIndicators: any;
  trend: {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;
    signals: string[];
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  lastUpdated: Date;
}

export interface PortfolioAnalysis {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  riskScore: number; // 0-100
  diversification: number; // 0-100
  topPerformers: Array<{
    symbol: string;
    performance: number;
  }>;
  bottomPerformers: Array<{
    symbol: string;
    performance: number;
  }>;
  recommendations: Array<{
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    reason: string;
    confidence: number;
  }>;
}

export class MultiStockMonitor {
  private config: StockMonitorConfig;
  private analyses: Map<string, StockAnalysis> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private updateCallbacks: Array<(analyses: StockAnalysis[]) => void> = [];

  constructor(config: StockMonitorConfig) {
    this.config = config;
  }

  /**
   * 監視を開始
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ 監視は既に開始されています');
      return;
    }

    console.log(`🔄 複数銘柄監視開始: ${this.config.symbols.join(', ')}`);
    this.isMonitoring = true;

    // 初期分析を実行
    await this.performInitialAnalysis();

    // 定期更新を開始
    this.monitoringInterval = setInterval(async () => {
      await this.updateAnalyses();
    }, this.config.updateInterval);
  }

  /**
   * 監視を停止
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('⚠️ 監視は開始されていません');
      return;
    }

    console.log('⏹️ 複数銘柄監視停止');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * 初期分析を実行
   */
  private async performInitialAnalysis(): Promise<void> {
    console.log('📊 初期分析実行中...');

    const promises = this.config.symbols.map((symbol) =>
      this.analyzeStock(symbol)
    );

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        this.analyses.set(this.config.symbols[index], result.value);
      } else {
        console.error(`❌ ${this.config.symbols[index]} の分析に失敗:`, result);
      }
    });

    console.log(`✅ 初期分析完了: ${this.analyses.size}銘柄`);
    this.notifyCallbacks();
  }

  /**
   * 分析を更新
   */
  private async updateAnalyses(): Promise<void> {
    const promises = Array.from(this.analyses.keys()).map((symbol) =>
      this.analyzeStock(symbol)
    );

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const symbol = Array.from(this.analyses.keys())[index];
      if (result.status === 'fulfilled' && result.value) {
        this.analyses.set(symbol, result.value);
      } else {
        console.error(`❌ ${symbol} の更新に失敗:`, result);
      }
    });

    this.notifyCallbacks();
  }

  /**
   * 個別銘柄を分析
   */
  private async analyzeStock(symbol: string): Promise<StockAnalysis | null> {
    try {
      // 価格データを取得（実際の実装ではAPIから取得）
      const priceData = await this.fetchPriceData(symbol);
      if (!priceData || priceData.length < 50) {
        return null;
      }

      // テクニカル指標を計算
      const technicalIndicators =
        TechnicalAnalyzer.calculateAllIndicators(priceData);

      // トレンド分析
      const trend = TechnicalAnalyzer.analyzeTrend(technicalIndicators);

      // リスクレベルを計算
      const riskLevel = this.calculateRiskLevel(technicalIndicators, trend);

      // 推奨アクションを決定
      const recommendation = this.determineRecommendation(
        technicalIndicators,
        trend,
        riskLevel
      );

      // 信頼度を計算
      const confidence = this.calculateConfidence(technicalIndicators, trend);

      const currentPrice = priceData[priceData.length - 1].close;
      const previousPrice = priceData[priceData.length - 2].close;
      const change = currentPrice - previousPrice;
      const changePercent = (change / previousPrice) * 100;

      return {
        symbol,
        currentPrice,
        change,
        changePercent,
        volume: priceData[priceData.length - 1].volume,
        technicalIndicators,
        trend,
        riskLevel,
        recommendation,
        confidence,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error(`❌ ${symbol} の分析エラー:`, error);
      return null;
    }
  }

  /**
   * 価格データを取得（モック実装）
   */
  private async fetchPriceData(symbol: string): Promise<PriceData[] | null> {
    // 実際の実装では、Yahoo Finance APIやデータベースから取得
    // ここではモックデータを返す
    const mockData: PriceData[] = [];
    const basePrice = 1000 + Math.random() * 500;

    for (let i = 0; i < 100; i++) {
      const price = basePrice + (Math.random() - 0.5) * 100;
      mockData.push({
        timestamp: new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000),
        open: price,
        high: price + Math.random() * 20,
        low: price - Math.random() * 20,
        close: price + (Math.random() - 0.5) * 10,
        volume: Math.floor(Math.random() * 1000000),
      });
    }

    return mockData;
  }

  /**
   * リスクレベルを計算
   */
  private calculateRiskLevel(
    indicators: any,
    trend: any
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    let riskScore = 0;

    // RSI分析
    if (indicators.rsi > 80 || indicators.rsi < 20) {
      riskScore += 30;
    }

    // ボリンジャーバンド分析
    if (indicators.bollinger.width > 0.1) {
      riskScore += 20;
    }

    // 出来高分析
    if (indicators.volume.ratio > 2) {
      riskScore += 25;
    }

    // トレンド強度
    if (trend.strength < 30) {
      riskScore += 25;
    }

    if (riskScore >= 70) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 推奨アクションを決定
   */
  private determineRecommendation(
    indicators: any,
    trend: any,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  ): 'BUY' | 'SELL' | 'HOLD' {
    // リスクが高い場合はHOLD
    if (riskLevel === 'HIGH') {
      return 'HOLD';
    }

    // トレンド分析に基づく判断
    if (trend.trend === 'BULLISH' && trend.strength > 60) {
      return 'BUY';
    } else if (trend.trend === 'BEARISH' && trend.strength > 60) {
      return 'SELL';
    }

    return 'HOLD';
  }

  /**
   * 信頼度を計算
   */
  private calculateConfidence(indicators: any, trend: any): number {
    let confidence = 0;

    // トレンド強度
    confidence += trend.strength * 0.4;

    // RSI信頼度
    if (indicators.rsi > 70 || indicators.rsi < 30) {
      confidence += 30;
    }

    // MACD信頼度
    if (Math.abs(indicators.macd.histogram) > 0.5) {
      confidence += 20;
    }

    // 出来高信頼度
    if (indicators.volume.ratio > 1.5) {
      confidence += 10;
    }

    return Math.min(confidence, 100);
  }

  /**
   * ポートフォリオ分析を実行
   */
  async analyzePortfolio(): Promise<PortfolioAnalysis> {
    const analyses = Array.from(this.analyses.values());

    if (analyses.length === 0) {
      return {
        totalValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        riskScore: 0,
        diversification: 0,
        topPerformers: [],
        bottomPerformers: [],
        recommendations: [],
      };
    }

    // 基本統計
    const totalValue = analyses.reduce(
      (sum, analysis) => sum + analysis.currentPrice,
      0
    );
    const totalPnL = analyses.reduce(
      (sum, analysis) => sum + analysis.change,
      0
    );
    const totalPnLPercent = (totalPnL / totalValue) * 100;

    // リスクスコア
    const riskScore =
      analyses.reduce((sum, analysis) => {
        const riskWeight =
          analysis.riskLevel === 'HIGH'
            ? 3
            : analysis.riskLevel === 'MEDIUM'
              ? 2
              : 1;
        return sum + riskWeight * analysis.confidence;
      }, 0) / analyses.length;

    // 分散度
    const diversification = Math.min(analyses.length * 10, 100);

    // パフォーマンス分析
    const performers = analyses
      .map((analysis) => ({
        symbol: analysis.symbol,
        performance: analysis.changePercent,
      }))
      .sort((a, b) => b.performance - a.performance);

    const topPerformers = performers.slice(0, 3);
    const bottomPerformers = performers.slice(-3);

    // 推奨事項
    const recommendations = analyses
      .filter((analysis) => analysis.recommendation !== 'HOLD')
      .map((analysis) => ({
        symbol: analysis.symbol,
        action: analysis.recommendation,
        reason: analysis.trend.signals.join(', '),
        confidence: analysis.confidence,
      }))
      .sort((a, b) => b.confidence - a.confidence);

    return {
      totalValue,
      totalPnL,
      totalPnLPercent,
      riskScore,
      diversification,
      topPerformers,
      bottomPerformers,
      recommendations,
    };
  }

  /**
   * 更新コールバックを登録
   */
  onUpdate(callback: (analyses: StockAnalysis[]) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * コールバックを通知
   */
  private notifyCallbacks(): void {
    const analyses = Array.from(this.analyses.values());
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(analyses);
      } catch (error) {
        console.error('コールバック実行エラー:', error);
      }
    });
  }

  /**
   * 現在の分析結果を取得
   */
  getAnalyses(): StockAnalysis[] {
    return Array.from(this.analyses.values());
  }

  /**
   * 特定銘柄の分析結果を取得
   */
  getAnalysis(symbol: string): StockAnalysis | null {
    return this.analyses.get(symbol) || null;
  }

  /**
   * 監視状態を取得
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}
