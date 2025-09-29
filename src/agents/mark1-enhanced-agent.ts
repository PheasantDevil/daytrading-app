import {
  AgentConfig,
  InvestmentPosition,
  InvestmentProduct,
} from '@/types/investment';
import { prisma } from '@/core/database';

export interface TradingSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  expectedReturn: number;
  stopLoss?: number;
  takeProfit?: number;
  analysis: {
    technical: string;
    risk: string;
    market: string;
  };
}

export interface MarketAnalysis {
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  volume: 'LOW' | 'MEDIUM' | 'HIGH';
  strength: number; // 0-100
}

export class Mark1EnhancedAgent {
  private agentId: string;
  private config: AgentConfig;
  private dailyTradeCount: number = 0;
  private lastResetDate: string = new Date().toISOString().split('T')[0];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * エージェントを初期化
   */
  async initialize(): Promise<void> {
    this.config = await prisma.agentConfig.findUniqueOrThrow({
      where: { id: this.agentId },
    });

    // 日次取引回数をリセット
    await this.resetDailyCount();
  }

  /**
   * 継続監視モードを開始
   */
  async startContinuousMonitoring(intervalMinutes: number = 1): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ 監視は既に開始されています');
      return;
    }

    this.isMonitoring = true;
    console.log(`🔄 継続監視モードを開始します（${intervalMinutes}分間隔）`);

    this.monitoringInterval = setInterval(
      async () => {
        try {
          await this.monitorAndTrade();
        } catch (error) {
          console.error('監視中のエラー:', error);
        }
      },
      intervalMinutes * 60 * 1000
    );

    // 初回実行
    await this.monitorAndTrade();
  }

  /**
   * 継続監視モードを停止
   */
  stopContinuousMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('⏹️ 継続監視モードを停止しました');
  }

  /**
   * 監視と取引を実行
   */
  private async monitorAndTrade(): Promise<void> {
    const timestamp = new Date().toLocaleString('ja-JP');
    console.log(`\n🔍 [${timestamp}] 監視・取引チェック開始`);

    // 全商品を分析
    const products = await prisma.investmentProduct.findMany({
      where: { isActive: true },
    });

    let totalDecisions = 0;
    let executedTrades = 0;

    for (const product of products) {
      try {
        const signal = await this.analyzeProduct(product.id);
        totalDecisions++;

        // 取引を実行
        const tradeExecuted = await this.executeTrade(product.id, signal);
        if (tradeExecuted) {
          executedTrades++;
          console.log(`✅ ${product.symbol}: ${signal.action} 取引実行`);
        } else {
          console.log(`⏸️ ${product.symbol}: ${signal.action} (条件未満)`);
        }

        // 判断を記録
        await this.recordDecision(product.id, signal);
      } catch (error) {
        console.error(`❌ ${product.symbol} の分析中にエラー:`, error);
      }
    }

    // 現在のポジション状況を表示
    await this.displayCurrentPositions();

    console.log(
      `📊 監視結果: ${totalDecisions}回分析, ${executedTrades}回取引実行`
    );
  }

  /**
   * 投資商品を分析して取引シグナルを生成
   */
  async analyzeProduct(productId: string): Promise<TradingSignal> {
    const product = await prisma.investmentProduct.findUniqueOrThrow({
      where: { id: productId },
    });

    // 現在のポジションを取得
    const position = await prisma.investmentPosition.findFirst({
      where: { productId },
      include: { product: true },
    });

    // 市場分析を実行
    const marketAnalysis = await this.analyzeMarket(product);

    // 技術分析を実行
    const technicalAnalysis = await this.performTechnicalAnalysis(product);

    // リスク分析を実行
    const riskAnalysis = await this.performRiskAnalysis(product, position);

    // 取引シグナルを生成
    const signal = await this.generateTradingSignal(
      product,
      position,
      marketAnalysis,
      technicalAnalysis,
      riskAnalysis
    );

    return signal;
  }

  /**
   * 市場環境を分析
   */
  private async analyzeMarket(
    product: InvestmentProduct
  ): Promise<MarketAnalysis> {
    // 価格データを取得（過去30日）
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const prices = await this.getPriceHistory(product.id, startDate, endDate);

    if (prices.length < 10) {
      return {
        trend: 'SIDEWAYS',
        volatility: 'MEDIUM',
        volume: 'MEDIUM',
        strength: 50,
      };
    }

    // トレンド分析
    const recentPrices = prices.slice(-10);
    const olderPrices = prices.slice(-20, -10);
    const recentAvg =
      recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const olderAvg =
      olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length;
    const trendStrength = ((recentAvg - olderAvg) / olderAvg) * 100;

    let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    if (trendStrength > 3) trend = 'BULLISH';
    else if (trendStrength < -3) trend = 'BEARISH';
    else trend = 'SIDEWAYS';

    // ボラティリティ分析
    const volatility = this.calculateVolatility(prices);
    let volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (volatility < 0.02) volatilityLevel = 'LOW';
    else if (volatility < 0.05) volatilityLevel = 'MEDIUM';
    else volatilityLevel = 'HIGH';

    return {
      trend,
      volatility: volatilityLevel,
      volume: 'MEDIUM',
      strength: Math.min(100, Math.max(0, Math.abs(trendStrength) * 10)),
    };
  }

  /**
   * 技術分析を実行
   */
  private async performTechnicalAnalysis(
    product: InvestmentProduct
  ): Promise<string> {
    const prices = await this.getPriceHistory(
      product.id,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    );

    if (prices.length < 20) {
      return 'データ不足のため技術分析を実行できません';
    }

    const currentPrice = product.currentPrice;
    const sma20 = this.calculateSMA(prices, 20);
    const sma5 = this.calculateSMA(prices, 5);
    const rsi = this.calculateRSI(prices, 14);

    const analysis = [];

    // 移動平均分析
    if (currentPrice > sma20) {
      analysis.push(
        '現在価格が20日移動平均を上回っており、上昇トレンドを示しています'
      );
    } else {
      analysis.push(
        '現在価格が20日移動平均を下回っており、下降トレンドを示しています'
      );
    }

    // RSI分析
    if (rsi > 70) {
      analysis.push('RSIが70を超えており、買われすぎの状態です');
    } else if (rsi < 30) {
      analysis.push('RSIが30を下回っており、売られすぎの状態です');
    } else {
      analysis.push('RSIは中立圏内にあり、適正な価格水準です');
    }

    // 短期・長期移動平均の関係
    if (sma5 > sma20) {
      analysis.push(
        '短期移動平均が長期移動平均を上回り、短期的な上昇勢いがあります'
      );
    } else {
      analysis.push(
        '短期移動平均が長期移動平均を下回り、短期的な下降圧力があります'
      );
    }

    return analysis.join('。');
  }

  /**
   * リスク分析を実行
   */
  private async performRiskAnalysis(
    product: InvestmentProduct,
    position: InvestmentPosition | null
  ): Promise<string> {
    const analysis = [];

    // ポジションサイズ分析
    if (position) {
      const positionValue = position.quantity * position.currentPrice;
      const maxAllowed = this.config.maxPositionSize;

      if (positionValue > maxAllowed * 0.8) {
        analysis.push(
          'ポジションサイズが上限の80%を超えており、リスクが高い状態です'
        );
      } else {
        analysis.push('ポジションサイズは適切な範囲内にあります');
      }

      // 未実現損益分析
      if (position.unrealizedPnlPercent < -this.config.stopLossPercent) {
        analysis.push(
          '未実現損益がストップロス水準を下回っており、損失拡大のリスクがあります'
        );
      }

      // 利確条件チェック
      if (position.unrealizedPnlPercent > this.config.takeProfitPercent) {
        analysis.push('利確条件を満たしており、利益確定のタイミングです');
      }
    }

    // 商品固有のリスク
    switch (product.type) {
      case 'STOCK':
        analysis.push('株式は市場リスクと個別リスクの両方を持ちます');
        break;
      case 'ETF':
        analysis.push('ETFは分散投資効果により個別リスクが軽減されます');
        break;
      case 'GOLD':
        analysis.push(
          '金はインフレヘッジ効果がありますが、金利上昇時に下落するリスクがあります'
        );
        break;
      case 'CRYPTO':
        analysis.push('暗号資産は高ボラティリティで投機的リスクが高いです');
        break;
    }

    return analysis.join('。');
  }

  /**
   * 取引シグナルを生成
   */
  private async generateTradingSignal(
    product: InvestmentProduct,
    position: InvestmentPosition | null,
    marketAnalysis: MarketAnalysis,
    technicalAnalysis: string,
    riskAnalysis: string
  ): Promise<TradingSignal> {
    const currentPrice = product.currentPrice;
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';
    let expectedReturn = 0;
    let stopLoss: number | undefined;
    let takeProfit: number | undefined;

    // 売りシグナルの条件（優先度：高）
    const sellConditions = [
      position && position.quantity > 0,
      (position &&
        position.unrealizedPnlPercent > this.config.takeProfitPercent) ||
        (position &&
          position.unrealizedPnlPercent < -this.config.stopLossPercent) ||
        (marketAnalysis.trend === 'BEARISH' && marketAnalysis.strength > 70),
    ];

    // 買いシグナルの条件
    const buyConditions = [
      marketAnalysis.trend === 'BULLISH',
      marketAnalysis.strength > 60,
      !position || position.quantity === 0,
      this.dailyTradeCount < this.config.maxDailyTrades,
    ];

    if (sellConditions.every((condition) => condition)) {
      action = 'SELL';
      confidence = 90; // 売りは高信頼度

      if (
        position &&
        position.unrealizedPnlPercent > this.config.takeProfitPercent
      ) {
        reason = `利確条件を満たしました（利益率: ${position.unrealizedPnlPercent.toFixed(2)}%）`;
        expectedReturn = position.unrealizedPnlPercent;
      } else if (
        position &&
        position.unrealizedPnlPercent < -this.config.stopLossPercent
      ) {
        reason = `ストップロス条件を満たしました（損失率: ${position.unrealizedPnlPercent.toFixed(2)}%）`;
        expectedReturn = position.unrealizedPnlPercent;
      } else {
        reason = `市場が下降トレンドのため利確（強度: ${marketAnalysis.strength}%）`;
        expectedReturn = position ? position.unrealizedPnlPercent : 0;
      }
    } else if (buyConditions.every((condition) => condition)) {
      action = 'BUY';
      confidence = Math.min(85, marketAnalysis.strength + 15);
      reason = `市場が上昇トレンドで強度${marketAnalysis.strength}%、技術分析も良好`;
      expectedReturn = this.config.takeProfitPercent;
      stopLoss = currentPrice * (1 - this.config.stopLossPercent / 100);
      takeProfit = currentPrice * (1 + this.config.takeProfitPercent / 100);
    } else {
      reason = '取引条件を満たしていません';
      confidence = 30;
    }

    return {
      action,
      confidence,
      reason,
      expectedReturn,
      stopLoss,
      takeProfit,
      analysis: {
        technical: technicalAnalysis,
        risk: riskAnalysis,
        market: `市場トレンド: ${marketAnalysis.trend}, ボラティリティ: ${marketAnalysis.volatility}, 強度: ${marketAnalysis.strength}%`,
      },
    };
  }

  /**
   * 判断を記録
   */
  private async recordDecision(
    productId: string,
    signal: TradingSignal
  ): Promise<void> {
    await prisma.agentDecision.create({
      data: {
        agentId: this.agentId,
        productId,
        action: signal.action,
        reason: signal.reason,
        technicalAnalysis: signal.analysis.technical,
        riskAnalysis: signal.analysis.risk,
        marketAnalysis: signal.analysis.market,
        confidence: signal.confidence,
        expectedReturn: signal.expectedReturn,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
      },
    });
  }

  /**
   * 取引を実行
   */
  async executeTrade(
    productId: string,
    signal: TradingSignal
  ): Promise<boolean> {
    if (
      signal.action === 'HOLD' ||
      signal.confidence < this.config.minConfidence
    ) {
      return false;
    }

    const product = await prisma.investmentProduct.findUniqueOrThrow({
      where: { id: productId },
    });

    const position = await prisma.investmentPosition.findFirst({
      where: { productId },
    });

    if (signal.action === 'BUY') {
      return await this.executeBuy(product, signal);
    } else if (signal.action === 'SELL' && position) {
      return await this.executeSell(product, position, signal);
    }

    return false;
  }

  /**
   * 買い注文を実行
   */
  private async executeBuy(
    product: InvestmentProduct,
    signal: TradingSignal
  ): Promise<boolean> {
    // ポジションサイズを計算（最大3万円）
    const maxInvestment = Math.min(30000, this.config.maxPositionSize);
    const quantity = Math.floor(maxInvestment / product.currentPrice);

    if (quantity < product.minOrderSize) {
      return false;
    }

    const price = product.currentPrice;
    const fee =
      product.tradingFee + (price * quantity * product.tradingFeeRate) / 100;
    const totalAmount = price * quantity + fee;

    // 取引を記録
    await prisma.investmentTransaction.create({
      data: {
        productId: product.id,
        type: 'BUY',
        quantity,
        price,
        fee,
        totalAmount,
        reason: signal.reason,
        confidence: signal.confidence,
      },
    });

    // ポジションを更新
    await this.updatePosition(product.id, quantity, price, 'BUY');

    this.dailyTradeCount++;
    return true;
  }

  /**
   * 売り注文を実行
   */
  private async executeSell(
    product: InvestmentProduct,
    position: InvestmentPosition,
    signal: TradingSignal
  ): Promise<boolean> {
    const quantity = position.quantity;
    const price = product.currentPrice;
    const fee =
      product.tradingFee + (price * quantity * product.tradingFeeRate) / 100;
    const totalAmount = price * quantity - fee;

    // 取引を記録
    await prisma.investmentTransaction.create({
      data: {
        productId: product.id,
        type: 'SELL',
        quantity,
        price,
        fee,
        totalAmount,
        reason: signal.reason,
        confidence: signal.confidence,
      },
    });

    // ポジションを削除
    await prisma.investmentPosition.delete({
      where: { id: position.id },
    });

    this.dailyTradeCount++;
    return true;
  }

  /**
   * ポジションを更新
   */
  private async updatePosition(
    productId: string,
    quantity: number,
    price: number,
    action: 'BUY' | 'SELL'
  ): Promise<void> {
    const existingPosition = await prisma.investmentPosition.findFirst({
      where: { productId },
    });

    if (action === 'BUY') {
      if (existingPosition) {
        // 既存ポジションを更新
        const newQuantity = existingPosition.quantity + quantity;
        const newTotalCost = existingPosition.totalCost + price * quantity;
        const newAveragePrice = newTotalCost / newQuantity;

        await prisma.investmentPosition.update({
          where: { id: existingPosition.id },
          data: {
            quantity: newQuantity,
            averagePrice: newAveragePrice,
            totalCost: newTotalCost,
            currentPrice: price,
            currentValue: newQuantity * price,
            unrealizedPnl: (price - newAveragePrice) * newQuantity,
            unrealizedPnlPercent:
              ((price - newAveragePrice) / newAveragePrice) * 100,
          },
        });
      } else {
        // 新規ポジションを作成
        await prisma.investmentPosition.create({
          data: {
            productId,
            quantity,
            averagePrice: price,
            currentPrice: price,
            totalCost: price * quantity,
            currentValue: price * quantity,
            unrealizedPnl: 0,
            unrealizedPnlPercent: 0,
          },
        });
      }
    }
  }

  /**
   * 現在のポジション状況を表示
   */
  private async displayCurrentPositions(): Promise<void> {
    const positions = await prisma.investmentPosition.findMany({
      include: { product: true },
    });

    if (positions.length > 0) {
      console.log('💼 現在のポジション:');
      positions.forEach((position) => {
        const pnlStatus =
          position.unrealizedPnlPercent > 0
            ? '📈'
            : position.unrealizedPnlPercent < 0
              ? '📉'
              : '➡️';
        console.log(
          `   ${pnlStatus} ${position.product.symbol}: ${position.quantity}株 @ ¥${position.averagePrice.toLocaleString()}`
        );
        console.log(
          `      現在価格: ¥${position.currentPrice.toLocaleString()}`
        );
        console.log(
          `      未実現損益: ¥${position.unrealizedPnl.toLocaleString()} (${position.unrealizedPnlPercent.toFixed(2)}%)`
        );
      });
    } else {
      console.log('💼 現在ポジションはありません');
    }
  }

  /**
   * 日次取引回数をリセット
   */
  private async resetDailyCount(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastResetDate !== today) {
      this.dailyTradeCount = 0;
      this.lastResetDate = today;
    }
  }

  /**
   * 価格履歴を取得（仮実装）
   */
  private async getPriceHistory(
    productId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number[]> {
    // 実際の実装では外部APIから価格データを取得
    // ここでは仮のデータを生成（より現実的な価格変動）
    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const prices: number[] = [];

    // 商品タイプに応じたベース価格
    const product = await prisma.investmentProduct.findUnique({
      where: { id: productId },
    });
    let basePrice = product?.currentPrice || 1000;

    for (let i = 0; i < days; i++) {
      // 商品タイプに応じた変動率
      let volatility = 0.05; // デフォルト5%
      if (product?.type === 'CRYPTO')
        volatility = 0.15; // 暗号資産15%
      else if (product?.type === 'GOLD')
        volatility = 0.03; // 金3%
      else if (product?.type === 'STOCK') volatility = 0.08; // 株式8%

      const change = (Math.random() - 0.5) * volatility;
      basePrice *= 1 + change;
      prices.push(basePrice);
    }

    return prices;
  }

  /**
   * 移動平均を計算
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const recent = prices.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  /**
   * RSIを計算
   */
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(-change);
      }
    }

    const recentGains = gains.slice(-period);
    const recentLosses = losses.slice(-period);

    const avgGain = recentGains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = recentLosses.reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * ボラティリティを計算
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }
}
