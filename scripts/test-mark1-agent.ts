import { prisma } from './src/core/database';
import { agentService } from './src/services/agent-service';
import { investmentService } from './src/services/investment-service';

async function testMark1Agent() {
  console.log('🤖 Mark1エージェントのテストを開始します...\n');

  try {
    // 1. サンプル投資商品を作成
    console.log('📊 サンプル投資商品を作成中...');
    await investmentService.createSampleProducts();
    console.log('✅ サンプル投資商品を作成しました\n');

    // 2. Mark1エージェントを作成
    console.log('🤖 Mark1エージェントを作成中...');
    const agentConfig = await agentService.createMark1Agent({
      name: 'Mark1-AI-Trader',
      minConfidence: 60,
      maxPositionSize: 100000,
      stopLossPercent: 5,
      takeProfitPercent: 10,
      maxDailyTrades: 10,
      riskTolerance: 'MEDIUM',
    });
    console.log(
      `✅ エージェントを作成しました: ${agentConfig.name} (ID: ${agentConfig.id})\n`
    );

    // 3. エージェントを実行
    console.log('🚀 エージェントを実行中...');
    const result = await agentService.runAgent(agentConfig.id);
    console.log(`✅ エージェント実行完了:`);
    console.log(`   - 分析商品数: ${result.analyzedProducts}個`);
    console.log(`   - 実行取引数: ${result.executedTrades}回\n`);

    // 4. 投資商品一覧を表示
    console.log('📈 投資商品一覧:');
    const products = await investmentService.getProducts();
    products.forEach((product) => {
      console.log(
        `  - ${product.symbol}: ${product.name} (¥${product.currentPrice.toLocaleString()})`
      );
    });
    console.log('');

    // 5. ポジション状況を表示
    console.log('💼 現在のポジション:');
    const positions = await investmentService.getPositions();
    if (positions.length > 0) {
      positions.forEach((position) => {
        console.log(
          `  - ${position.product.symbol}: ${position.quantity}株 @ ¥${position.averagePrice.toLocaleString()}`
        );
        console.log(`    現在価格: ¥${position.currentPrice.toLocaleString()}`);
        console.log(
          `    未実現損益: ¥${position.unrealizedPnl.toLocaleString()} (${position.unrealizedPnlPercent.toFixed(2)}%)`
        );
      });
    } else {
      console.log('  ポジションはありません');
    }
    console.log('');

    // 6. 取引履歴を表示
    console.log('📋 取引履歴:');
    const transactions = await investmentService.getTransactions(10);
    if (transactions.length > 0) {
      transactions.forEach((transaction) => {
        console.log(
          `  - ${transaction.type}: ${transaction.product.symbol} ${transaction.quantity}株 @ ¥${transaction.price.toLocaleString()}`
        );
        console.log(`    理由: ${transaction.reason}`);
        console.log(`    手数料: ¥${transaction.fee.toLocaleString()}`);
        console.log(
          `    時刻: ${new Date(transaction.createdAt).toLocaleString('ja-JP')}`
        );
      });
    } else {
      console.log('  取引履歴はありません');
    }
    console.log('');

    // 7. 総資産を表示
    console.log('💰 総資産状況:');
    const totalAssets = await investmentService.getTotalAssets();
    console.log(`  総評価額: ¥${totalAssets.totalValue.toLocaleString()}`);
    console.log(`  総投資額: ¥${totalAssets.totalCost.toLocaleString()}`);
    console.log(
      `  損益: ¥${totalAssets.totalPnl.toLocaleString()} (${totalAssets.totalPnlPercent.toFixed(2)}%)`
    );
    console.log('');

    // 8. エージェントの判断レポートを生成
    console.log('📊 エージェントの判断レポートを生成中...');
    const reportPath = await agentService.saveDecisionReport(agentConfig.id);
    console.log(`✅ 判断レポートを保存しました: ${reportPath}\n`);

    // 9. エージェントのパフォーマンスを分析
    console.log('📈 エージェントパフォーマンス分析:');
    const performance = await agentService.analyzeAgentPerformance(
      agentConfig.id
    );
    console.log(`  総判断数: ${performance.totalDecisions}回`);
    console.log(`  買い判断: ${performance.buyDecisions}回`);
    console.log(`  売り判断: ${performance.sellDecisions}回`);
    console.log(`  ホールド判断: ${performance.holdDecisions}回`);
    console.log(`  平均信頼度: ${performance.averageConfidence.toFixed(1)}%`);
    console.log(`  成功率: ${performance.successRate.toFixed(1)}%`);
    console.log('');

    console.log('🎉 Mark1エージェントのテストが完了しました！');
  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// テストを実行
testMark1Agent();
