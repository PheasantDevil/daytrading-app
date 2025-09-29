import { Logger } from '../src/utils/logger';
import { BrokerIntegrationService } from '../src/brokers/broker-integration-service';
import { rakutenConfig } from '../src/config/rakuten-config';

const logger = new Logger('RakutenSetup');

async function setupRakutenBroker(): Promise<void> {
  logger.info('🚀 楽天証券の設定を開始します...');

  try {
    // 設定の検証
    logger.info('設定の検証中...');
    if (!rakutenConfig.appId) {
      throw new Error('RAKUTEN_APP_IDが設定されていません');
    }
    if (!rakutenConfig.appSecret) {
      throw new Error('RAKUTEN_APP_SECRETが設定されていません');
    }
    if (!rakutenConfig.accessToken) {
      throw new Error('RAKUTEN_ACCESS_TOKENが設定されていません');
    }
    if (!rakutenConfig.accountNumber) {
      throw new Error('RAKUTEN_ACCOUNT_NUMBERが設定されていません');
    }
    logger.info('✅ 設定の検証が完了しました');

    // 証券会社統合サービスの初期化
    const brokerService = new BrokerIntegrationService();

    // 楽天証券の登録
    logger.info('楽天証券を登録中...');
    await brokerService.addBroker('rakuten', rakutenConfig);
    logger.info('✅ 楽天証券が登録されました');

    // プライマリ証券会社の設定
    brokerService.setPrimaryBroker('rakuten');
    logger.info('✅ プライマリ証券会社を楽天証券に設定しました');

    // 接続テスト
    logger.info('接続テストを実行中...');
    const health = await brokerService.healthCheck();
    logger.info('ヘルスチェック結果:', health);

    if (health.healthy) {
      logger.info('✅ 楽天証券との接続が正常です');

      // アカウント情報の取得テスト
      const rakutenBroker = brokerService.getBroker('rakuten');
      if (rakutenBroker) {
        try {
          const account = await rakutenBroker.getAccount();
          logger.info('楽天証券アカウント情報:', {
            accountId: account.accountId,
            balance: account.balance,
            currency: account.currency,
            marginAvailable: account.marginAvailable,
            marginUsed: account.marginUsed,
          });

          // ポジション情報の取得テスト
          const positions = await rakutenBroker.getPositions();
          logger.info(`楽天証券ポジション数: ${positions.length}`);

          // 注文履歴の取得テスト
          const orders = await rakutenBroker.getOrders();
          logger.info(`楽天証券注文数: ${orders.length}`);

          // 市場データの取得テスト
          const marketData = await rakutenBroker.getMarketData('7203'); // トヨタ自動車
          logger.info('楽天証券市場データ:', {
            symbol: marketData.symbol,
            price: marketData.price,
            bid: marketData.bid,
            ask: marketData.ask,
            volume: marketData.volume,
          });

          logger.info('✅ 全てのテストが成功しました');
        } catch (error) {
          logger.error('API呼び出しテストでエラーが発生しました:', error);
        }
      }
    } else {
      logger.error('❌ 楽天証券との接続に失敗しました');
      logger.error('設定を確認してください:', {
        appId: rakutenConfig.appId ? '設定済み' : '未設定',
        appSecret: rakutenConfig.appSecret ? '設定済み' : '未設定',
        accessToken: rakutenConfig.accessToken ? '設定済み' : '未設定',
        accountNumber: rakutenConfig.accountNumber ? '設定済み' : '未設定',
      });
    }

    logger.info('🎉 楽天証券の設定が完了しました');
  } catch (error) {
    logger.error('楽天証券の設定に失敗しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  setupRakutenBroker().catch(console.error);
}

export { setupRakutenBroker };
