import { Logger } from '../src/utils/logger';
import { TradeDataCollector } from '../src/analytics/trade-data-collector';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const logger = new Logger('TradingMonitor');

/**
 * 取引監視ツール
 *
 * 使用方法:
 * npm run monitor:trading
 */
async function monitorTrading(): Promise<void> {
  logger.info('📊 ========== 取引監視ダッシュボード ==========\n');

  try {
    const dataCollector = new TradeDataCollector();
    await dataCollector.initialize();

    // === 全期間の統計 ===
    logger.info('📈 === 全期間の統計 ===');
    const allData = dataCollector.getAllData();

    if (allData.length === 0) {
      logger.info('❌ データがありません');
      logger.info('💡 npm run trade:daily を実行してデータを収集してください');
      return;
    }

    const allTrades = allData.flatMap((d) => d.trades);
    const sellTrades = allTrades.filter((t) => t.action === 'SELL');

    logger.info(`取引日数: ${allData.length}日`);
    logger.info(`総取引数: ${sellTrades.length}回`);

    if (sellTrades.length === 0) {
      logger.info('\n⚠️ まだ売却取引がありません');
      logger.info('💡 取引が完了するまでお待ちください');
      return;
    }

    const wins = sellTrades.filter((t) => (t.profitRate || 0) > 0).length;
    const losses = sellTrades.filter((t) => (t.profitRate || 0) < 0).length;
    const winRate = (wins / sellTrades.length) * 100;
    const totalProfit = sellTrades.reduce(
      (sum, t) => sum + (t.profitAmount || 0),
      0
    );

    logger.info(`勝ち: ${wins}回`);
    logger.info(`負け: ${losses}回`);
    logger.info(`勝率: ${winRate.toFixed(1)}%`);
    logger.info(`総損益: $${totalProfit.toFixed(2)}`);

    // === 週次統計 ===
    logger.info('\n📅 === 週次統計 ===');
    const weeklyStats = await dataCollector.generateWeeklyStats();

    logger.info(`期間: ${weeklyStats.week}`);
    logger.info(`取引日数: ${weeklyStats.tradingDays}日`);
    logger.info(`総取引数: ${weeklyStats.totalTrades}回`);
    logger.info(`勝率: ${weeklyStats.winRate.toFixed(1)}%`);
    logger.info(`総損益: $${weeklyStats.totalProfit.toFixed(2)}`);
    logger.info(`平均利益: $${weeklyStats.averageProfit.toFixed(2)}`);
    logger.info(`平均損失: $${weeklyStats.averageLoss.toFixed(2)}`);
    logger.info(`最大利益: $${weeklyStats.maxProfit.toFixed(2)}`);
    logger.info(`最大損失: $${weeklyStats.maxLoss.toFixed(2)}`);

    // === 銘柄分布 ===
    logger.info('\n🏢 === 銘柄分布 ===');
    Object.entries(weeklyStats.symbols)
      .sort(([, a], [, b]) => b - a)
      .forEach(([symbol, count]) => {
        logger.info(`${symbol}: ${count}回`);
      });

    // === 最近の取引 ===
    logger.info('\n📜 === 最近の5取引 ===');
    const recentTrades = sellTrades.slice(-5).reverse();
    recentTrades.forEach((trade, index) => {
      const profitSign = (trade.profitRate || 0) >= 0 ? '+' : '';
      logger.info(
        `${index + 1}. ${trade.date} ${trade.symbol} ${profitSign}${((trade.profitRate || 0) * 100).toFixed(2)}% ($${trade.profitAmount?.toFixed(2)}) - ${trade.reason}`
      );
    });

    // === パフォーマンス評価 ===
    logger.info('\n⭐ === パフォーマンス評価 ===');

    let evaluation = '';
    let recommendations: string[] = [];

    if (winRate >= 70) {
      evaluation = '🌟 優秀！';
      recommendations.push('✅ 現在の設定を維持');
      recommendations.push('✅ Phase5（パフォーマンス分析）に進む準備OK');
    } else if (winRate >= 50) {
      evaluation = '✅ 良好';
      recommendations.push('✅ このまま継続');
      recommendations.push('📊 もう少しデータを蓄積');
    } else if (winRate >= 40) {
      evaluation = '⚠️ 要改善';
      recommendations.push('⚠️ 設定の見直しを検討');
      recommendations.push('📊 Phase4（リスク管理）の実装を検討');
    } else {
      evaluation = '❌ 要見直し';
      recommendations.push('❌ 戦略の見直しが必要');
      recommendations.push('🔧 ストップロス/テイクプロフィットの調整');
      recommendations.push('🔧 スクリーニング条件の見直し');
    }

    logger.info(`評価: ${evaluation}`);
    logger.info(`勝率: ${winRate.toFixed(1)}%`);
    logger.info(`総損益: $${totalProfit.toFixed(2)}`);

    logger.info('\n💡 推奨アクション:');
    recommendations.forEach((rec) => logger.info(`  ${rec}`));

    // === 次のステップ ===
    logger.info('\n🚀 === 次のステップ ===');

    if (sellTrades.length < 10) {
      logger.info(`⏳ データ収集を継続（現在: ${sellTrades.length}/10取引）`);
      logger.info('💡 最低10取引のデータを蓄積してください');
    } else if (winRate >= 50) {
      logger.info('✅ 十分なデータが蓄積されました');
      logger.info('🎯 Phase5（パフォーマンス分析）の実装を推奨');
    } else {
      logger.info('✅ 十分なデータが蓄積されました');
      logger.info('🛡️ Phase4（リスク管理強化）の実装を推奨');
    }

    logger.info('\n📄 詳細レポート:');
    logger.info(`  - all-trades.json`);
    logger.info(`  - weekly-*.json`);
    logger.info(`  - trades-export-*.csv`);

    logger.info('\n🎉 監視ダッシュボードの表示が完了しました');
  } catch (error) {
    logger.error('❌ 監視ツール実行エラー:', error);
    process.exit(1);
  }
}

// 実行
monitorTrading().catch(console.error);

export { monitorTrading };
