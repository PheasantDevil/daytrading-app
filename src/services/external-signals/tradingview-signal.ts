import { BaseSignalService, TradingSignal } from './base-signal-service';
import { ScrapingHelper } from './scraping-helper';

/**
 * TradingViewシグナルサービス
 * TradingViewのテクニカルサマリーからシグナルを取得
 */
export class TradingViewSignalService extends BaseSignalService {
  name = 'tradingview';

  constructor(cacheTTL: number = 300, rateLimit: number = 2000) {
    super(cacheTTL, rateLimit);
  }

  protected async fetchSignal(symbol: string): Promise<TradingSignal> {
    try {
      const url = `https://www.tradingview.com/symbols/NASDAQ-${symbol}/technicals/`;

      this.logger.info(`TradingView データ取得: ${url}`);

      // Puppeteerでページを取得
      const result = await ScrapingHelper.evaluate(url, async (page) => {
        try {
          // Technical Summary のシグナルを取得
          await page.waitForSelector('.speedometerSignal-pyzN--tL', {
            timeout: 10000,
          });

          const signalText = await page
            .$eval('.speedometerSignal-pyzN--tL', (el) =>
              el.textContent?.trim()
            )
            .catch(() => null);

          // 移動平均線の評価を取得
          const maSignal = await page
            .$eval('[data-name="moving-averages-gauge"]', (el) =>
              el.textContent?.trim()
            )
            .catch(() => null);

          // オシレーターの評価を取得
          const oscillatorSignal = await page
            .$eval('[data-name="oscillators-gauge"]', (el) =>
              el.textContent?.trim()
            )
            .catch(() => null);

          return {
            overall: signalText,
            movingAverage: maSignal,
            oscillator: oscillatorSignal,
          };
        } catch (error) {
          this.logger.warn('TradingView selector error:', error);
          return {
            overall: null,
            movingAverage: null,
            oscillator: null,
          };
        }
      });

      if (!result || !result.overall) {
        throw new Error('Failed to extract TradingView signal');
      }

      // シグナルを変換
      const signal = this.convertToSignal(
        result.overall,
        result.movingAverage,
        result.oscillator
      );

      return {
        source: this.name,
        symbol,
        signal: signal.signal,
        confidence: signal.confidence,
        reason: signal.reason,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch TradingView signal for ${symbol}:`,
        error
      );
      throw error;
    }
  }

  /**
   * TradingViewのシグナルテキストを変換
   */
  private convertToSignal(
    overall: string | null,
    movingAverage: string | null,
    oscillator: string | null
  ): {
    signal: 'BUY' | 'HOLD' | 'SELL';
    confidence: number;
    reason: string;
  } {
    const signals: string[] = [];
    let buyCount = 0;
    let sellCount = 0;

    // Overall シグナル
    if (overall) {
      if (overall.includes('Strong Buy')) {
        buyCount += 2;
        signals.push('Strong Buy');
      } else if (overall.includes('Buy')) {
        buyCount += 1;
        signals.push('Buy');
      } else if (overall.includes('Strong Sell')) {
        sellCount += 2;
        signals.push('Strong Sell');
      } else if (overall.includes('Sell')) {
        sellCount += 1;
        signals.push('Sell');
      } else {
        signals.push('Neutral');
      }
    }

    // Moving Average シグナル
    if (movingAverage) {
      if (movingAverage.includes('Buy')) buyCount += 1;
      if (movingAverage.includes('Sell')) sellCount += 1;
    }

    // Oscillator シグナル
    if (oscillator) {
      if (oscillator.includes('Buy')) buyCount += 1;
      if (oscillator.includes('Sell')) sellCount += 1;
    }

    // 総合判定
    let signal: 'BUY' | 'HOLD' | 'SELL';
    let confidence: number;

    if (buyCount > sellCount) {
      signal = 'BUY';
      confidence = Math.min(50 + buyCount * 15, 95);
    } else if (sellCount > buyCount) {
      signal = 'SELL';
      confidence = Math.min(50 + sellCount * 15, 95);
    } else {
      signal = 'HOLD';
      confidence = 50;
    }

    return {
      signal,
      confidence,
      reason: `TradingView: ${signals.join(', ')}`,
    };
  }
}
