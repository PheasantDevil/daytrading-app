import { readFileSync } from 'fs';
import { join } from 'path';

interface TradingResult {
  symbol: string;
  name: string;
  initialPrice: number;
  predictedPrice: number;
  actualPrice: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  pnl: number;
  pnlPercent: number;
  confidence: number;
  timestamp: string;
}

interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: string;
  filledAt?: string;
}

interface ReportData {
  summary: {
    initialBalance: number;
    currentBalance: number;
    totalAssets: number;
    totalReturn: number;
    totalReturnPercent: number;
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    avgConfidence: number;
    timestamp: string;
  };
  trades: TradingResult[];
  positions: Position[];
  orders: Order[];
}

function generateMarkdownReport(data: ReportData): string {
  const { summary, trades, positions, orders } = data;
  const timestamp = new Date(summary.timestamp).toLocaleString('ja-JP');

  return `# デモトレード実行レポート

## 📊 実行概要

- **実行日時**: ${timestamp}
- **テスト期間**: 1セッション
- **対象銘柄数**: 5銘柄
- **取引戦略**: 移動平均ベース予測による自動取引

## 💰 資金状況

| 項目 | 金額 | 備考 |
|------|------|------|
| 初期資金 | ¥${summary.initialBalance.toLocaleString()} | デモ環境の仮想資金 |
| 現在残高 | ¥${summary.currentBalance.toLocaleString()} | 現金残高 |
| 総資産 | ¥${summary.totalAssets.toLocaleString()} | 現金 + ポジション評価額 |
| **損益** | **¥${summary.totalReturn.toLocaleString()}** | **${summary.totalReturnPercent.toFixed(2)}%** |

## 📈 取引統計

| 指標 | 値 |
|------|-----|
| 総取引数 | ${summary.totalTrades}回 |
| 買い注文 | ${summary.buyTrades}回 |
| 売り注文 | ${summary.sellTrades}回 |
| 平均信頼度 | ${(summary.avgConfidence * 100).toFixed(1)}% |

## 🔍 取引詳細

### 実行された取引

${
  trades.length > 0
    ? trades
        .map(
          (trade, index) => `
#### ${index + 1}. ${trade.symbol} - ${trade.name}

- **取引種別**: ${trade.side === 'BUY' ? '買い' : '売り'}
- **数量**: ${trade.quantity}株
- **約定価格**: ¥${trade.initialPrice.toLocaleString()}
- **予測価格**: ¥${trade.predictedPrice.toLocaleString()}
- **信頼度**: ${(trade.confidence * 100).toFixed(1)}%
- **価格差**: ${(((trade.predictedPrice - trade.initialPrice) / trade.initialPrice) * 100).toFixed(2)}%
- **実現損益**: ¥${trade.pnl.toLocaleString()} (${trade.pnlPercent.toFixed(2)}%)
- **実行時刻**: ${new Date(trade.timestamp).toLocaleString('ja-JP')}
`
        )
        .join('\n')
    : '取引は実行されませんでした。'
}

### 現在のポジション

${
  positions.length > 0
    ? positions
        .map(
          (position, index) => `
#### ${index + 1}. ${position.symbol}

- **保有数量**: ${position.quantity}株
- **平均取得価格**: ¥${position.averagePrice.toLocaleString()}
- **現在価格**: ¥${position.currentPrice.toLocaleString()}
- **未実現損益**: ¥${position.unrealizedPnl.toLocaleString()}
- **未実現損益率**: ${position.unrealizedPnlPercent.toFixed(2)}%
`
        )
        .join('\n')
    : '現在ポジションはありません。'
}

## 📋 注文履歴

${orders
  .map(
    (order, index) => `
### ${index + 1}. 注文ID: ${order.id}

- **銘柄**: ${order.symbol}
- **種別**: ${order.side === 'BUY' ? '買い' : '売り'}
- **数量**: ${order.quantity}株
- **価格**: ¥${order.price.toLocaleString()}
- **ステータス**: ${order.status === 'FILLED' ? '約定' : order.status === 'PENDING' ? '待機中' : 'キャンセル'}
- **発注時刻**: ${new Date(order.createdAt).toLocaleString('ja-JP')}
${order.filledAt ? `- **約定時刻**: ${new Date(order.filledAt).toLocaleString('ja-JP')}` : ''}
`
  )
  .join('\n')}

## 🤖 予測システムの分析

### 予測精度

- **平均信頼度**: ${(summary.avgConfidence * 100).toFixed(1)}%
- **予測モデル**: 単純移動平均（SMA5, SMA10, SMA20）ベース
- **特徴量**: 価格トレンド、ボラティリティ分析

### 取引戦略

1. **買い条件**: 予測価格が現在価格より2%以上高く、信頼度40%以上
2. **売り条件**: 予測価格が現在価格より2%以上低く、信頼度40%以上
3. **取引金額**: 1回あたり最大5万円
4. **リスク管理**: ポジションサイズの制限

## 📊 パフォーマンス評価

### 成功要因

${
  trades.length > 0
    ? `
- 予測システムが適切に動作し、取引条件を満たす銘柄を特定
- リスク管理により適切なポジションサイズを維持
- デモ環境での安全な取引実行
`
    : `
- 保守的な取引条件により、リスクを最小化
- 予測信頼度が低い場合の取引回避
- システムの安定性を確認
`
}

### 改善点

1. **予測精度の向上**: より多くの技術指標の組み合わせ
2. **取引頻度の増加**: 取引条件の最適化
3. **リスク管理の強化**: ストップロス機能の実装
4. **バックテスト**: より長期間での戦略検証

## 🔮 今後の展望

### 短期目標

- より多くの銘柄での取引テスト
- 取引条件の最適化
- リアルタイム価格更新との連携

### 中期目標

- 機械学習モデルの改善
- リスク管理機能の強化
- バックテスト機能の実装

### 長期目標

- 本格的な取引APIとの連携
- 自動売買システムの構築
- ポートフォリオ最適化

## 📝 技術仕様

### 使用技術

- **フレームワーク**: Next.js 15
- **データベース**: SQLite (Prisma ORM)
- **予測エンジン**: 移動平均ベース予測
- **取引エンジン**: デモトレードサービス

### システム構成

- **フロントエンド**: React + TypeScript
- **バックエンド**: Next.js API Routes
- **データ処理**: リアルタイム価格取得
- **予測処理**: 技術指標計算 + 移動平均分析

---

**レポート生成日時**: ${new Date().toLocaleString('ja-JP')}  
**システムバージョン**: デモトレード v1.0.0  
**テスト環境**: MacBook (macOS) + Node.js 18.19.0
`;
}

async function main() {
  try {
    // 取引結果データを読み込み
    const dataPath = join(process.cwd(), 'trading-results.json');
    const data: ReportData = JSON.parse(readFileSync(dataPath, 'utf-8'));

    // Markdownレポートを生成
    const markdownReport = generateMarkdownReport(data);

    // レポートを保存
    const reportPath = join(process.cwd(), 'result', 'demo-trading-report.md');
    const fs = await import('fs');
    fs.writeFileSync(reportPath, markdownReport, 'utf-8');

    console.log('✅ デモトレードレポートを生成しました');
    console.log(`📄 保存先: ${reportPath}`);
    console.log(`📊 取引数: ${data.summary.totalTrades}回`);
    console.log(
      `💰 損益: ¥${data.summary.totalReturn.toLocaleString()} (${data.summary.totalReturnPercent.toFixed(2)}%)`
    );
  } catch (error) {
    console.error('❌ レポート生成エラー:', error);
  }
}

main();
