import { YahooFinanceService } from '../yahoo-finance-service';
import { BaseSignalService, TradingSignal } from './base-signal-service';

/**
 * Yahoo Financeシグナルサービス
 * 既存のYahooFinanceServiceを活用してシグナルを生成
 */
export class YahooFinanceSignalService extends BaseSignalService {
  name = 'yahoo_finance';
  private yahooService: YahooFinanceService;

  constructor(cacheTTL: number = 300, rateLimit: number = 1000) {
    super(cacheTTL, rateLimit);
    this.yahooService = new YahooFinanceService();
  }

  protected async fetchSignal(symbol: string): Promise<TradingSignal> {
    try {
      // Yahoo Financeから株価データを取得
      const quote = await this.yahooService.getQuote(symbol);

      // テクニカル分析に基づくシグナル生成
      const signal = this.analyzeQuote(quote);

      return {
        source: this.name,
        symbol: quote.symbol,
        signal: signal.signal,
        confidence: signal.confidence,
        reason: signal.reason,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch Yahoo Finance signal for ${symbol}:`,
        error
      );
      throw error;
    }
  }

  /**
   * 株価データからシグナルを分析
   */
  private analyzeQuote(quote: any): {
    signal: 'BUY' | 'HOLD' | 'SELL';
    confidence: number;
    reason: string;
  } {
    const reasons: string[] = [];
    let buyScore = 0;
    let sellScore = 0;

    // 1. 価格変動率の分析
    if (quote.changePercent > 2) {
      buyScore += 2;
      reasons.push(`強い上昇トレンド(+${quote.changePercent.toFixed(2)}%)`);
    } else if (quote.changePercent > 0) {
      buyScore += 1;
      reasons.push(`上昇トレンド(+${quote.changePercent.toFixed(2)}%)`);
    } else if (quote.changePercent < -2) {
      sellScore += 2;
      reasons.push(`強い下降トレンド(${quote.changePercent.toFixed(2)}%)`);
    } else if (quote.changePercent < 0) {
      sellScore += 1;
      reasons.push(`下降トレンド(${quote.changePercent.toFixed(2)}%)`);
    }

    // 2. 出来高分析
    const avgVolume = 2000000; // 平均出来高の想定値
    if (quote.volume > avgVolume * 1.5) {
      buyScore += 1;
      reasons.push(`高出来高(${(quote.volume / 1000000).toFixed(1)}M)`);
    } else if (quote.volume < avgVolume * 0.5) {
      sellScore += 1;
      reasons.push(`低出来高(${(quote.volume / 1000000).toFixed(1)}M)`);
    }

    // 3. 価格位置の分析（高値・安値との比較）
    const priceRange = quote.high - quote.low;
    const pricePosition = (quote.price - quote.low) / priceRange;

    if (pricePosition > 0.8) {
      // 高値圏
      sellScore += 1;
      reasons.push('高値圏での取引');
    } else if (pricePosition < 0.2) {
      // 安値圏
      buyScore += 1;
      reasons.push('安値圏での取引');
    }

    // 4. 前日終値との比較
    const gapPercent =
      ((quote.price - quote.previousClose) / quote.previousClose) * 100;
    if (gapPercent > 1) {
      buyScore += 1;
      reasons.push(`ギャップアップ(+${gapPercent.toFixed(2)}%)`);
    } else if (gapPercent < -1) {
      sellScore += 1;
      reasons.push(`ギャップダウン(${gapPercent.toFixed(2)}%)`);
    }

    // 総合判定
    let signal: 'BUY' | 'HOLD' | 'SELL';
    let confidence: number;

    if (buyScore > sellScore + 1) {
      signal = 'BUY';
      confidence = Math.min(60 + buyScore * 10, 95);
    } else if (sellScore > buyScore + 1) {
      signal = 'SELL';
      confidence = Math.min(60 + sellScore * 10, 95);
    } else {
      signal = 'HOLD';
      confidence = 50;
    }

    return {
      signal,
      confidence,
      reason: reasons.join(', ') || 'ニュートラルな市場状況',
    };
  }
}
