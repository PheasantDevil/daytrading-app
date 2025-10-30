import { Logger } from '../src/utils/logger';
import { BrokerIntegrationService } from '../src/brokers/broker-integration-service';
import { ibConfig } from '../src/config/interactive-brokers-config';

const logger = new Logger('IBSetup');

async function setupInteractiveBrokers(): Promise<void> {
  logger.info('🚀 Interactive Brokersの設定を開始します...');

  try {
    // 設定の検証
    logger.info('設定の検証中...');

    if (!ibConfig.host) {
      throw new Error('IB_HOSTが設定されていません');
    }
    if (!ibConfig.port) {
      throw new Error('IB_PORTが設定されていません');
    }
    if (!ibConfig.accountId) {
      logger.warn(
        '⚠️ IB_ACCOUNT_IDが設定されていません（接続後に自動取得される場合があります）'
      );
    }

    logger.info('✅ 設定の検証が完了しました');
    logger.info(`接続先: ${ibConfig.host}:${ibConfig.port}`);
    logger.info(
      `モード: ${ibConfig.paperTrading ? 'ペーパートレーディング' : '本番取引'}`
    );

    // 証券会社統合サービスの初期化
    const brokerService = new BrokerIntegrationService();

    // Interactive Brokersの登録
    logger.info('Interactive Brokersを登録中...');
    await brokerService.addBroker('interactive_brokers', ibConfig);
    logger.info('✅ Interactive Brokersが登録されました');

    // プライマリ証券会社の設定
    brokerService.setPrimaryBroker('interactive_brokers');
    logger.info('✅ プライマリ証券会社をInteractive Brokersに設定しました');

    // 接続テスト
    logger.info('接続テストを実行中...');
    const health = await brokerService.healthCheck();
    logger.info('ヘルスチェック結果:', health);

    if (health.healthy) {
      logger.info('✅ Interactive Brokersとの接続が正常です');

      // アカウント情報の取得テスト
      const ibBroker = brokerService.getBroker('interactive_brokers');
      if (ibBroker) {
        try {
          const account = await ibBroker.getAccount();
          logger.info('Interactive Brokersアカウント情報:', {
            accountId: account.accountId,
            balance: account.balance,
            currency: account.currency,
            marginAvailable: account.marginAvailable,
            marginUsed: account.marginUsed,
          });

          // ポジション情報の取得テスト
          const positions = await ibBroker.getPositions();
          logger.info(`Interactive Brokersポジション数: ${positions.length}`);

          // 注文履歴の取得テスト
          const orders = await ibBroker.getOrders();
          logger.info(`Interactive Brokers注文数: ${orders.length}`);

          // 市場データの取得テスト（米国株）
          const marketDataUS = await ibBroker.getMarketData('AAPL');
          logger.info('Interactive Brokers市場データ（AAPL）:', {
            symbol: marketDataUS.symbol,
            price: marketDataUS.price,
            bid: marketDataUS.bid,
            ask: marketDataUS.ask,
            volume: marketDataUS.volume,
          });

          // 複数銘柄の市場データ取得テスト
          const multipleMarketData = await ibBroker.getMarketDataMultiple([
            'AAPL', // Apple
            'GOOGL', // Google
            'MSFT', // Microsoft
            'TSLA', // Tesla
          ]);
          logger.info(
            `Interactive Brokers複数市場データ数: ${multipleMarketData.length}`
          );

          logger.info('✅ 全てのテストが成功しました');
        } catch (error) {
          logger.error('API呼び出しテストでエラーが発生しました:', error);
        }
      }
    } else {
      logger.error('❌ Interactive Brokersとの接続に失敗しました');
      logger.error('以下を確認してください:');
      logger.error('1. TWS/IB Gatewayが起動しているか');
      logger.error(
        '2. API接続が有効になっているか（設定 > API > Enable ActiveX and Socket Clients）'
      );
      logger.error('3. ポート番号が正しいか（7497=paper, 7496=live）');
      logger.error('4. ファイアウォールがブロックしていないか');
    }

    logger.info('🎉 Interactive Brokersの設定が完了しました');
    logger.info('📋 次のステップ:');
    logger.info('1. TWS/IB Gatewayを起動');
    logger.info('2. API接続を有効化');
    logger.info('3. ペーパートレーディングでテスト');
    logger.info('4. 本番環境に移行');
  } catch (error) {
    logger.error('Interactive Brokersの設定に失敗しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
const args = process.argv.slice(2);
setupInteractiveBrokers().catch(console.error);

export { setupInteractiveBrokers };
