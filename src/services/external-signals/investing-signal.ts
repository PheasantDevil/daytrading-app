import { BaseSignalService, TradingSignal } from './base-signal-service';
import { ScrapingHelper } from './scraping-helper';

/**
 * Investing.comシグナルサービス
 * Investing.comのテクニカルサマリーからシグナルを取得
 */
export class InvestingSignalService extends BaseSignalService {
  name = 'investing_com';

  constructor(cacheTTL: number = 300, rateLimit: number = 2000) {
    super(cacheTTL, rateLimit);
  }

  protected async fetchSignal(symbol: string): Promise<TradingSignal> {
    try {
      // Investing.comのURLは銘柄によって異なるため、検索が必要
      // ここでは簡易的にApple=apple-computer-inc とする
      const symbolSlug = this.getSymbolSlug(symbol);
      const url = `https://www.investing.com/equities/${symbolSlug}-technical`;

      this.logger.info(`Investing.com データ取得: ${url}`);

      // Puppeteerでページを取得
      const result = await ScrapingHelper.evaluate(url, async (page) => {
        try {
          // Technical Summary を取得
          await page.waitForSelector('.technicalSummary', { timeout: 10000 });

          const summaryText = await page
            .$eval('.technicalSummary', (el) => el.textContent?.trim())
            .catch(() => null);

          // 5分足、1時間足、日足のシグナルを取得
          const signals = await page
            .$$eval('.summaryTableLine', (els) =>
              els.map((el) => ({
                timeframe: el.querySelector('.first')?.textContent?.trim(),
                signal: el.querySelector('.second')?.textContent?.trim(),
              }))
            )
            .catch(() => []);

          return {
            summary: summaryText,
            signals,
          };
        } catch (error) {
          this.logger.warn('Investing.com selector error:', error);
          return {
            summary: null,
            signals: [],
          };
        }
      });

      if (!result || !result.summary) {
        throw new Error('Failed to extract Investing.com signal');
      }

      // シグナルを変換
      const signal = this.convertToSignal(result.summary, result.signals);

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
        `Failed to fetch Investing.com signal for ${symbol}:`,
        error
      );
      throw error;
    }
  }

  /**
   * シンボルからInvesting.comのスラッグを取得
   */
  private getSymbolSlug(symbol: string): string {
    const slugMap: { [key: string]: string } = {
      AAPL: 'apple-computer-inc',
      GOOGL: 'alphabet-inc',
      MSFT: 'microsoft-corp',
      TSLA: 'tesla-motors',
      AMZN: 'amazon-com-inc',
      META: 'meta-platforms-inc',
      NVDA: 'nvidia-corp',
    };

    return slugMap[symbol] || symbol.toLowerCase();
  }

  /**
   * Investing.comのシグナルテキストを変換
   */
  private convertToSignal(
    summary: string | null,
    signals: Array<{ timeframe?: string; signal?: string }>
  ): {
    signal: 'BUY' | 'HOLD' | 'SELL';
    confidence: number;
    reason: string;
  } {
    let buyCount = 0;
    let sellCount = 0;
    const reasons: string[] = [];

    // Summary判定
    if (summary) {
      if (summary.includes('Strong Buy')) {
        buyCount += 3;
        reasons.push('Strong Buy');
      } else if (summary.includes('Buy')) {
        buyCount += 2;
        reasons.push('Buy');
      } else if (summary.includes('Strong Sell')) {
        sellCount += 3;
        reasons.push('Strong Sell');
      } else if (summary.includes('Sell')) {
        sellCount += 2;
        reasons.push('Sell');
      }
    }

    // 各時間軸のシグナル集計
    for (const s of signals) {
      if (s.signal?.includes('Buy')) buyCount += 1;
      if (s.signal?.includes('Sell')) sellCount += 1;
    }

    // 総合判定
    let signal: 'BUY' | 'HOLD' | 'SELL';
    let confidence: number;

    if (buyCount > sellCount) {
      signal = 'BUY';
      confidence = Math.min(50 + buyCount * 10, 95);
    } else if (sellCount > buyCount) {
      signal = 'SELL';
      confidence = Math.min(50 + sellCount * 10, 95);
    } else {
      signal = 'HOLD';
      confidence = 50;
    }

    return {
      signal,
      confidence,
      reason: `Investing.com: ${reasons.join(', ') || 'Neutral'}`,
    };
  }
}

