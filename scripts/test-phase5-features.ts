/**
 * Phase5機能テストスクリプト
 * AI/ML統合、リアルタイム処理、国際化、モバイル対応をテスト
 */

import { AdvancedMLService } from '../src/ai/advanced-ml-service';
import { LocalizationService } from '../src/i18n/localization-service';
import { PWAManager } from '../src/mobile/pwa-manager';
import { WebSocketManager } from '../src/realtime/websocket-manager';

async function testAdvancedMLService(): Promise<void> {
  console.log('\n🧪 高度なMLサービステスト開始...');

  try {
    const advancedMLService = new AdvancedMLService({
      ensemble: {
        enabled: true,
        models: ['LSTM', 'RandomForest', 'SVM'],
        weights: { LSTM: 0.4, RandomForest: 0.3, SVM: 0.3 },
        votingMethod: 'WEIGHTED_AVERAGE',
      },
      reinforcement: {
        enabled: true,
        algorithm: 'DQN',
        learningRate: 0.001,
        epsilon: 0.1,
        gamma: 0.95,
        memorySize: 10000,
      },
      nlp: {
        enabled: true,
        model: 'BERT',
        sentimentThreshold: 0.5,
        keywordExtraction: true,
        entityRecognition: true,
      },
      computerVision: {
        enabled: true,
        model: 'RESNET',
        patternRecognition: true,
        confidenceThreshold: 0.7,
      },
      timeSeries: {
        enabled: true,
        methods: ['ARIMA', 'LSTM', 'PROPHET'],
        forecastHorizon: 5,
        seasonalityDetection: true,
      },
    });

    // 初期化テスト
    const initialized = await advancedMLService.initialize();
    console.log(`✅ 高度なMLサービス初期化: ${initialized ? '成功' : '失敗'}`);

    if (initialized) {
      // アンサンブル予測テスト
      const marketData = Array.from({ length: 100 }, (_, i) => ({
        symbol: 'AAPL',
        timestamp: new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000),
        open: 150 + Math.random() * 10,
        high: 155 + Math.random() * 10,
        low: 145 + Math.random() * 10,
        close: 150 + Math.random() * 10,
        volume: Math.random() * 1000000,
        indicators: {
          rsi: 50 + Math.random() * 20,
          macd: Math.random() * 2 - 1,
          bb_upper: 160 + Math.random() * 5,
          bb_lower: 140 + Math.random() * 5,
          sma_20: 150 + Math.random() * 5,
        },
      }));

      const ensemblePrediction = await advancedMLService.predictWithEnsemble(
        'AAPL',
        marketData
      );
      console.log(
        `✅ アンサンブル予測: 予測値=${ensemblePrediction.ensemblePrediction.toFixed(4)}, 信頼度=${ensemblePrediction.ensembleConfidence.toFixed(4)}`
      );

      // 強化学習最適化テスト
      const rlResult = await advancedMLService.optimizeStrategyWithRL({
        name: 'momentum',
      });
      console.log(
        `✅ 強化学習最適化: 総報酬=${rlResult.totalReward.toFixed(4)}, 学習率=${rlResult.learningRate}`
      );

      // ニュース感情分析テスト
      const newsData = [
        {
          id: 'news1',
          title: 'Apple reports strong quarterly earnings',
          content:
            'Apple Inc. reported better than expected quarterly earnings...',
          source: 'Reuters',
          publishedAt: new Date(),
        },
        {
          id: 'news2',
          title: 'Market volatility increases',
          content: 'Stock market shows increased volatility due to...',
          source: 'Bloomberg',
          publishedAt: new Date(),
        },
      ];

      const sentimentAnalysis =
        await advancedMLService.analyzeNewsSentiment(newsData);
      console.log(`✅ ニュース感情分析: ${sentimentAnalysis.length}記事`);

      sentimentAnalysis.forEach((analysis, index) => {
        console.log(
          `  - 記事${index + 1}: ${analysis.sentiment} (スコア=${analysis.score.toFixed(4)}, 信頼度=${analysis.confidence.toFixed(4)})`
        );
      });

      // チャートパターン認識テスト
      const chartImage = {
        symbol: 'AAPL',
        timeframe: '1D',
        imageData: Buffer.from('fake-image-data'),
        timestamp: new Date(),
      };

      const chartPattern =
        await advancedMLService.recognizeChartPattern(chartImage);
      console.log(
        `✅ チャートパターン認識: パターン=${chartPattern.pattern}, 方向=${chartPattern.direction}, 信頼度=${chartPattern.confidence.toFixed(4)}`
      );

      // 時系列分析テスト
      const timeSeriesAnalysis = await advancedMLService.analyzeTimeSeries(
        'AAPL',
        marketData
      );
      console.log(
        `✅ 時系列分析: トレンド=${timeSeriesAnalysis.trend}, ボラティリティ=${timeSeriesAnalysis.volatility.toFixed(4)}, 季節性=${timeSeriesAnalysis.seasonality}`
      );

      // 統計取得テスト
      const stats = advancedMLService.getStats();
      console.log(
        `✅ ML統計: 初期化=${stats.initialized}, アンサンブルモデル数=${stats.ensembleModels}`
      );
    }

    console.log('✅ 高度なMLサービステスト完了');
  } catch (error) {
    console.error('❌ 高度なMLサービステストエラー:', error);
  }
}

async function testWebSocketManager(): Promise<void> {
  console.log('\n🧪 WebSocket管理テスト開始...');

  try {
    const streamProcessor = {
      async processPriceData(data: any): Promise<void> {
        console.log(`📊 価格データ処理: ${data.symbol}`);
      },
      async processVolumeData(data: any): Promise<void> {
        console.log(`📊 出来高データ処理: ${data.symbol}`);
      },
      async processOrderBookData(data: any): Promise<void> {
        console.log(`📊 板データ処理: ${data.symbol}`);
      },
      async processTradeData(data: any): Promise<void> {
        console.log(`📊 取引データ処理: ${data.symbol}`);
      },
      async processNewsData(data: any): Promise<void> {
        console.log(`📊 ニュースデータ処理: ${data.symbol}`);
      },
    };

    const webSocketManager = new WebSocketManager(
      {
        port: 8080,
        heartbeatInterval: 30000,
        maxConnections: 1000,
        maxSubscriptionsPerConnection: 50,
        compressionEnabled: true,
        authentication: {
          enabled: true,
          secretKey: 'test-secret-key',
          tokenExpiry: 3600000,
        },
        rateLimiting: {
          enabled: true,
          maxMessagesPerSecond: 10,
          burstLimit: 20,
        },
      },
      streamProcessor
    );

    // WebSocketサーバー開始テスト
    const started = await webSocketManager.start();
    console.log(`✅ WebSocketサーバー開始: ${started ? '成功' : '失敗'}`);

    if (started) {
      // 市場データストリーム接続テスト
      await webSocketManager.connectToMarketData('AAPL');
      console.log('✅ 市場データストリーム接続: AAPL');

      // イベントブロードキャストテスト
      const marketEvent = {
        id: 'event1',
        type: 'PRICE_UPDATE' as const,
        symbol: 'AAPL',
        data: { price: 150.25, change: 0.5 },
        timestamp: new Date(),
        priority: 'HIGH' as const,
      };

      await webSocketManager.broadcastEvent(marketEvent);
      console.log('✅ イベントブロードキャスト: PRICE_UPDATE');

      // ストリームデータ処理テスト
      const streamData = {
        symbol: 'AAPL',
        dataType: 'PRICE' as const,
        data: { price: 150.3, volume: 1000000 },
        timestamp: new Date(),
        source: 'test-source',
      };

      await webSocketManager.processStream(streamData);
      console.log('✅ ストリームデータ処理: PRICE');

      // 接続統計取得テスト
      const connectionStats = webSocketManager.getConnectionStats();
      console.log(
        `✅ 接続統計: 総接続数=${connectionStats.totalConnections}, 認証済み=${connectionStats.authenticatedConnections}, 総購読数=${connectionStats.totalSubscriptions}`
      );
    }

    // WebSocketサーバー停止
    await webSocketManager.stop();
    console.log('✅ WebSocketサーバー停止');

    console.log('✅ WebSocket管理テスト完了');
  } catch (error) {
    console.error('❌ WebSocket管理テストエラー:', error);
  }
}

async function testLocalizationService(): Promise<void> {
  console.log('\n🧪 ローカライゼーションサービステスト開始...');

  try {
    const localizationService = new LocalizationService({
      defaultLocale: 'ja-JP',
      supportedLocales: ['ja-JP', 'en-US', 'zh-CN'],
      fallbackLocale: 'en-US',
      currency: {
        default: 'JPY',
        supported: ['USD', 'JPY', 'EUR', 'CNY'],
        autoDetect: true,
      },
      timezone: {
        default: 'Asia/Tokyo',
        autoDetect: true,
        supported: [
          'Asia/Tokyo',
          'America/New_York',
          'Asia/Shanghai',
          'Europe/London',
        ],
      },
      dateTime: {
        formats: {
          'ja-JP': 'YYYY/MM/DD',
          'en-US': 'MM/DD/YYYY',
          'zh-CN': 'YYYY-MM-DD',
        },
        relativeTime: true,
      },
      number: {
        formats: {
          'ja-JP': { style: 'decimal' },
          'en-US': { style: 'decimal' },
          'zh-CN': { style: 'decimal' },
        },
        precision: 2,
      },
    });

    // 初期化テスト
    const initialized = await localizationService.initialize();
    console.log(
      `✅ ローカライゼーションサービス初期化: ${initialized ? '成功' : '失敗'}`
    );

    if (initialized) {
      // 翻訳テスト
      const translations = [
        { key: 'common.save', locale: 'ja-JP' },
        { key: 'common.save', locale: 'en-US' },
        { key: 'common.save', locale: 'zh-CN' },
        { key: 'trading.buy', locale: 'ja-JP' },
        { key: 'trading.buy', locale: 'en-US' },
        { key: 'trading.buy', locale: 'zh-CN' },
      ];

      console.log('✅ 翻訳テスト:');
      translations.forEach(({ key, locale }) => {
        const translation = localizationService.translate(key, locale);
        console.log(`  - ${locale}: ${key} = ${translation}`);
      });

      // 通貨フォーマットテスト
      const currencies = [
        { amount: 1234.56, currency: 'USD', locale: 'en-US' },
        { amount: 1234.56, currency: 'JPY', locale: 'ja-JP' },
        { amount: 1234.56, currency: 'EUR', locale: 'en-US' },
        { amount: 1234.56, currency: 'CNY', locale: 'zh-CN' },
      ];

      console.log('✅ 通貨フォーマットテスト:');
      currencies.forEach(({ amount, currency, locale }) => {
        const formatted = localizationService.formatCurrency(
          amount,
          currency,
          locale
        );
        console.log(`  - ${locale} ${currency}: ${amount} = ${formatted}`);
      });

      // 数値フォーマットテスト
      const numbers = [
        { value: 1234567.89, locale: 'ja-JP' },
        { value: 1234567.89, locale: 'en-US' },
        { value: 1234567.89, locale: 'zh-CN' },
      ];

      console.log('✅ 数値フォーマットテスト:');
      numbers.forEach(({ value, locale }) => {
        const formatted = localizationService.formatNumber(value, locale);
        console.log(`  - ${locale}: ${value} = ${formatted}`);
      });

      // 日付フォーマットテスト
      const testDate = new Date('2024-01-15T10:30:00Z');
      const dateFormats = [
        { locale: 'ja-JP', format: 'YYYY/MM/DD' },
        { locale: 'en-US', format: 'MM/DD/YYYY' },
        { locale: 'zh-CN', format: 'YYYY-MM-DD' },
      ];

      console.log('✅ 日付フォーマットテスト:');
      dateFormats.forEach(({ locale, format }) => {
        const formatted = localizationService.formatDate(
          testDate,
          locale,
          format
        );
        console.log(`  - ${locale}: ${testDate.toISOString()} = ${formatted}`);
      });

      // タイムゾーン変換テスト
      const timezoneConversions = [
        { from: 'Asia/Tokyo', to: 'America/New_York' },
        { from: 'America/New_York', to: 'Asia/Shanghai' },
        { from: 'Asia/Shanghai', to: 'Europe/London' },
      ];

      console.log('✅ タイムゾーン変換テスト:');
      timezoneConversions.forEach(({ from, to }) => {
        const converted = localizationService.convertTimezone(
          testDate,
          from,
          to
        );
        console.log(
          `  - ${from} -> ${to}: ${testDate.toISOString()} = ${converted.toISOString()}`
        );
      });

      // 相対時間テスト
      const relativeTimes = [
        { date: new Date(Date.now() - 30 * 1000), locale: 'ja-JP' }, // 30秒前
        { date: new Date(Date.now() - 5 * 60 * 1000), locale: 'en-US' }, // 5分前
        { date: new Date(Date.now() - 2 * 60 * 60 * 1000), locale: 'zh-CN' }, // 2時間前
      ];

      console.log('✅ 相対時間テスト:');
      relativeTimes.forEach(({ date, locale }) => {
        const relative = localizationService.getRelativeTime(date, locale);
        console.log(`  - ${locale}: ${date.toISOString()} = ${relative}`);
      });

      // ロケール検出テスト
      const detectedLocale = localizationService.detectLocale(
        'ja-JP,ja;q=0.9,en-US;q=0.8'
      );
      console.log(
        `✅ ロケール検出: ja-JP,ja;q=0.9,en-US;q=0.8 = ${detectedLocale}`
      );

      // 通貨検出テスト
      const detectedCurrency = localizationService.detectCurrency('ja-JP');
      console.log(`✅ 通貨検出: ja-JP = ${detectedCurrency}`);

      // タイムゾーン検出テスト
      const detectedTimezone = localizationService.detectTimezone();
      console.log(`✅ タイムゾーン検出: ${detectedTimezone}`);

      // 統計取得テスト
      const stats = localizationService.getStats();
      console.log(
        `✅ ローカライゼーション統計: 初期化=${stats.initialized}, サポートロケール=${stats.supportedLocales}, 翻訳数=${stats.translationCount}`
      );
    }

    console.log('✅ ローカライゼーションサービステスト完了');
  } catch (error) {
    console.error('❌ ローカライゼーションサービステストエラー:', error);
  }
}

async function testPWAManager(): Promise<void> {
  console.log('\n🧪 PWA管理テスト開始...');

  try {
    const pwaManager = new PWAManager({
      serviceWorker: {
        enabled: true,
        scope: '/',
        updateInterval: 300000,
        cacheStrategy: 'CACHE_FIRST',
        maxCacheSize: 100,
        maxCacheAge: 86400000,
      },
      cache: {
        enabled: true,
        strategies: {
          static: 'CACHE_FIRST',
          api: 'NETWORK_FIRST',
          images: 'STALE_WHILE_REVALIDATE',
        },
        patterns: {
          static: ['/static/**', '/assets/**'],
          api: ['/api/**'],
          images: ['/images/**'],
        },
      },
      offlineStorage: {
        enabled: true,
        maxSize: 50,
        syncInterval: 300000,
        conflictResolution: 'LAST_WRITE_WINS',
      },
      pushNotification: {
        enabled: true,
        vapidPublicKey: 'test-public-key',
        vapidPrivateKey: 'test-private-key',
        supportedFeatures: ['badge', 'icon', 'sound', 'vibrate'],
        defaultOptions: {
          badge: '/badge.png',
          icon: '/icon-192x192.png',
          sound: '/notification.mp3',
          vibrate: [200, 100, 200],
          tag: 'trading-notification',
          requireInteraction: true,
        },
      },
      manifest: {
        name: 'Day Trading App',
        short_name: 'TradingApp',
        description: 'Advanced day trading application',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1a1a1a',
        background_color: '#ffffff',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
        categories: ['finance', 'business'],
        lang: 'ja',
        dir: 'ltr',
        scope: '/',
        prefer_related_applications: false,
        related_applications: [],
      },
    });

    // 初期化テスト
    const initialized = await pwaManager.initialize();
    console.log(`✅ PWA管理初期化: ${initialized ? '成功' : '失敗'}`);

    if (initialized) {
      // リソースキャッシュテスト
      const resources = [
        '/static/app.js',
        '/static/app.css',
        '/images/logo.png',
      ];
      await pwaManager.cacheResources(resources);
      console.log(`✅ リソースキャッシュ: ${resources.length}個`);

      // オフラインデータ保存テスト
      await pwaManager.saveOfflineData('TRADE', {
        symbol: 'AAPL',
        action: 'BUY',
        quantity: 100,
        price: 150.25,
      });
      console.log('✅ オフラインデータ保存: TRADE');

      await pwaManager.saveOfflineData('ORDER', {
        symbol: 'MSFT',
        action: 'SELL',
        quantity: 50,
        price: 300.0,
      });
      console.log('✅ オフラインデータ保存: ORDER');

      // オフラインデータ取得テスト
      const offlineData = await pwaManager.getOfflineData();
      console.log(`✅ オフラインデータ取得: ${offlineData.length}件`);

      const tradeData = await pwaManager.getOfflineData('TRADE');
      console.log(`✅ 取引データ取得: ${tradeData.length}件`);

      // オフラインデータ同期テスト
      await pwaManager.syncOfflineData();
      console.log('✅ オフラインデータ同期');

      // プッシュ通知購読テスト（モック）
      try {
        const subscription =
          await pwaManager.subscribeToPushNotifications('user123');
        console.log(`✅ プッシュ通知購読: ${subscription.userId}`);

        // プッシュ通知送信テスト
        await pwaManager.sendPushNotification(subscription, {
          title: '取引アラート',
          body: 'AAPLの価格が目標価格に達しました',
          data: { symbol: 'AAPL', price: 150.25 },
        });
        console.log('✅ プッシュ通知送信');
      } catch (error) {
        console.log('⚠️ プッシュ通知テストスキップ（ブラウザ環境外）');
      }

      // キャッシュクリアテスト
      await pwaManager.clearCache();
      console.log('✅ キャッシュクリア');

      // オフラインストレージクリアテスト
      await pwaManager.clearOfflineStorage();
      console.log('✅ オフラインストレージクリア');

      // 統計取得テスト
      const stats = pwaManager.getStats();
      console.log(
        `✅ PWA統計: 初期化=${stats.initialized}, サービスワーカー=${stats.serviceWorkerEnabled}, キャッシュ=${stats.cacheEnabled}, オフラインストレージ=${stats.offlineStorageEnabled}`
      );
    }

    console.log('✅ PWA管理テスト完了');
  } catch (error) {
    console.error('❌ PWA管理テストエラー:', error);
  }
}

async function testIntegrationWorkflow(): Promise<void> {
  console.log('\n🧪 統合ワークフローテスト開始...');

  try {
    // 高度なMLサービス
    const advancedMLService = new AdvancedMLService({
      ensemble: {
        enabled: true,
        models: ['LSTM'],
        weights: { LSTM: 1.0 },
        votingMethod: 'WEIGHTED_AVERAGE',
      },
      reinforcement: {
        enabled: true,
        algorithm: 'DQN',
        learningRate: 0.001,
        epsilon: 0.1,
        gamma: 0.95,
        memorySize: 1000,
      },
      nlp: {
        enabled: true,
        model: 'BERT',
        sentimentThreshold: 0.5,
        keywordExtraction: true,
        entityRecognition: true,
      },
      computerVision: {
        enabled: true,
        model: 'RESNET',
        patternRecognition: true,
        confidenceThreshold: 0.7,
      },
      timeSeries: {
        enabled: true,
        methods: ['LSTM'],
        forecastHorizon: 5,
        seasonalityDetection: true,
      },
    });

    // ローカライゼーションサービス
    const localizationService = new LocalizationService({
      defaultLocale: 'ja-JP',
      supportedLocales: ['ja-JP', 'en-US'],
      fallbackLocale: 'en-US',
      currency: { default: 'JPY', supported: ['USD', 'JPY'], autoDetect: true },
      timezone: {
        default: 'Asia/Tokyo',
        autoDetect: true,
        supported: ['Asia/Tokyo', 'America/New_York'],
      },
      dateTime: {
        formats: { 'ja-JP': 'YYYY/MM/DD', 'en-US': 'MM/DD/YYYY' },
        relativeTime: true,
      },
      number: {
        formats: {
          'ja-JP': { style: 'decimal' },
          'en-US': { style: 'decimal' },
        },
        precision: 2,
      },
    });

    // PWA管理サービス
    const pwaManager = new PWAManager({
      serviceWorker: {
        enabled: true,
        scope: '/',
        updateInterval: 300000,
        cacheStrategy: 'CACHE_FIRST',
        maxCacheSize: 100,
        maxCacheAge: 86400000,
      },
      cache: {
        enabled: true,
        strategies: {
          static: 'CACHE_FIRST',
          api: 'NETWORK_FIRST',
          images: 'STALE_WHILE_REVALIDATE',
        },
        patterns: {
          static: ['/static/**'],
          api: ['/api/**'],
          images: ['/images/**'],
        },
      },
      offlineStorage: {
        enabled: true,
        maxSize: 50,
        syncInterval: 300000,
        conflictResolution: 'LAST_WRITE_WINS',
      },
      pushNotification: {
        enabled: true,
        vapidPublicKey: 'test-key',
        vapidPrivateKey: 'test-key',
        supportedFeatures: ['badge'],
        defaultOptions: { badge: '/badge.png' },
      },
      manifest: {
        name: 'Trading App',
        short_name: 'Trading',
        description: 'Trading app',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#000',
        background_color: '#fff',
        icons: [],
        categories: ['finance'],
        lang: 'ja',
        dir: 'ltr',
        scope: '/',
        prefer_related_applications: false,
        related_applications: [],
      },
    });

    // 統合ワークフロー実行
    console.log('🔄 統合ワークフロー実行中...');

    // 1. サービス初期化
    const mlInitialized = await advancedMLService.initialize();
    const localizationInitialized = await localizationService.initialize();
    const pwaInitialized = await pwaManager.initialize();

    console.log(
      `✅ サービス初期化: ML=${mlInitialized}, Localization=${localizationInitialized}, PWA=${pwaInitialized}`
    );

    // 2. 多言語対応テスト
    if (localizationInitialized) {
      const japaneseText = localizationService.translate(
        'trading.buy',
        'ja-JP'
      );
      const englishText = localizationService.translate('trading.buy', 'en-US');
      console.log(`✅ 多言語対応: 日本語=${japaneseText}, 英語=${englishText}`);

      const formattedCurrency = localizationService.formatCurrency(
        1234.56,
        'JPY',
        'ja-JP'
      );
      console.log(`✅ 通貨フォーマット: ${formattedCurrency}`);
    }

    // 3. ML予測テスト
    if (mlInitialized) {
      const marketData = Array.from({ length: 50 }, (_, i) => ({
        symbol: 'AAPL',
        timestamp: new Date(Date.now() - (50 - i) * 24 * 60 * 60 * 1000),
        open: 150 + Math.random() * 10,
        high: 155 + Math.random() * 10,
        low: 145 + Math.random() * 10,
        close: 150 + Math.random() * 10,
        volume: Math.random() * 1000000,
        indicators: {
          rsi: 50,
          macd: 0,
          bb_upper: 160,
          bb_lower: 140,
          sma_20: 150,
        },
      }));

      const prediction = await advancedMLService.predictWithEnsemble(
        'AAPL',
        marketData
      );
      console.log(
        `✅ ML予測: 予測値=${prediction.ensemblePrediction.toFixed(4)}, 信頼度=${prediction.ensembleConfidence.toFixed(4)}`
      );
    }

    // 4. PWA機能テスト
    if (pwaInitialized) {
      await pwaManager.saveOfflineData('TRADE', {
        symbol: 'AAPL',
        action: 'BUY',
        quantity: 100,
      });
      const offlineData = await pwaManager.getOfflineData();
      console.log(`✅ PWA機能: オフラインデータ=${offlineData.length}件`);
    }

    // 5. 統計取得
    const mlStats = advancedMLService.getStats();
    const localizationStats = localizationService.getStats();
    const pwaStats = pwaManager.getStats();

    console.log(`✅ 統合統計:`);
    console.log(
      `  - ML: 初期化=${mlStats.initialized}, アンサンブルモデル=${mlStats.ensembleModels}`
    );
    console.log(
      `  - ローカライゼーション: 初期化=${localizationStats.initialized}, サポートロケール=${localizationStats.supportedLocales}`
    );
    console.log(
      `  - PWA: 初期化=${pwaStats.initialized}, サービスワーカー=${pwaStats.serviceWorkerEnabled}`
    );

    // 6. サービス停止
    advancedMLService.stop();
    localizationService.stop();
    pwaManager.stop();
    console.log('✅ 全サービス停止');

    console.log('✅ 統合ワークフローテスト完了');
  } catch (error) {
    console.error('❌ 統合ワークフローテストエラー:', error);
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Phase5機能テスト開始...');

  try {
    await testAdvancedMLService();
    await testWebSocketManager();
    await testLocalizationService();
    await testPWAManager();
    await testIntegrationWorkflow();

    console.log('\n✅ Phase5機能テスト完了');
  } catch (error) {
    console.error('❌ Phase5機能テストエラー:', error);
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}
