import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { Logger } from '../src/utils/logger';

const logger = new Logger('VerificationAnalyzer');

interface VerificationResult {
  date: string;
  config: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  averageProfit: number;
  averageLoss: number;
  maxProfit: number;
  maxLoss: number;
  stopLossTriggers: number;
  takeProfitTriggers: number;
  forceCloseTriggers: number;
  selectedSymbols: string[];
}

async function analyzeResults(): Promise<void> {
  logger.info('📊 4日間の検証結果を分析中...');

  const dates = ['2025-10-14', '2025-10-15', '2025-10-16', '2025-10-17'];
  const results: VerificationResult[] = [];

  for (const date of dates) {
    try {
      const dataPath = `./reports/verification-${date}/daily-${date}.json`;

      if (!existsSync(dataPath)) {
        logger.warn(`⚠️ ${date}: データファイルが見つかりません`);
        continue;
      }

      const data = JSON.parse(await readFile(dataPath, 'utf-8'));

      // データ分析処理
      const result = analyzeDayData(date, data);
      results.push(result);

      logger.info(`✅ ${date}: 分析完了`);
    } catch (error) {
      logger.warn(`⚠️ ${date}: データ読み込みエラー -`, error);
    }
  }

  if (results.length === 0) {
    logger.error('❌ 分析可能なデータが見つかりませんでした');
    process.exit(1);
  }

  // 統合レポート生成
  const report = generateComprehensiveReport(results);

  // レポート保存
  await writeFile(
    './reports/verification-comprehensive-report.md',
    report,
    'utf-8'
  );

  logger.info('\n📄 統合レポートを生成しました:');
  logger.info('./reports/verification-comprehensive-report.md');

  console.log('\n' + report);
}

function analyzeDayData(date: string, data: any): VerificationResult {
  const trades = data.trades || [];
  const sellTrades = trades.filter((t: any) => t.action === 'SELL');

  const wins = sellTrades.filter((t: any) => (t.profitRate || 0) > 0);
  const losses = sellTrades.filter((t: any) => (t.profitRate || 0) < 0);

  const profits = wins.map((t: any) => t.profitAmount || 0);
  const lossAmounts = losses.map((t: any) => t.profitAmount || 0);

  const totalProfit = sellTrades.reduce(
    (sum: number, t: any) => sum + (t.profitAmount || 0),
    0
  );

  const selectedSymbols = [
    ...new Set(trades.map((t: any) => t.symbol)),
  ] as string[];

  return {
    date,
    config: getConfigName(date),
    trades: sellTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: sellTrades.length > 0 ? (wins.length / sellTrades.length) * 100 : 0,
    totalProfit,
    averageProfit:
      profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0,
    averageLoss:
      lossAmounts.length > 0
        ? lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length
        : 0,
    maxProfit: profits.length > 0 ? Math.max(...profits) : 0,
    maxLoss: lossAmounts.length > 0 ? Math.min(...lossAmounts) : 0,
    stopLossTriggers: sellTrades.filter((t: any) =>
      (t.reason || '').includes('ストップロス')
    ).length,
    takeProfitTriggers: sellTrades.filter((t: any) =>
      (t.reason || '').includes('テイクプロフィット')
    ).length,
    forceCloseTriggers: sellTrades.filter((t: any) =>
      (t.reason || '').includes('強制決済')
    ).length,
    selectedSymbols,
  };
}

function getConfigName(date: string): string {
  const configs: { [key: string]: string } = {
    '2025-10-14': '保守的',
    '2025-10-15': '標準',
    '2025-10-16': '積極的',
    '2025-10-17': '標準（再検証）',
  };
  return configs[date] || '不明';
}

function generateComprehensiveReport(results: VerificationResult[]): string {
  let report = '# 4日間検証結果 統合レポート\n\n';
  report += `生成日時: ${new Date().toLocaleString('ja-JP')}\n\n`;
  report += '---\n\n';

  // === 日別サマリー ===
  report += '## 📊 日別サマリー\n\n';
  report += '| 日付 | 設定 | 取引数 | 勝率 | 総損益 | 決済理由 |\n';
  report += '|------|------|--------|------|--------|----------|\n';

  results.forEach((r) => {
    report += `| ${r.date} | ${r.config} | ${r.trades} | ${r.winRate.toFixed(1)}% | $${r.totalProfit.toFixed(2)} | SL:${r.stopLossTriggers} TP:${r.takeProfitTriggers} FC:${r.forceCloseTriggers} |\n`;
  });

  // === 総合統計 ===
  report += '\n## 📈 総合統計\n\n';

  const totalTrades = results.reduce((sum, r) => sum + r.trades, 0);
  const totalWins = results.reduce((sum, r) => sum + r.wins, 0);
  const totalLosses = results.reduce((sum, r) => sum + r.losses, 0);
  const totalProfit = results.reduce((sum, r) => sum + r.totalProfit, 0);
  const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  report += `- **総取引数**: ${totalTrades}回\n`;
  report += `- **総勝率**: ${overallWinRate.toFixed(1)}%\n`;
  report += `- **総損益**: $${totalProfit.toFixed(2)}\n`;
  report += `- **勝ち**: ${totalWins}回\n`;
  report += `- **負け**: ${totalLosses}回\n\n`;

  // === 最も効果的だった設定 ===
  report += '## 🎯 主要な発見\n\n';
  report += '### 最も効果的だった設定\n\n';

  const bestByProfit = [...results].sort(
    (a, b) => b.totalProfit - a.totalProfit
  )[0];
  const bestByWinRate = [...results].sort((a, b) => b.winRate - a.winRate)[0];

  report += `- **利益率トップ**: ${bestByProfit.date}（${bestByProfit.config}）- $${bestByProfit.totalProfit.toFixed(2)}\n`;
  report += `- **勝率トップ**: ${bestByWinRate.date}（${bestByWinRate.config}）- ${bestByWinRate.winRate.toFixed(1)}%\n\n`;

  // === リスク管理の適切性 ===
  report += '### リスク管理の適切性\n\n';

  const totalSL = results.reduce((sum, r) => sum + r.stopLossTriggers, 0);
  const totalTP = results.reduce((sum, r) => sum + r.takeProfitTriggers, 0);
  const totalFC = results.reduce((sum, r) => sum + r.forceCloseTriggers, 0);

  report += `- **ストップロス発動**: ${totalSL}回 (${((totalSL / totalTrades) * 100).toFixed(1)}%)\n`;
  report += `- **テイクプロフィット発動**: ${totalTP}回 (${((totalTP / totalTrades) * 100).toFixed(1)}%)\n`;
  report += `- **強制決済発動**: ${totalFC}回 (${((totalFC / totalTrades) * 100).toFixed(1)}%)\n\n`;

  // === 推奨パラメータ ===
  report += '### 推奨パラメータ\n\n';

  if (totalProfit > 0 && overallWinRate >= 50) {
    report += '✅ **検証結果は良好です**\n\n';
    report += '以下のパラメータを推奨します：\n\n';
    report += `- **設定**: ${bestByProfit.config}\n`;
    report += `- **ストップロス**: -3%\n`;
    report += `- **テイクプロフィット**: +5%\n`;
    report += `- **最大ポジション**: $10,000\n`;
    report += `- **1日最大取引数**: 1回\n`;
  } else if (overallWinRate < 50) {
    report += '⚠️ **勝率が50%未満です**\n\n';
    report += '改善が必要な項目：\n\n';
    report += '- シグナル判定基準の見直し\n';
    report += '- 銘柄選定条件の厳格化\n';
    report += '- リスク管理パラメータの調整\n';
  } else {
    report += '📊 **標準的な結果です**\n\n';
    report += 'さらなる検証を推奨します。\n';
  }

  // === 詳細分析 ===
  report += '\n## 📋 詳細分析\n\n';

  results.forEach((r) => {
    report += `### ${r.date} - ${r.config}\n\n`;
    report += `- 取引数: ${r.trades}回\n`;
    report += `- 勝率: ${r.winRate.toFixed(1)}%\n`;
    report += `- 総損益: $${r.totalProfit.toFixed(2)}\n`;
    report += `- 平均利益: $${r.averageProfit.toFixed(2)}\n`;
    report += `- 平均損失: $${r.averageLoss.toFixed(2)}\n`;
    report += `- 最高利益: $${r.maxProfit.toFixed(2)}\n`;
    report += `- 最大損失: $${r.maxLoss.toFixed(2)}\n`;
    report += `- 選定銘柄: ${r.selectedSymbols.join(', ')}\n\n`;
  });

  // === 次のステップ ===
  report += '## 🚀 次のステップ\n\n';
  report += '1. **本番運用前の最終確認**\n';
  report += '   - 推奨パラメータで追加テスト\n';
  report += '   - 異なる市場環境での検証\n\n';
  report += '2. **システムの改善**\n';
  report += '   - シグナル精度の向上\n';
  report += '   - リスク管理の最適化\n\n';
  report += '3. **段階的な本番移行**\n';
  report += '   - ペーパートレーディングで1ヶ月運用\n';
  report += '   - 少額での実取引開始\n';
  report += '   - 徐々にポジションサイズを拡大\n\n';

  report += '---\n\n';
  report += `**レポート生成**: ${new Date().toLocaleString('ja-JP')}  \n`;
  report += `**分析対象期間**: ${results[0]?.date} 〜 ${results[results.length - 1]?.date}\n`;

  return report;
}

// 実行
analyzeResults().catch(console.error);

