import { BrokerIntegrationService } from '../src/brokers/broker-integration-service';
import {
  AutoTradingConfig,
  AutoTradingService,
} from '../src/trading/auto-trading-service';
import {
  TradingSchedule,
  TradingScheduler,
  TradingSchedulerConfig,
} from '../src/trading/trading-scheduler';
import { Logger } from '../src/utils/logger';

const logger = new Logger('AutoTradingTest');

// テスト用の設定
const autoTradingConfig: AutoTradingConfig = {
  enabled: true,
  tradingHours: {
    start: '09:00',
    end: '15:00',
    timezone: 'Asia/Tokyo',
  },
  strategies: {
    momentum: {
      enabled: true,
      weight: 0.5,
      riskLevel: 'medium',
      maxPositions: 5,
      stopLoss: 0.02,
      takeProfit: 0.04,
    },
    meanReversion: {
      enabled: true,
      weight: 0.3,
      riskLevel: 'low',
      maxPositions: 3,
      stopLoss: 0.015,
      takeProfit: 0.03,
    },
    breakout: {
      enabled: true,
      weight: 0.2,
      riskLevel: 'high',
      maxPositions: 2,
      stopLoss: 0.025,
      takeProfit: 0.05,
    },
  },
  riskManagement: {
    maxDailyLoss: 1000,
    maxPositionSize: 10000,
    maxPortfolioRisk: 0.1,
    emergencyStop: true,
  },
  monitoring: {
    checkInterval: 5000,
    alertThresholds: {
      loss: 500,
      drawdown: 0.05,
      volatility: 0.1,
    },
  },
  broker: {
    name: 'oanda',
    apiKey: 'test-api-key',
    accountId: 'test-account-id',
    sandbox: true,
  },
};

const tradingSchedulerConfig: TradingSchedulerConfig = {
  enabled: true,
  schedules: [
    {
      id: 'morning_session',
      name: '朝の取引セッション',
      description: '市場開始時の取引セッション',
      cronExpression: '0 9 * * 1-5', // 平日9:00
      enabled: true,
      config: autoTradingConfig,
      status: 'active',
    },
    {
      id: 'afternoon_session',
      name: '午後の取引セッション',
      description: '午後の取引セッション',
      cronExpression: '0 13 * * 1-5', // 平日13:00
      enabled: true,
      config: autoTradingConfig,
      status: 'active',
    },
  ],
  timezone: 'Asia/Tokyo',
  maxConcurrentSessions: 2,
  sessionTimeout: 3600000, // 1時間
  retryAttempts: 3,
  retryDelay: 5000,
};

async function testAutoTradingService(): Promise<boolean> {
  try {
    logger.info('=== 自動売買サービスのテスト開始 ===');

    const autoTradingService = new AutoTradingService(autoTradingConfig);

    // 初期化テスト
    logger.info('自動売買サービスの初期化テスト...');
    await autoTradingService.initialize();
    logger.info('✅ 自動売買サービスの初期化が成功しました');

    // 設定テスト
    logger.info('設定テスト...');
    const testConfig = { ...autoTradingConfig, enabled: false };
    autoTradingService.updateConfig(testConfig);
    logger.info('✅ 設定更新が成功しました');

    // ヘルスチェックテスト
    logger.info('ヘルスチェックテスト...');
    const health = await autoTradingService.healthCheck();
    logger.info('ヘルスチェック結果:', health);
    logger.info('✅ ヘルスチェックが成功しました');

    // 取引統計テスト
    logger.info('取引統計テスト...');
    const stats = autoTradingService.getTradingStats();
    logger.info('取引統計:', stats);
    logger.info('✅ 取引統計取得が成功しました');

    logger.info('=== 自動売買サービスのテスト完了 ===');
    return true;
  } catch (error) {
    logger.error('自動売買サービスのテストに失敗しました:', error);
    return false;
  }
}

async function testTradingScheduler(): Promise<boolean> {
  try {
    logger.info('=== 取引スケジューラーのテスト開始 ===');

    const autoTradingService = new AutoTradingService(autoTradingConfig);
    const tradingScheduler = new TradingScheduler(
      tradingSchedulerConfig,
      autoTradingService
    );

    // 初期化テスト
    logger.info('取引スケジューラーの初期化テスト...');
    await tradingScheduler.initialize();
    logger.info('✅ 取引スケジューラーの初期化が成功しました');

    // スケジュール追加テスト
    logger.info('スケジュール追加テスト...');
    const newSchedule: TradingSchedule = {
      id: 'test_schedule',
      name: 'テストスケジュール',
      description: 'テスト用のスケジュール',
      cronExpression: '0 */5 * * * *', // 5分ごと
      enabled: true,
      config: autoTradingConfig,
      status: 'active',
    };
    await tradingScheduler.addSchedule(newSchedule);
    logger.info('✅ スケジュール追加が成功しました');

    // スケジュール一覧取得テスト
    logger.info('スケジュール一覧取得テスト...');
    const schedules = tradingScheduler.getSchedules();
    logger.info('スケジュール数:', schedules.length);
    logger.info('✅ スケジュール一覧取得が成功しました');

    // スケジュール更新テスト
    logger.info('スケジュール更新テスト...');
    await tradingScheduler.updateSchedule('test_schedule', { enabled: false });
    logger.info('✅ スケジュール更新が成功しました');

    // スケジュール削除テスト
    logger.info('スケジュール削除テスト...');
    await tradingScheduler.removeSchedule('test_schedule');
    logger.info('✅ スケジュール削除が成功しました');

    // 統計取得テスト
    logger.info('統計取得テスト...');
    const stats = tradingScheduler.getStats();
    logger.info('統計:', stats);
    logger.info('✅ 統計取得が成功しました');

    // ヘルスチェックテスト
    logger.info('ヘルスチェックテスト...');
    const health = await tradingScheduler.healthCheck();
    logger.info('ヘルスチェック結果:', health);
    logger.info('✅ ヘルスチェックが成功しました');

    logger.info('=== 取引スケジューラーのテスト完了 ===');
    return true;
  } catch (error) {
    logger.error('取引スケジューラーのテストに失敗しました:', error);
    return false;
  }
}

async function testBrokerIntegrationService(): Promise<boolean> {
  try {
    logger.info('=== 証券会社統合サービスのテスト開始 ===');

    const brokerService = new BrokerIntegrationService();

    // OANDA Japan追加テスト
    logger.info('OANDA Japan追加テスト...');
    await brokerService.addBroker('oanda', {
      name: 'oanda',
      apiKey: 'test-api-key',
      accountId: 'test-account-id',
      sandbox: true,
      baseUrl: 'https://api-fxpractice.oanda.com',
      timeout: 30000,
      retryAttempts: 3,
    });
    logger.info('✅ OANDA Japan追加が成功しました');

    // SBI証券追加テスト
    logger.info('SBI証券追加テスト...');
    await brokerService.addBroker('sbi', {
      name: 'sbi',
      apiKey: 'test-api-key',
      secret: 'test-secret',
      accountId: 'test-account-id',
      sandbox: true,
      baseUrl: 'https://api.sbisec.co.jp',
      timeout: 30000,
      retryAttempts: 3,
    });
    logger.info('✅ SBI証券追加が成功しました');

    // 楽天証券追加テスト
    logger.info('楽天証券追加テスト...');
    await brokerService.addBroker('rakuten', {
      name: 'rakuten',
      apiKey: 'test-api-key',
      secret: 'test-secret',
      accountId: 'test-account-id',
      sandbox: true,
      baseUrl: 'https://api.rakuten-sec.co.jp',
      timeout: 30000,
      retryAttempts: 3,
    });
    logger.info('✅ 楽天証券追加が成功しました');

    // マネックス証券追加テスト
    logger.info('マネックス証券追加テスト...');
    await brokerService.addBroker('monex', {
      name: 'monex',
      apiKey: 'test-api-key',
      secret: 'test-secret',
      accountId: 'test-account-id',
      sandbox: true,
      baseUrl: 'https://api.monex.co.jp',
      timeout: 30000,
      retryAttempts: 3,
    });
    logger.info('✅ マネックス証券追加が成功しました');

    // プライマリ証券会社設定テスト
    logger.info('プライマリ証券会社設定テスト...');
    brokerService.setPrimaryBroker('oanda');
    const primaryBroker = brokerService.getPrimaryBroker();
    logger.info('プライマリ証券会社:', primaryBroker?.constructor.name);
    logger.info('✅ プライマリ証券会社設定が成功しました');

    // 証券会社取得テスト
    logger.info('証券会社取得テスト...');
    const oandaBroker = brokerService.getBroker('oanda');
    const sbiBroker = brokerService.getBroker('sbi');
    logger.info('OANDA証券会社:', oandaBroker?.constructor.name);
    logger.info('SBI証券会社:', sbiBroker?.constructor.name);
    logger.info('✅ 証券会社取得が成功しました');

    // 全証券会社取得テスト
    logger.info('全証券会社取得テスト...');
    const allBrokers = brokerService.getAllBrokers();
    logger.info('証券会社数:', allBrokers.size);
    logger.info('✅ 全証券会社取得が成功しました');

    // ヘルスチェックテスト
    logger.info('ヘルスチェックテスト...');
    const health = await brokerService.healthCheck();
    logger.info('ヘルスチェック結果:', health);
    logger.info('✅ ヘルスチェックが成功しました');

    // 証券会社削除テスト
    logger.info('証券会社削除テスト...');
    await brokerService.removeBroker('monex');
    logger.info('✅ 証券会社削除が成功しました');

    logger.info('=== 証券会社統合サービスのテスト完了 ===');
    return true;
  } catch (error) {
    logger.error('証券会社統合サービスのテストに失敗しました:', error);
    return false;
  }
}

async function testBrokerSpecificFeatures(): Promise<boolean> {
  try {
    logger.info('=== 証券会社固有機能のテスト開始 ===');

    const brokerService = new BrokerIntegrationService();

    // OANDA Japan機能テスト
    logger.info('OANDA Japan機能テスト...');
    await brokerService.addBroker('oanda', {
      name: 'oanda',
      apiKey: 'test-api-key',
      accountId: 'test-account-id',
      sandbox: true,
      baseUrl: 'https://api-fxpractice.oanda.com',
      timeout: 30000,
      retryAttempts: 3,
    });

    const oandaBroker = brokerService.getBroker('oanda');
    if (oandaBroker) {
      // アカウント情報取得テスト
      const account = await oandaBroker.getAccount();
      logger.info('OANDAアカウント情報:', account);

      // ポジション取得テスト
      const positions = await oandaBroker.getPositions();
      logger.info('OANDAポジション数:', positions.length);

      // 注文取得テスト
      const orders = await oandaBroker.getOrders();
      logger.info('OANDA注文数:', orders.length);

      // 市場データ取得テスト
      const marketData = await oandaBroker.getMarketData('USD_JPY');
      logger.info('OANDA市場データ:', marketData);

      // 複数市場データ取得テスト
      const multipleMarketData = await oandaBroker.getMarketDataMultiple([
        'USD_JPY',
        'EUR_JPY',
      ]);
      logger.info('OANDA複数市場データ数:', multipleMarketData.length);
    }
    logger.info('✅ OANDA Japan機能テストが成功しました');

    // SBI証券機能テスト
    logger.info('SBI証券機能テスト...');
    await brokerService.addBroker('sbi', {
      name: 'sbi',
      apiKey: 'test-api-key',
      secret: 'test-secret',
      accountId: 'test-account-id',
      sandbox: true,
      baseUrl: 'https://api.sbisec.co.jp',
      timeout: 30000,
      retryAttempts: 3,
    });

    const sbiBroker = brokerService.getBroker('sbi');
    if (sbiBroker) {
      // アカウント情報取得テスト
      const account = await sbiBroker.getAccount();
      logger.info('SBIアカウント情報:', account);

      // 市場データ取得テスト
      const marketData = await sbiBroker.getMarketData('7203'); // トヨタ自動車
      logger.info('SBI市場データ:', marketData);
    }
    logger.info('✅ SBI証券機能テストが成功しました');

    logger.info('=== 証券会社固有機能のテスト完了 ===');
    return true;
  } catch (error) {
    logger.error('証券会社固有機能のテストに失敗しました:', error);
    return false;
  }
}

async function testAutoTradingIntegration(): Promise<boolean> {
  try {
    logger.info('=== 自動売買統合テスト開始 ===');

    // 証券会社統合サービスの初期化
    const brokerService = new BrokerIntegrationService();
    await brokerService.addBroker('oanda', {
      name: 'oanda',
      apiKey: 'test-api-key',
      accountId: 'test-account-id',
      sandbox: true,
      baseUrl: 'https://api-fxpractice.oanda.com',
      timeout: 30000,
      retryAttempts: 3,
    });

    // 自動売買サービスの初期化
    const autoTradingService = new AutoTradingService(autoTradingConfig);
    await autoTradingService.initialize();

    // 取引スケジューラーの初期化
    const tradingScheduler = new TradingScheduler(
      tradingSchedulerConfig,
      autoTradingService
    );
    await tradingScheduler.initialize();

    // イベントハンドラーの設定
    autoTradingService.on('tradingStarted', (session) => {
      logger.info('取引セッションが開始されました:', session.sessionId);
    });

    autoTradingService.on('tradingStopped', (session) => {
      logger.info('取引セッションが停止されました:', session.sessionId);
    });

    autoTradingService.on('tradeExecuted', (trade) => {
      logger.info('取引が執行されました:', trade);
    });

    autoTradingService.on('riskAlert', (alert) => {
      logger.warn('リスクアラート:', alert);
    });

    tradingScheduler.on('taskScheduled', (schedule) => {
      logger.info('タスクがスケジュールされました:', schedule.name);
    });

    tradingScheduler.on('taskCompleted', (schedule) => {
      logger.info('タスクが完了しました:', schedule.name);
    });

    // 統合テストの実行
    logger.info('統合テストの実行...');

    // スケジューラーの開始
    await tradingScheduler.start();
    logger.info('✅ スケジューラーの開始が成功しました');

    // スケジュール統計の確認
    const stats = tradingScheduler.getStats();
    logger.info('スケジューラー統計:', stats);

    // アクティブセッションの確認
    const activeSessions = tradingScheduler.getActiveSessions();
    logger.info('アクティブセッション数:', activeSessions.length);

    // ヘルスチェック
    const schedulerHealth = await tradingScheduler.healthCheck();
    logger.info('スケジューラーヘルスチェック:', schedulerHealth);

    const tradingHealth = await autoTradingService.healthCheck();
    logger.info('自動売買ヘルスチェック:', tradingHealth);

    const brokerHealth = await brokerService.healthCheck();
    logger.info('証券会社ヘルスチェック:', brokerHealth);

    // スケジューラーの停止
    await tradingScheduler.stop();
    logger.info('✅ スケジューラーの停止が成功しました');

    logger.info('=== 自動売買統合テスト完了 ===');
    return true;
  } catch (error) {
    logger.error('自動売買統合テストに失敗しました:', error);
    return false;
  }
}

async function runAutoTradingTests(): Promise<void> {
  logger.info('🚀 自動売買機能テストを開始します...');

  const results = {
    autoTradingService: false,
    tradingScheduler: false,
    brokerIntegrationService: false,
    brokerSpecificFeatures: false,
    autoTradingIntegration: false,
  };

  try {
    // 各サービスのテスト
    results.autoTradingService = await testAutoTradingService();
    results.tradingScheduler = await testTradingScheduler();
    results.brokerIntegrationService = await testBrokerIntegrationService();
    results.brokerSpecificFeatures = await testBrokerSpecificFeatures();
    results.autoTradingIntegration = await testAutoTradingIntegration();

    // テスト結果の表示
    logger.info('📊 自動売買テスト結果:');
    logger.info(
      `自動売買サービス: ${results.autoTradingService ? '✅ 成功' : '❌ 失敗'}`
    );
    logger.info(
      `取引スケジューラー: ${results.tradingScheduler ? '✅ 成功' : '❌ 失敗'}`
    );
    logger.info(
      `証券会社統合サービス: ${results.brokerIntegrationService ? '✅ 成功' : '❌ 失敗'}`
    );
    logger.info(
      `証券会社固有機能: ${results.brokerSpecificFeatures ? '✅ 成功' : '❌ 失敗'}`
    );
    logger.info(
      `自動売買統合テスト: ${results.autoTradingIntegration ? '✅ 成功' : '❌ 失敗'}`
    );

    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    logger.info(`\n🎯 テスト結果: ${successCount}/${totalCount} 成功`);

    if (successCount === totalCount) {
      logger.info('🎉 自動売買機能の全テストが成功しました！');
      logger.info('📋 次のステップ:');
      logger.info('1. 証券会社の口座開設');
      logger.info('2. APIキーの取得');
      logger.info('3. サンドボックス環境でのテスト');
      logger.info('4. 本格運用の開始');
    } else {
      logger.warn('⚠️ 一部のテストが失敗しました');
    }
  } catch (error) {
    logger.error('自動売買テストの実行中にエラーが発生しました:', error);
  }
}

// テスト実行
if (require.main === module) {
  runAutoTradingTests().catch(console.error);
}

export { runAutoTradingTests };
