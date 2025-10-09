import { Logger } from '../src/utils/logger';
import { BrokerIntegrationService } from '../src/brokers/broker-integration-service';
import { ibConfig } from '../src/config/interactive-brokers-config';

const logger = new Logger('IBConnectionTest');

async function testInteractiveBrokersConnection(): Promise<boolean> {
  logger.info('🔍 Interactive Brokers接続テストを開始します...');

  try {
    // 設定の検証
    logger.info('設定の検証中...');
    const requiredFields = ['host', 'port', 'clientId'];

    for (const field of requiredFields) {
      if (!ibConfig[field as keyof typeof ibConfig]) {
        logger.error(`❌ ${field}が設定されていません`);
        return false;
      }
    }
    logger.info('✅ 設定の検証が完了しました');

    // 証券会社統合サービスの初期化
    const brokerService = new BrokerIntegrationService();

    // Interactive Brokersの登録
    logger.info('Interactive Brokersを登録中...');
    await brokerService.addBroker('interactive_brokers', ibConfig);
    logger.info('✅ Interactive Brokersが登録されました');

    // 接続テスト
    logger.info('接続テストを実行中...');
    const health = await brokerService.healthCheck();
    logger.info('ヘルスチェック結果:', health);

    if (!health.healthy) {
      logger.error('❌ Interactive Brokersとの接続に失敗しました');
      logger.error('確認事項:');
      logger.error('1. TWS/IB Gatewayが起動していますか？');
      logger.error('2. API接続が有効になっていますか？');
      logger.error('3. ポート番号は正しいですか？（7497=paper, 7496=live）');
      return false;
    }

    // アカウント情報の取得テスト
    logger.info('アカウント情報の取得テスト...');
    const ibBroker = brokerService.getBroker('interactive_brokers');
    if (!ibBroker) {
      logger.error('❌ Interactive Brokersブローカーが見つかりません');
      return false;
    }

    try {
      const account = await ibBroker.getAccount();
      logger.info('✅ アカウント情報の取得が成功しました:', {
        accountId: account.accountId,
        balance: account.balance,
        currency: account.currency,
        marginAvailable: account.marginAvailable,
      });
    } catch (error) {
      logger.error('❌ アカウント情報の取得に失敗しました:', error);
      return false;
    }

    // ポジション情報の取得テスト
    logger.info('ポジション情報の取得テスト...');
    try {
      const positions = await ibBroker.getPositions();
      logger.info(
        `✅ ポジション情報の取得が成功しました: ${positions.length}件`
      );
    } catch (error) {
      logger.error('❌ ポジション情報の取得に失敗しました:', error);
      return false;
    }

    // 注文履歴の取得テスト
    logger.info('注文履歴の取得テスト...');
    try {
      const orders = await ibBroker.getOrders();
      logger.info(`✅ 注文履歴の取得が成功しました: ${orders.length}件`);
    } catch (error) {
      logger.error('❌ 注文履歴の取得に失敗しました:', error);
      return false;
    }

    // 米国株市場データの取得テスト
    logger.info('米国株市場データの取得テスト...');
    try {
      const marketDataUS = await ibBroker.getMarketData('AAPL'); // Apple
      logger.info('✅ 米国株市場データの取得が成功しました:', {
        symbol: marketDataUS.symbol,
        price: marketDataUS.price,
        bid: marketDataUS.bid,
        ask: marketDataUS.ask,
      });
    } catch (error) {
      logger.error('❌ 米国株市場データの取得に失敗しました:', error);
      return false;
    }

    // 日本株市場データの取得テスト
    logger.info('日本株市場データの取得テスト...');
    try {
      const marketDataJP = await ibBroker.getMarketData('7203'); // トヨタ自動車
      logger.info('✅ 日本株市場データの取得が成功しました:', {
        symbol: marketDataJP.symbol,
        price: marketDataJP.price,
        bid: marketDataJP.bid,
        ask: marketDataJP.ask,
      });
    } catch (error) {
      logger.error('❌ 日本株市場データの取得に失敗しました:', error);
      return false;
    }

    // 複数市場データの取得テスト
    logger.info('複数市場データの取得テスト...');
    try {
      const multipleMarketData = await ibBroker.getMarketDataMultiple([
        'AAPL', // Apple (US)
        'GOOGL', // Google (US)
        'MSFT', // Microsoft (US)
        '7203', // Toyota (JP)
        '6758', // Sony (JP)
      ]);
      logger.info(
        `✅ 複数市場データの取得が成功しました: ${multipleMarketData.length}件`
      );
    } catch (error) {
      logger.error('❌ 複数市場データの取得に失敗しました:', error);
      return false;
    }

    logger.info('🎉 Interactive Brokers接続テストが全て成功しました');
    logger.info('📊 テスト結果:');
    logger.info('- アカウント情報: OK');
    logger.info('- ポジション情報: OK');
    logger.info('- 注文履歴: OK');
    logger.info('- 米国株市場データ: OK');
    logger.info('- 日本株市場データ: OK');
    logger.info('- 複数市場データ: OK');

    return true;
  } catch (error) {
    logger.error('Interactive Brokers接続テストに失敗しました:', error);
    return false;
  }
}

// スクリプト実行
const args = process.argv.slice(2);
testInteractiveBrokersConnection()
  .then((success) => {
    if (success) {
      logger.info('✅ 全てのテストが成功しました');
      logger.info('🎯 次のステップ:');
      logger.info('1. ペーパートレーディングで十分にテスト');
      logger.info('2. 取引戦略の検証');
      logger.info('3. リスク管理の確認');
      logger.info('4. 本番環境への移行');
      process.exit(0);
    } else {
      logger.error('❌ テストが失敗しました');
      logger.error('TWS/IB Gatewayの起動とAPI設定を確認してください');
      process.exit(1);
    }
  })
  .catch((error) => {
    logger.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  });

export { testInteractiveBrokersConnection };

