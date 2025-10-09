import { Logger } from '../src/utils/logger';
import { PaperTradingSystem } from '../src/trading/paper-trading-system';

const logger = new Logger('PaperTradingTest');

async function testPaperTradingSystem(): Promise<void> {
  logger.info('🚀 ペーパートレーディングシステムのテストを開始します...');

  try {
    // ペーパートレーディングシステムの初期化
    const paperTrading = new PaperTradingSystem({
      initialBalance: 100000, // $100,000
      currency: 'USD',
      leverage: 4, // 4倍レバレッジ
      commissionRate: 0.005, // 1株あたり$0.005
      minCommission: 1, // 最低$1
      enableRealTimeSimulation: true,
    });

    logger.info('ペーパートレーディングシステムを初期化中...');
    await paperTrading.initialize();
    logger.info('✅ 初期化完了');

    // ペーパートレーディングの開始
    logger.info('ペーパートレーディングを開始...');
    await paperTrading.start();
    logger.info('✅ ペーパートレーディング開始');

    // イベントハンドラーの設定
    paperTrading.on('orderStatus', (data) => {
      logger.info('📋 注文ステータス更新:', data);
    });

    paperTrading.on('execution', (data) => {
      logger.info('✅ 約定:', data);
    });

    // 初期口座情報の確認
    logger.info('📊 初期口座情報:');
    const initialAccount = await paperTrading.getAccountInfo();
    logger.info(`残高: $${initialAccount.balance.toLocaleString()}`);
    logger.info(`純資産: $${initialAccount.netLiquidation.toLocaleString()}`);
    logger.info(`購買力: $${initialAccount.buyingPower.toLocaleString()}`);

    // テスト取引1: Apple株を購入
    logger.info('\n📈 テスト取引1: AAPL（Apple）100株を成行買い');
    const order1 = await paperTrading.placeOrder('AAPL', 'BUY', 100, 'MKT');
    logger.info(`✅ 注文ID: ${order1}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 市場データの確認
    const aaplData = await paperTrading.getMarketData('AAPL');
    logger.info('AAPL市場データ:', {
      価格: `$${aaplData.price.toFixed(2)}`,
      買気配: `$${aaplData.bid.toFixed(2)}`,
      売気配: `$${aaplData.ask.toFixed(2)}`,
    });

    // テスト取引2: Google株を購入
    logger.info('\n📈 テスト取引2: GOOGL（Google）50株を成行買い');
    const order2 = await paperTrading.placeOrder('GOOGL', 'BUY', 50, 'MKT');
    logger.info(`✅ 注文ID: ${order2}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // テスト取引3: Microsoft株を指値買い
    logger.info('\n📈 テスト取引3: MSFT（Microsoft）75株を$380で指値買い');
    const order3 = await paperTrading.placeOrder('MSFT', 'BUY', 75, 'LMT', 380);
    logger.info(`✅ 注文ID: ${order3}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // ポジション確認
    logger.info('\n📊 現在のポジション:');
    const positions = await paperTrading.getPositions();
    for (const pos of positions) {
      logger.info(`${pos.symbol}: ${pos.quantity}株 @ $${pos.averageCost.toFixed(2)}`);
      logger.info(`  現在価格: $${pos.currentPrice.toFixed(2)}`);
      logger.info(`  未実現損益: $${pos.unrealizedPnL.toFixed(2)}`);
      logger.info(`  評価額: $${pos.marketValue.toFixed(2)}`);
    }

    // 市場シミュレーション（5秒間）
    logger.info('\n⏱️  市場シミュレーション中（5秒間）...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 更新されたポジション確認
    logger.info('\n📊 更新されたポジション:');
    const updatedPositions = await paperTrading.getPositions();
    for (const pos of updatedPositions) {
      logger.info(`${pos.symbol}: ${pos.quantity}株`);
      logger.info(`  未実現損益: $${pos.unrealizedPnL.toFixed(2)}`);
    }

    // テスト取引4: Apple株の一部を売却
    logger.info('\n📉 テスト取引4: AAPL 50株を成行売り');
    const order4 = await paperTrading.placeOrder('AAPL', 'SELL', 50, 'MKT');
    logger.info(`✅ 注文ID: ${order4}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 最終口座情報の確認
    logger.info('\n📊 最終口座情報:');
    const finalAccount = await paperTrading.getAccountInfo();
    logger.info(`残高: $${finalAccount.balance.toLocaleString()}`);
    logger.info(`純資産: $${finalAccount.netLiquidation.toLocaleString()}`);
    logger.info(`総損益: $${finalAccount.totalPnL.toFixed(2)} (${((finalAccount.totalPnL / initialAccount.balance) * 100).toFixed(2)}%)`);
    logger.info(`未実現損益: $${finalAccount.unrealizedPnL.toFixed(2)}`);
    logger.info(`実現損益: $${finalAccount.realizedPnL.toFixed(2)}`);

    // 取引統計の確認
    logger.info('\n📈 取引統計:');
    const stats = paperTrading.getTradingStats();
    logger.info(`総取引数: ${stats.totalTrades}`);
    logger.info(`勝ち: ${stats.winningTrades}, 負け: ${stats.losingTrades}`);
    logger.info(`勝率: ${(stats.winRate * 100).toFixed(2)}%`);
    logger.info(`平均利益: $${stats.averageWin.toFixed(2)}`);
    logger.info(`平均損失: $${stats.averageLoss.toFixed(2)}`);
    logger.info(`最大ドローダウン: ${(stats.maxDrawdown * 100).toFixed(2)}%`);
    logger.info(`シャープレシオ: ${stats.sharpeRatio.toFixed(4)}`);

    // 取引履歴の確認
    logger.info('\n📜 取引履歴:');
    const history = paperTrading.getTradeHistory();
    history.forEach((trade, index) => {
      logger.info(
        `${index + 1}. ${trade.timestamp.toLocaleString()} - ${trade.symbol} ${trade.action} ${trade.quantity}株 @ $${trade.price.toFixed(2)} (PnL: $${trade.pnl.toFixed(2)})`
      );
    });

    // ペーパートレーディングの停止
    logger.info('\nペーパートレーディングを停止中...');
    await paperTrading.stop();

    logger.info('\n🎉 ペーパートレーディングシステムのテストが完了しました');
    logger.info('✅ 全ての機能が正常に動作しています');
  } catch (error) {
    logger.error('❌ ペーパートレーディングシステムのテストに失敗しました:', error);
    process.exit(1);
  }
}

// テスト実行
testPaperTradingSystem().catch(console.error);

export { testPaperTradingSystem };

