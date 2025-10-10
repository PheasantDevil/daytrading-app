import puppeteer, { Browser, Page } from 'puppeteer';
import { Logger } from '../../utils/logger';

/**
 * スクレイピングヘルパークラス
 */
export class ScrapingHelper {
  private static browser: Browser | null = null;
  private static logger = new Logger('ScrapingHelper');

  /**
   * ブラウザインスタンスの取得（シングルトン）
   */
  static async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.logger.info('Puppeteer browser起動中...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      this.logger.info('✅ Puppeteer browser起動完了');
    }
    return this.browser;
  }

  /**
   * 新しいページを開く
   */
  static async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // User-Agent設定
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DayTradingApp/1.0'
    );

    // ビューポート設定
    await page.setViewport({ width: 1920, height: 1080 });

    return page;
  }

  /**
   * URLからHTMLを取得
   */
  static async fetchHTML(url: string, timeout: number = 30000): Promise<string> {
    const page = await this.newPage();
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });
      const html = await page.content();
      return html;
    } catch (error) {
      this.logger.error(`Failed to fetch HTML from ${url}:`, error);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * セレクタでテキストを取得
   */
  static async getTextBySelector(
    url: string,
    selector: string,
    timeout: number = 30000
  ): Promise<string | null> {
    const page = await this.newPage();
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      await page.waitForSelector(selector, { timeout: 5000 }).catch(() => {
        this.logger.warn(`Selector not found: ${selector}`);
      });

      const text = await page.$eval(selector, (el) => el.textContent?.trim() || '');
      return text || null;
    } catch (error) {
      this.logger.error(`Failed to get text from ${url}:`, error);
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * 複数セレクタでテキストを取得
   */
  static async getTextsBySelector(
    url: string,
    selector: string,
    timeout: number = 30000
  ): Promise<string[]> {
    const page = await this.newPage();
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      await page.waitForSelector(selector, { timeout: 5000 }).catch(() => {
        this.logger.warn(`Selector not found: ${selector}`);
      });

      const texts = await page.$$eval(selector, (els) =>
        els.map((el) => el.textContent?.trim() || '')
      );
      return texts.filter((t) => t !== '');
    } catch (error) {
      this.logger.error(`Failed to get texts from ${url}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * カスタム評価関数を実行
   */
  static async evaluate<T>(
    url: string,
    evaluateFn: (page: Page) => Promise<T>,
    timeout: number = 30000
  ): Promise<T | null> {
    const page = await this.newPage();
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      const result = await evaluateFn(page);
      return result;
    } catch (error) {
      this.logger.error(`Failed to evaluate on ${url}:`, error);
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * ブラウザのクローズ
   */
  static async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.info('Puppeteer browser closed');
    }
  }

  /**
   * ページのスクリーンショット（デバッグ用）
   */
  static async screenshot(
    url: string,
    path: string,
    timeout: number = 30000
  ): Promise<void> {
    const page = await this.newPage();
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });
      await page.screenshot({ path, fullPage: true });
      this.logger.info(`Screenshot saved: ${path}`);
    } finally {
      await page.close();
    }
  }
}

/**
 * プロセス終了時にブラウザをクローズ
 */
process.on('exit', () => {
  ScrapingHelper.close().catch(console.error);
});

process.on('SIGINT', async () => {
  await ScrapingHelper.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await ScrapingHelper.close();
  process.exit(0);
});

