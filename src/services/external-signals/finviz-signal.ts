import { BaseSignalService, TradingSignal } from './base-signal-service';
import { ScrapingHelper } from './scraping-helper';

/**
 * Finvizシグナルサービス
 * Finvizのアナリストレーティングとテクニカル指標からシグナルを取得
 */
export class FinvizSignalService extends BaseSignalService {
  name = 'finviz';

  constructor(cacheTTL: number = 300, rateLimit: number = 2000) {
    super(cacheTTL, rateLimit);
  }

  protected async fetchSignal(symbol: string): Promise<TradingSignal> {
    try {
      const url = `https://finviz.com/quote.ashx?t=${symbol}`;

      this.logger.info(`Finviz データ取得: ${url}`);

      // Puppeteerでページを取得
      const result = await ScrapingHelper.evaluate(url, async (page) => {
        try {
          await page.waitForSelector('.snapshot-table2', { timeout: 10000 });

          // アナリストレーティングを取得 (1.0=Strong Buy, 5.0=Sell)
          const analystRecom = await page
            .evaluate(() => {
              const rows = Array.from(
                document.querySelectorAll('.snapshot-td2')
              );
              for (const row of rows) {
                const label = row.querySelector('b')?.textContent;
                if (label?.includes('Analyst Recom')) {
                  const value = row.textContent
                    ?.replace('Analyst Recom', '')
                    .trim();
                  return value ? parseFloat(value) : null;
                }
              }
              return null;
            })
            .catch(() => null);

          // テクニカルインジケーターを取得
          const technical = await page
            .evaluate(() => {
              const rows = Array.from(
                document.querySelectorAll('.snapshot-td2')
              );
              const data: any = {};

              for (const row of rows) {
                const label = row.querySelector('b')?.textContent?.trim();
                const value = row.textContent?.replace(label || '', '').trim();

                if (label === 'RSI (14)') data.rsi = parseFloat(value);
                if (label === 'Perf Week') data.perfWeek = value;
                if (label === 'Perf Month') data.perfMonth = value;
              }

              return data;
            })
            .catch(() => ({}));

          return {
            analystRecom,
            technical,
          };
        } catch (error) {
          this.logger.warn('Finviz selector error:', error);
          return {
            analystRecom: null,
            technical: {},
          };
        }
      });

      if (!result || result.analystRecom === null) {
        throw new Error('Failed to extract Finviz signal');
      }

      // シグナルを変換
      const signal = this.convertToSignal(
        result.analystRecom,
        result.technical
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
      this.logger.error(`Failed to fetch Finviz signal for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Finvizのデータをシグナルに変換
   */
  private convertToSignal(
    analystRecom: number | null,
    technical: any
  ): {
    signal: 'BUY' | 'HOLD' | 'SELL';
    confidence: number;
    reason: string;
  } {
    const reasons: string[] = [];
    let buyScore = 0;
    let sellScore = 0;

    // アナリストレーティング分析
    // 1.0-2.0: Strong Buy/Buy
    // 2.0-3.0: Hold
    // 3.0-5.0: Sell/Strong Sell
    if (analystRecom !== null) {
      if (analystRecom <= 1.5) {
        buyScore += 3;
        reasons.push(`Strong Buy (${analystRecom.toFixed(2)})`);
      } else if (analystRecom <= 2.0) {
        buyScore += 2;
        reasons.push(`Buy (${analystRecom.toFixed(2)})`);
      } else if (analystRecom <= 3.0) {
        reasons.push(`Hold (${analystRecom.toFixed(2)})`);
      } else if (analystRecom <= 4.0) {
        sellScore += 2;
        reasons.push(`Sell (${analystRecom.toFixed(2)})`);
      } else {
        sellScore += 3;
        reasons.push(`Strong Sell (${analystRecom.toFixed(2)})`);
      }
    }

    // RSI分析
    if (technical.rsi !== undefined) {
      if (technical.rsi < 30) {
        buyScore += 2;
        reasons.push(`過売り (RSI=${technical.rsi.toFixed(0)})`);
      } else if (technical.rsi > 70) {
        sellScore += 2;
        reasons.push(`過買い (RSI=${technical.rsi.toFixed(0)})`);
      }
    }

    // パフォーマンス分析
    if (technical.perfWeek) {
      const perfWeekNum = parseFloat(technical.perfWeek.replace('%', ''));
      if (perfWeekNum > 5) {
        buyScore += 1;
        reasons.push(`週間上昇${technical.perfWeek}`);
      } else if (perfWeekNum < -5) {
        sellScore += 1;
        reasons.push(`週間下落${technical.perfWeek}`);
      }
    }

    // 総合判定
    let signal: 'BUY' | 'HOLD' | 'SELL';
    let confidence: number;

    if (buyScore > sellScore + 1) {
      signal = 'BUY';
      confidence = Math.min(60 + buyScore * 8, 95);
    } else if (sellScore > buyScore + 1) {
      signal = 'SELL';
      confidence = Math.min(60 + sellScore * 8, 95);
    } else {
      signal = 'HOLD';
      confidence = 50;
    }

    return {
      signal,
      confidence,
      reason: `Finviz: ${reasons.join(', ')}`,
    };
  }
}

