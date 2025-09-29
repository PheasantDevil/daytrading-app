/**
 * ローカライゼーションサービス
 * 多言語対応、多通貨対応、タイムゾーン管理
 */

export interface Locale {
  code: string; // 'ja-JP', 'en-US', 'zh-CN'
  name: string;
  language: string;
  country: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
}

export interface Translation {
  key: string;
  locale: string;
  value: string;
  context?: string;
  plural?: {
    zero?: string;
    one?: string;
    other?: string;
  };
}

export interface CurrencyInfo {
  code: string; // 'USD', 'JPY', 'EUR'
  symbol: string;
  name: string;
  decimals: number;
  symbolPosition: 'BEFORE' | 'AFTER';
  thousandsSeparator: string;
  decimalSeparator: string;
}

export interface TimezoneInfo {
  id: string; // 'Asia/Tokyo', 'America/New_York'
  name: string;
  offset: number; // UTC offset in minutes
  dstOffset?: number; // Daylight saving time offset
  country: string;
  region: string;
}

export interface LocalizationConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale: string;
  currency: {
    default: string;
    supported: string[];
    autoDetect: boolean;
  };
  timezone: {
    default: string;
    autoDetect: boolean;
    supported: string[];
  };
  dateTime: {
    formats: Record<string, string>;
    relativeTime: boolean;
  };
  number: {
    formats: Record<string, Intl.NumberFormatOptions>;
    precision: number;
  };
}

export interface LocalizedMessage {
  key: string;
  locale: string;
  value: string;
  params?: Record<string, any>;
}

export class LocalizationService {
  private config: LocalizationConfig;
  private translations: Map<string, Map<string, Translation>> = new Map();
  private currencies: Map<string, CurrencyInfo> = new Map();
  private timezones: Map<string, TimezoneInfo> = new Map();
  private locales: Map<string, Locale> = new Map();
  private isInitialized: boolean = false;

  constructor(config: LocalizationConfig) {
    this.config = config;
  }

  /**
   * ローカライゼーションサービスを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 ローカライゼーションサービス初期化中...');

      // ロケールを初期化
      await this.initializeLocales();

      // 通貨情報を初期化
      await this.initializeCurrencies();

      // タイムゾーン情報を初期化
      await this.initializeTimezones();

      // 翻訳を初期化
      await this.initializeTranslations();

      this.isInitialized = true;
      console.log('✅ ローカライゼーションサービス初期化完了');
      return true;
    } catch (error) {
      console.error('❌ ローカライゼーションサービス初期化エラー:', error);
      return false;
    }
  }

  /**
   * テキストを翻訳
   */
  translate(key: string, locale: string, params?: Record<string, any>): string {
    try {
      if (!this.isInitialized) {
        throw new Error('ローカライゼーションサービスが初期化されていません');
      }

      const translations = this.translations.get(locale);
      if (!translations) {
        // フォールバックロケールを試行
        const fallbackTranslations = this.translations.get(
          this.config.fallbackLocale
        );
        if (!fallbackTranslations) {
          return key; // 翻訳が見つからない場合はキーを返す
        }
        return this.formatMessage(
          fallbackTranslations.get(key)?.value || key,
          params
        );
      }

      const translation = translations.get(key);
      if (!translation) {
        // フォールバックロケールを試行
        const fallbackTranslations = this.translations.get(
          this.config.fallbackLocale
        );
        if (fallbackTranslations) {
          const fallbackTranslation = fallbackTranslations.get(key);
          if (fallbackTranslation) {
            return this.formatMessage(fallbackTranslation.value, params);
          }
        }
        return key;
      }

      return this.formatMessage(translation.value, params);
    } catch (error) {
      console.error(`❌ 翻訳エラー: ${key}`, error);
      return key;
    }
  }

  /**
   * 通貨をフォーマット
   */
  formatCurrency(amount: number, currency: string, locale: string): string {
    try {
      if (!this.isInitialized) {
        throw new Error('ローカライゼーションサービスが初期化されていません');
      }

      const currencyInfo = this.currencies.get(currency);
      if (!currencyInfo) {
        throw new Error(`通貨が見つかりません: ${currency}`);
      }

      const localeInfo = this.locales.get(locale);
      if (!localeInfo) {
        throw new Error(`ロケールが見つかりません: ${locale}`);
      }

      // 数値をフォーマット
      const formattedNumber = this.formatNumber(amount, locale, {
        minimumFractionDigits: currencyInfo.decimals,
        maximumFractionDigits: currencyInfo.decimals,
      });

      // 通貨記号を追加
      if (currencyInfo.symbolPosition === 'BEFORE') {
        return `${currencyInfo.symbol}${formattedNumber}`;
      } else {
        return `${formattedNumber}${currencyInfo.symbol}`;
      }
    } catch (error) {
      console.error(`❌ 通貨フォーマットエラー: ${currency}`, error);
      return amount.toString();
    }
  }

  /**
   * 数値をフォーマット
   */
  formatNumber(
    value: number,
    locale: string,
    options?: Intl.NumberFormatOptions
  ): string {
    try {
      if (!this.isInitialized) {
        throw new Error('ローカライゼーションサービスが初期化されていません');
      }

      const localeInfo = this.locales.get(locale);
      if (!localeInfo) {
        throw new Error(`ロケールが見つかりません: ${locale}`);
      }

      const defaultOptions: Intl.NumberFormatOptions = {
        ...(this.config.number.formats[locale] || {}),
        ...options,
      };

      return new Intl.NumberFormat(locale, defaultOptions).format(value);
    } catch (error) {
      console.error(`❌ 数値フォーマットエラー: ${locale}`, error);
      return value.toString();
    }
  }

  /**
   * 日付をフォーマット
   */
  formatDate(date: Date, locale: string, format?: string): string {
    try {
      if (!this.isInitialized) {
        throw new Error('ローカライゼーションサービスが初期化されていません');
      }

      const localeInfo = this.locales.get(locale);
      if (!localeInfo) {
        throw new Error(`ロケールが見つかりません: ${locale}`);
      }

      const dateFormat = format || localeInfo.dateFormat;
      const options: Intl.DateTimeFormatOptions =
        this.parseDateFormat(dateFormat);

      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (error) {
      console.error(`❌ 日付フォーマットエラー: ${locale}`, error);
      return date.toISOString();
    }
  }

  /**
   * タイムゾーンを変換
   */
  convertTimezone(date: Date, fromTz: string, toTz: string): Date {
    try {
      if (!this.isInitialized) {
        throw new Error('ローカライゼーションサービスが初期化されていません');
      }

      const fromTimezone = this.timezones.get(fromTz);
      const toTimezone = this.timezones.get(toTz);

      if (!fromTimezone || !toTimezone) {
        throw new Error('タイムゾーンが見つかりません');
      }

      // 簡略化されたタイムゾーン変換
      const fromOffset = fromTimezone.offset;
      const toOffset = toTimezone.offset;
      const offsetDiff = toOffset - fromOffset;

      return new Date(date.getTime() + offsetDiff * 60 * 1000);
    } catch (error) {
      console.error(`❌ タイムゾーン変換エラー: ${fromTz} -> ${toTz}`, error);
      return date;
    }
  }

  /**
   * 相対時間を取得
   */
  getRelativeTime(date: Date, locale: string): string {
    try {
      if (!this.isInitialized) {
        throw new Error('ローカライゼーションサービスが初期化されていません');
      }

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSeconds < 60) {
        return this.translate('time.just_now', locale);
      } else if (diffMinutes < 60) {
        return this.translate('time.minutes_ago', locale, {
          count: diffMinutes,
        });
      } else if (diffHours < 24) {
        return this.translate('time.hours_ago', locale, { count: diffHours });
      } else if (diffDays < 7) {
        return this.translate('time.days_ago', locale, { count: diffDays });
      } else {
        return this.formatDate(date, locale);
      }
    } catch (error) {
      console.error(`❌ 相対時間取得エラー: ${locale}`, error);
      return date.toISOString();
    }
  }

  /**
   * ロケールを検出
   */
  detectLocale(acceptLanguage?: string, userAgent?: string): string {
    try {
      if (acceptLanguage) {
        const languages = acceptLanguage.split(',').map((lang) => {
          const [code, quality] = lang.trim().split(';q=');
          return {
            code: code.trim(),
            quality: quality ? parseFloat(quality) : 1.0,
          };
        });

        // 品質でソート
        languages.sort((a, b) => b.quality - a.quality);

        // サポートされているロケールを検索
        for (const lang of languages) {
          if (this.config.supportedLocales.includes(lang.code)) {
            return lang.code;
          }

          // 言語コードのみでマッチング
          const languageCode = lang.code.split('-')[0];
          const supportedLocale = this.config.supportedLocales.find((locale) =>
            locale.startsWith(languageCode)
          );
          if (supportedLocale) {
            return supportedLocale;
          }
        }
      }

      return this.config.defaultLocale;
    } catch (error) {
      console.error('❌ ロケール検出エラー:', error);
      return this.config.defaultLocale;
    }
  }

  /**
   * 通貨を検出
   */
  detectCurrency(locale: string): string {
    try {
      const localeInfo = this.locales.get(locale);
      if (
        localeInfo &&
        this.config.currency.supported.includes(localeInfo.currency)
      ) {
        return localeInfo.currency;
      }

      return this.config.currency.default;
    } catch (error) {
      console.error(`❌ 通貨検出エラー: ${locale}`, error);
      return this.config.currency.default;
    }
  }

  /**
   * タイムゾーンを検出
   */
  detectTimezone(): string {
    try {
      if (this.config.timezone.autoDetect) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (this.config.timezone.supported.includes(timezone)) {
          return timezone;
        }
      }

      return this.config.timezone.default;
    } catch (error) {
      console.error('❌ タイムゾーン検出エラー:', error);
      return this.config.timezone.default;
    }
  }

  /**
   * ロケールを初期化
   */
  private async initializeLocales(): Promise<void> {
    const defaultLocales: Locale[] = [
      {
        code: 'ja-JP',
        name: '日本語',
        language: 'ja',
        country: 'JP',
        currency: 'JPY',
        timezone: 'Asia/Tokyo',
        dateFormat: 'YYYY/MM/DD',
        numberFormat: 'ja-JP',
      },
      {
        code: 'en-US',
        name: 'English (US)',
        language: 'en',
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        numberFormat: 'en-US',
      },
      {
        code: 'zh-CN',
        name: '中文 (简体)',
        language: 'zh',
        country: 'CN',
        currency: 'CNY',
        timezone: 'Asia/Shanghai',
        dateFormat: 'YYYY-MM-DD',
        numberFormat: 'zh-CN',
      },
    ];

    for (const locale of defaultLocales) {
      this.locales.set(locale.code, locale);
    }

    console.log(`✅ ロケール初期化完了: ${defaultLocales.length}個`);
  }

  /**
   * 通貨情報を初期化
   */
  private async initializeCurrencies(): Promise<void> {
    const defaultCurrencies: CurrencyInfo[] = [
      {
        code: 'USD',
        symbol: '$',
        name: 'US Dollar',
        decimals: 2,
        symbolPosition: 'BEFORE',
        thousandsSeparator: ',',
        decimalSeparator: '.',
      },
      {
        code: 'JPY',
        symbol: '¥',
        name: 'Japanese Yen',
        decimals: 0,
        symbolPosition: 'BEFORE',
        thousandsSeparator: ',',
        decimalSeparator: '.',
      },
      {
        code: 'EUR',
        symbol: '€',
        name: 'Euro',
        decimals: 2,
        symbolPosition: 'AFTER',
        thousandsSeparator: '.',
        decimalSeparator: ',',
      },
      {
        code: 'CNY',
        symbol: '¥',
        name: 'Chinese Yuan',
        decimals: 2,
        symbolPosition: 'BEFORE',
        thousandsSeparator: ',',
        decimalSeparator: '.',
      },
    ];

    for (const currency of defaultCurrencies) {
      this.currencies.set(currency.code, currency);
    }

    console.log(`✅ 通貨情報初期化完了: ${defaultCurrencies.length}個`);
  }

  /**
   * タイムゾーン情報を初期化
   */
  private async initializeTimezones(): Promise<void> {
    const defaultTimezones: TimezoneInfo[] = [
      {
        id: 'Asia/Tokyo',
        name: 'Japan Standard Time',
        offset: 540, // UTC+9
        country: 'JP',
        region: 'Asia',
      },
      {
        id: 'America/New_York',
        name: 'Eastern Time',
        offset: -300, // UTC-5 (EST)
        dstOffset: -240, // UTC-4 (EDT)
        country: 'US',
        region: 'America',
      },
      {
        id: 'Asia/Shanghai',
        name: 'China Standard Time',
        offset: 480, // UTC+8
        country: 'CN',
        region: 'Asia',
      },
      {
        id: 'Europe/London',
        name: 'Greenwich Mean Time',
        offset: 0, // UTC+0 (GMT)
        dstOffset: 60, // UTC+1 (BST)
        country: 'GB',
        region: 'Europe',
      },
    ];

    for (const timezone of defaultTimezones) {
      this.timezones.set(timezone.id, timezone);
    }

    console.log(`✅ タイムゾーン情報初期化完了: ${defaultTimezones.length}個`);
  }

  /**
   * 翻訳を初期化
   */
  private async initializeTranslations(): Promise<void> {
    const defaultTranslations: Translation[] = [
      // 日本語
      { key: 'common.save', locale: 'ja-JP', value: '保存' },
      { key: 'common.cancel', locale: 'ja-JP', value: 'キャンセル' },
      { key: 'common.delete', locale: 'ja-JP', value: '削除' },
      { key: 'common.confirm', locale: 'ja-JP', value: '確認' },
      { key: 'trading.buy', locale: 'ja-JP', value: '買い' },
      { key: 'trading.sell', locale: 'ja-JP', value: '売り' },
      { key: 'trading.hold', locale: 'ja-JP', value: '保持' },
      { key: 'time.just_now', locale: 'ja-JP', value: 'たった今' },
      { key: 'time.minutes_ago', locale: 'ja-JP', value: '{count}分前' },
      { key: 'time.hours_ago', locale: 'ja-JP', value: '{count}時間前' },
      { key: 'time.days_ago', locale: 'ja-JP', value: '{count}日前' },

      // 英語
      { key: 'common.save', locale: 'en-US', value: 'Save' },
      { key: 'common.cancel', locale: 'en-US', value: 'Cancel' },
      { key: 'common.delete', locale: 'en-US', value: 'Delete' },
      { key: 'common.confirm', locale: 'en-US', value: 'Confirm' },
      { key: 'trading.buy', locale: 'en-US', value: 'Buy' },
      { key: 'trading.sell', locale: 'en-US', value: 'Sell' },
      { key: 'trading.hold', locale: 'en-US', value: 'Hold' },
      { key: 'time.just_now', locale: 'en-US', value: 'Just now' },
      {
        key: 'time.minutes_ago',
        locale: 'en-US',
        value: '{count} minutes ago',
      },
      { key: 'time.hours_ago', locale: 'en-US', value: '{count} hours ago' },
      { key: 'time.days_ago', locale: 'en-US', value: '{count} days ago' },

      // 中国語
      { key: 'common.save', locale: 'zh-CN', value: '保存' },
      { key: 'common.cancel', locale: 'zh-CN', value: '取消' },
      { key: 'common.delete', locale: 'zh-CN', value: '删除' },
      { key: 'common.confirm', locale: 'zh-CN', value: '确认' },
      { key: 'trading.buy', locale: 'zh-CN', value: '买入' },
      { key: 'trading.sell', locale: 'zh-CN', value: '卖出' },
      { key: 'trading.hold', locale: 'zh-CN', value: '持有' },
      { key: 'time.just_now', locale: 'zh-CN', value: '刚刚' },
      { key: 'time.minutes_ago', locale: 'zh-CN', value: '{count}分钟前' },
      { key: 'time.hours_ago', locale: 'zh-CN', value: '{count}小时前' },
      { key: 'time.days_ago', locale: 'zh-CN', value: '{count}天前' },
    ];

    for (const translation of defaultTranslations) {
      if (!this.translations.has(translation.locale)) {
        this.translations.set(translation.locale, new Map());
      }
      this.translations
        .get(translation.locale)!
        .set(translation.key, translation);
    }

    console.log(`✅ 翻訳初期化完了: ${defaultTranslations.length}個`);
  }

  /**
   * メッセージをフォーマット
   */
  private formatMessage(message: string, params?: Record<string, any>): string {
    if (!params) return message;

    let formattedMessage = message;
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{${key}}`;
      formattedMessage = formattedMessage.replace(
        new RegExp(placeholder, 'g'),
        String(value)
      );
    }

    return formattedMessage;
  }

  /**
   * 日付フォーマットを解析
   */
  private parseDateFormat(format: string): Intl.DateTimeFormatOptions {
    const options: Intl.DateTimeFormatOptions = {};

    if (format.includes('YYYY')) {
      options.year = 'numeric';
    } else if (format.includes('YY')) {
      options.year = '2-digit';
    }

    if (format.includes('MM')) {
      options.month = '2-digit';
    } else if (format.includes('M')) {
      options.month = 'numeric';
    }

    if (format.includes('DD')) {
      options.day = '2-digit';
    } else if (format.includes('D')) {
      options.day = 'numeric';
    }

    return options;
  }

  /**
   * 設定を取得
   */
  getConfig(): LocalizationConfig {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<LocalizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ ローカライゼーション設定更新');
  }

  /**
   * 統計を取得
   */
  getStats(): any {
    return {
      initialized: this.isInitialized,
      supportedLocales: this.config.supportedLocales.length,
      supportedCurrencies: this.config.currency.supported.length,
      supportedTimezones: this.config.timezone.supported.length,
      translationCount: Array.from(this.translations.values()).reduce(
        (sum, map) => sum + map.size,
        0
      ),
    };
  }

  /**
   * ローカライゼーションサービスを停止
   */
  stop(): void {
    this.isInitialized = false;
    console.log('⏹️ ローカライゼーションサービス停止');
  }
}
