import { BrokerIntegrationService } from '../src/brokers/broker-integration-service';
import { sbiConfig } from '../src/config/sbi-config';
import { Logger } from '../src/utils/logger';

const logger = new Logger('SbiSetup');

async function setupSbiBroker(): Promise<void> {
  logger.info('🚀 SBI証券の設定を開始します...');

  try {
    // 設定の検証
    logger.info('設定の検証中...');
    if (!sbiConfig.apiKey) {
      throw new Error('SBI_API_KEYが設定されていません');
    }
    if (!sbiConfig.secret) {
      throw new Error('SBI_API_SECRETが設定されていません');
    }
    if (!sbiConfig.accessToken) {
      throw new Error('SBI_ACCESS_TOKENが設定されていません');
    }
    if (!sbiConfig.accountNumber) {
      throw new Error('SBI_ACCOUNT_NUMBERが設定されていません');
    }
    logger.info('✅ 設定の検証が完了しました');

    // 証券会社統合サービスの初期化
    const brokerService = new BrokerIntegrationService();

    // SBI証券の登録
    logger.info('SBI証券を登録中...');
    await brokerService.addBroker('sbi', sbiConfig);
    logger.info('✅ SBI証券が登録されました');

    // プライマリ証券会社の設定
    brokerService.setPrimaryBroker('sbi');
    logger.info('✅ プライマリ証券会社をSBI証券に設定しました');

    // 接続テスト
    logger.info('接続テストを実行中...');
    const health = await brokerService.healthCheck();
    logger.info('ヘルスチェック結果:', health);

    if (health.healthy) {
      logger.info('✅ SBI証券との接続が正常です');

      // アカウント情報の取得テスト
      const sbiBroker = brokerService.getBroker('sbi');
      if (sbiBroker) {
        try {
          const account = await sbiBroker.getAccount();
          logger.info('SBI証券アカウント情報:', {
            accountId: account.accountId,
            balance: account.balance,
            currency: account.currency,
            marginAvailable: account.marginAvailable,
            marginUsed: account.marginUsed,
          });

          // ポジション情報の取得テスト
          const positions = await sbiBroker.getPositions();
          logger.info(`SBI証券ポジション数: ${positions.length}`);

          // 注文履歴の取得テスト
          const orders = await sbiBroker.getOrders();
          logger.info(`SBI証券注文数: ${orders.length}`);

          // 市場データの取得テスト
          const marketData = await sbiBroker.getMarketData('7203'); // トヨタ自動車
          logger.info('SBI証券市場データ:', {
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
      logger.error('❌ SBI証券との接続に失敗しました');
      logger.error('設定を確認してください:', {
        apiKey: sbiConfig.apiKey ? '設定済み' : '未設定',
        secret: sbiConfig.secret ? '設定済み' : '未設定',
        accessToken: sbiConfig.accessToken ? '設定済み' : '未設定',
        accountNumber: sbiConfig.accountNumber ? '設定済み' : '未設定',
      });
    }

    logger.info('🎉 SBI証券の設定が完了しました');
  } catch (error) {
    logger.error('SBI証券の設定に失敗しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  setupSbiBroker().catch(console.error);
}

export { setupSbiBroker };
