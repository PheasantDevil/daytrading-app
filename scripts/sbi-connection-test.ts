import { Logger } from '../src/utils/logger';
import { BrokerIntegrationService } from '../src/brokers/broker-integration-service';
import { sbiConfig } from '../src/config/sbi-config';

const logger = new Logger('SbiConnectionTest');

async function testSbiConnection(): Promise<boolean> {
  logger.info('🔍 SBI証券接続テストを開始します...');

  try {
    // 設定の検証
    logger.info('設定の検証中...');
    const requiredFields = [
      'apiKey',
      'secret',
      'accessToken',
      'accountNumber',
      'branchCode',
    ];

    for (const field of requiredFields) {
      if (!sbiConfig[field as keyof typeof sbiConfig]) {
        logger.error(`❌ ${field}が設定されていません`);
        return false;
      }
    }
    logger.info('✅ 設定の検証が完了しました');

    // 証券会社統合サービスの初期化
    const brokerService = new BrokerIntegrationService();

    // SBI証券の登録
    logger.info('SBI証券を登録中...');
    await brokerService.addBroker('sbi', sbiConfig);
    logger.info('✅ SBI証券が登録されました');

    // 接続テスト
    logger.info('接続テストを実行中...');
    const health = await brokerService.healthCheck();
    logger.info('ヘルスチェック結果:', health);

    if (!health.healthy) {
      logger.error('❌ SBI証券との接続に失敗しました');
      return false;
    }

    // アカウント情報の取得テスト
    logger.info('アカウント情報の取得テスト...');
    const sbiBroker = brokerService.getBroker('sbi');
    if (!sbiBroker) {
      logger.error('❌ SBI証券ブローカーが見つかりません');
      return false;
    }

    try {
      const account = await sbiBroker.getAccount();
      logger.info('✅ アカウント情報の取得が成功しました:', {
        accountId: account.accountId,
        balance: account.balance,
        currency: account.currency,
      });
    } catch (error) {
      logger.error('❌ アカウント情報の取得に失敗しました:', error);
      return false;
    }

    // ポジション情報の取得テスト
    logger.info('ポジション情報の取得テスト...');
    try {
      const positions = await sbiBroker.getPositions();
      logger.info(`✅ ポジション情報の取得が成功しました: ${positions.length}件`);
    } catch (error) {
      logger.error('❌ ポジション情報の取得に失敗しました:', error);
      return false;
    }

    // 注文履歴の取得テスト
    logger.info('注文履歴の取得テスト...');
    try {
      const orders = await sbiBroker.getOrders();
      logger.info(`✅ 注文履歴の取得が成功しました: ${orders.length}件`);
    } catch (error) {
      logger.error('❌ 注文履歴の取得に失敗しました:', error);
      return false;
    }

    // 市場データの取得テスト
    logger.info('市場データの取得テスト...');
    try {
      const marketData = await sbiBroker.getMarketData('7203'); // トヨタ自動車
      logger.info('✅ 市場データの取得が成功しました:', {
        symbol: marketData.symbol,
        price: marketData.price,
        bid: marketData.bid,
        ask: marketData.ask,
      });
    } catch (error) {
      logger.error('❌ 市場データの取得に失敗しました:', error);
      return false;
    }

    // 複数市場データの取得テスト
    logger.info('複数市場データの取得テスト...');
    try {
      const multipleMarketData = await sbiBroker.getMarketDataMultiple([
        '7203', // トヨタ自動車
        '6758', // ソニー
        '9984', // ソフトバンクグループ
      ]);
      logger.info(
        `✅ 複数市場データの取得が成功しました: ${multipleMarketData.length}件`
      );
    } catch (error) {
      logger.error('❌ 複数市場データの取得に失敗しました:', error);
      return false;
    }

    logger.info('🎉 SBI証券接続テストが全て成功しました');
    return true;
  } catch (error) {
    logger.error('SBI証券接続テストに失敗しました:', error);
    return false;
  }
}

// スクリプト実行
if (require.main === module) {
  testSbiConnection()
    .then((success) => {
      if (success) {
        logger.info('✅ 全てのテストが成功しました');
        process.exit(0);
      } else {
        logger.error('❌ テストが失敗しました');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('テスト実行中にエラーが発生しました:', error);
      process.exit(1);
    });
}

export { testSbiConnection };
