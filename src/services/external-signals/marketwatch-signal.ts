import { BaseSignalService, TradingSignal } from './base-signal-service';
import { ScrapingHelper } from './scraping-helper';

/**
 * MarketWatchシグナルサービス
 * MarketWatchのアナリストレーティングからシグナルを取得
 */
export class MarketWatchSignalService extends BaseSignalService {
  name = 'marketwatch';

  constructor(cacheTTL: number = 300, rateLimit: number = 2000) {
    super(cacheTTL, rateLimit);
  }

  protected async fetchSignal(symbol: string): Promise<TradingSignal> {
    try {
      const url = `https://www.marketwatch.com/investing/stock/${symbol.toLowerCase()}/analystestimates`;

      this.logger.info(`MarketWatch データ取得: ${url}`);

      // Puppeteerでページを取得
      const result = await ScrapingHelper.evaluate(url, async (page) => {
        try {
          await page.waitForSelector('.element--table', { timeout: 10000 });

          // アナリストレーティングを取得
          const ratings = await page
            .evaluate(() => {
              const ratingElements = Array.from(
                document.querySelectorAll('.table__row')
              );

              let buy = 0;
              let hold = 0;
              let sell = 0;

              for (const row of ratingElements) {
                const cells = row.querySelectorAll('.table__cell');
                if (cells.length >= 2) {
                  const label = cells[0]?.textContent?.trim().toLowerCase();
                  const value = cells[1]?.textContent?.trim();

                  if (label?.includes('buy') && !label.includes('hold')) {
                    buy = parseInt(value || '0');
                  } else if (label?.includes('hold')) {
                    hold = parseInt(value || '0');
                  } else if (label?.includes('sell')) {
                    sell = parseInt(value || '0');
                  }
                }
              }

              return { buy, hold, sell };
            })
            .catch(() => ({ buy: 0, hold: 0, sell: 0 }));

          // 目標株価を取得
          const targetPrice = await page
            .evaluate(() => {
              const priceElement = document.querySelector(
                '[data-channel="/zigman2/quotes/composite/us/stock/aapl/analystestimates"] .table__cell--number'
              );
              return priceElement?.textContent?.trim();
            })
            .catch(() => null);

          return {
            ratings,
            targetPrice,
          };
        } catch (error) {
          this.logger.warn('MarketWatch selector error:', error);
          return {
            ratings: { buy: 0, hold: 0, sell: 0 },
            targetPrice: null,
          };
        }
      });

      if (!result || (result.ratings.buy === 0 && result.ratings.sell === 0)) {
        throw new Error('Failed to extract MarketWatch signal');
      }

      // シグナルを変換
      const signal = this.convertToSignal(result.ratings, result.targetPrice);

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
        `Failed to fetch MarketWatch signal for ${symbol}:`,
        error
      );
      throw error;
    }
  }

  /**
   * MarketWatchのデータをシグナルに変換
   */
  private convertToSignal(
    ratings: { buy: number; hold: number; sell: number },
    targetPrice: string | null
  ): {
    signal: 'BUY' | 'HOLD' | 'SELL';
    confidence: number;
    reason: string;
  } {
    const total = ratings.buy + ratings.hold + ratings.sell;
    if (total === 0) {
      return {
        signal: 'HOLD',
        confidence: 50,
        reason: 'MarketWatch: データなし',
      };
    }

    const buyRatio = ratings.buy / total;
    const sellRatio = ratings.sell / total;

    let signal: 'BUY' | 'HOLD' | 'SELL';
    let confidence: number;

    if (buyRatio > 0.6) {
      signal = 'BUY';
      confidence = Math.min(60 + buyRatio * 30, 95);
    } else if (sellRatio > 0.6) {
      signal = 'SELL';
      confidence = Math.min(60 + sellRatio * 30, 95);
    } else if (buyRatio > sellRatio) {
      signal = 'BUY';
      confidence = 60;
    } else if (sellRatio > buyRatio) {
      signal = 'SELL';
      confidence = 60;
    } else {
      signal = 'HOLD';
      confidence = 50;
    }

    const reason = `MarketWatch: Buy=${ratings.buy} Hold=${ratings.hold} Sell=${ratings.sell}`;

    return {
      signal,
      confidence,
      reason,
    };
  }
}

