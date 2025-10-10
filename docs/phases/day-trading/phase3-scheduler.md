# Phase 3: デイトレードスケジューラー実装

## 📋 目的

時間ベースで自動的に購入・売却を実行する完全自動化デイトレードシステムを実装する。

---

## ✅ 実装完了内容

### 1. DayTradingScheduler

**ファイル**: `src/trading/day-trading-scheduler.ts` (365行)

**主要機能**:

- ✅ 時間ベース自動実行（cron）
- ✅ 購入フェーズ（11:00）
- ✅ 売却フェーズ（13:00-15:00、1分間隔）
- ✅ 強制決済（15:00）
- ✅ ポジション管理
- ✅ リスク管理（ストップロス/テイクプロフィット）
- ✅ 取引履歴管理
- ✅ デイリーレポート生成

### 2. DayTradingConfig

**ファイル**: `src/config/day-trading-config.ts`

**設定項目**:

- スケジュール（購入/売却/強制決済時刻）
- シグナルソース（5サイト）
- 過半数判定閾値
- リスク管理（ストップロス/テイクプロフィット）
- スクリーニング条件
- 取引設定
- 通知設定

---

## 🕐 スケジュール

### タイムライン（米国東部時間）

```
09:00 ─────────────────────────────────── 市場オープン

11:00 ───┐
         │ 購入フェーズ
         │ ├─ 候補銘柄スクリーニング
         │ ├─ 全候補のシグナル集約
         │ ├─ 過半数判定
         │ └─ 最適候補を購入
         │
11:30 ───┘

13:00 ───┐
         │ 売却監視フェーズ（1分間隔）
         │
         │ ループ:
         │ ├─ 現在価格チェック
         │ ├─ 損益計算
         │ ├─ ストップロス判定（-3%）
         │ ├─ テイクプロフィット判定（+5%）
         │ │   └─ 売却シグナル確認
         │ └─ 必要に応じて売却
         │
15:00 ───┤ 強制決済
         │ └─ 保有ポジションを全て決済
         │
15:30 ─────────────────────────────────── 市場クローズ
```

### 日本時間設定

```typescript
import { japanDayTradingConfig } from '../config/day-trading-config';

// 日本市場用
const scheduler = new DayTradingScheduler(
  japanDayTradingConfig, // 09:30購入、14:30強制決済
  ...
);
```

---

## 📊 購入フェーズの詳細

### 処理フロー

```
11:00 購入フェーズ開始
    ↓
ポジション保有チェック
    ├─ 既に保有 → スキップ
    └─ 未保有 → 継続
    ↓
1日の取引数チェック
    ├─ 上限達成 → スキップ
    └─ 未達 → 継続
    ↓
Step 1: 候補銘柄スクリーニング
    - 出来高 > 100万株
    - 価格 $10-$500
    - 上位10銘柄を選択
    ↓
Step 2: シグナル集約
    - 全候補について5サイトからシグナル取得
    - 過半数判定を実行
    ↓
Step 3: 最適候補選択
    - 購入推奨（shouldBuy=true）の中から
    - 買い推奨率が最も高い銘柄を選択
    ↓
Step 4: 購入実行
    - 市場価格取得
    - ポジションサイズ計算
    - 成行注文を発注
    - ポジション記録
    - 取引履歴に追加
    ↓
売却監視開始（13:00から）
```

### 実装コード

```typescript
private async executeBuyPhase(): Promise<void> {
  // 1. 候補銘柄スクリーニング
  const candidates = await this.screenCandidates();

  // 2. シグナル集約
  const signals = await this.signalAggregator.aggregateMultipleSignals(candidates);

  // 3. 最適候補選択
  const best = this.signalAggregator.selectBestBuyCandidate(signals);

  if (best) {
    // 4. 購入実行
    await this.executeBuy(best.symbol, best);

    // 売却監視開始
    this.startSellMonitoring();
  }
}
```

---

## 💰 売却フェーズの詳細

### 処理フロー

```
13:00 売却監視開始
    ↓
1分ごとにループ ────┐
    │               │
    ↓               │
ポジションあり？    │
    ├─ なし → スキップ ────┘
    └─ あり → 継続
    ↓
現在価格取得
    ↓
損益計算
    ↓
緊急ストップロス判定（-5%）
    ├─ YES → 即座に売却
    └─ NO → 継続
    ↓
ストップロス判定（-3%）
    ├─ YES → 即座に売却
    └─ NO → 継続
    ↓
テイクプロフィット判定（+5%）
    ├─ NO → 継続 ────────┘
    └─ YES → シグナル確認
              ↓
         売却シグナル確認
              ↓
         過半数が売り推奨？
         または+7%以上？
              ├─ YES → 売却実行
              └─ NO → 保持継続 ──┘
```

### リスク管理

**3段階の保護**:

1. **緊急ストップロス（-5%）**
   - 無条件で即座に売却
   - シグナル確認なし

2. **ストップロス（-3%）**
   - 即座に売却
   - シグナル確認なし

3. **テイクプロフィット（+5%）**
   - シグナル確認後に売却
   - 過半数が売り推奨、または+7%以上で即売却

### 実装コード

```typescript
private async executeSellPhase(): Promise<void> {
  if (!this.currentPosition) return;

  // 現在価格取得
  const marketData = await this.marketDataService.getMarketData(
    this.currentPosition.symbol
  );
  const currentPrice = marketData.price;

  // 損益計算
  const profitRate = (currentPrice - this.currentPosition.entryPrice) /
                     this.currentPosition.entryPrice;

  // 緊急ストップロス（-5%）
  if (profitRate <= this.config.riskManagement.emergencyStopLoss) {
    await this.executeSell('緊急ストップロス');
    return;
  }

  // ストップロス（-3%）
  if (profitRate <= this.config.riskManagement.stopLoss) {
    await this.executeSell('ストップロス');
    return;
  }

  // テイクプロフィット（+5%）
  if (profitRate >= this.config.riskManagement.takeProfit) {
    const signal = await this.signalAggregator.aggregateSignals(
      this.currentPosition.symbol
    );

    if (signal.shouldSell || profitRate >= 0.07) {
      await this.executeSell(`目標達成 (+${(profitRate * 100).toFixed(2)}%)`);
    }
  }
}
```

---

## 🎯 1日の取引フロー例

### 成功ケース

```
11:00 ─ 購入フェーズ
  候補: AAPL, GOOGL, MSFT, TSLA
  シグナル集約:
    - AAPL: 4/5サイトがBUY (80%) ✅
    - GOOGL: 2/5サイトがBUY (40%)
    - MSFT: 3/5サイトがBUY (60%)
    - TSLA: 1/5サイトがBUY (20%)

  最適候補: AAPL (80%)
  購入: AAPL × 50株 @ $200.00

13:00 ─ 売却監視開始
  AAPL: $201.00 (+0.5%) → 保持

13:30 ─ 売却チェック
  AAPL: $208.00 (+4.0%) → 保持（目標未達）

14:15 ─ 売却チェック
  AAPL: $210.50 (+5.25%) → 目標達成！
  シグナル確認: 3/5サイトがSELL (60%) → 過半数
  売却: AAPL × 50株 @ $210.50

  損益: +$525 (+5.25%)
```

### 失敗ケース（ストップロス）

```
11:00 ─ 購入フェーズ
  購入: GOOGL × 30株 @ $150.00

13:00 ─ 売却監視開始
  GOOGL: $148.00 (-1.33%) → 保持

13:45 ─ 売却チェック
  GOOGL: $145.50 (-3.0%) → ストップロス発動！
  売却: GOOGL × 30株 @ $145.50

  損益: -$135 (-3.0%)
```

---

## ⚙️ 設定詳細

### デフォルト設定

```typescript
export const defaultDayTradingConfig: DayTradingConfig = {
  schedule: {
    buyTime: '11:00', // 11:00 AM
    sellCheckStart: '13:00', // 1:00 PM
    sellCheckInterval: 60000, // 1分ごと
    forceCloseTime: '15:00', // 3:00 PM
    timezone: 'America/New_York',
  },

  riskManagement: {
    stopLoss: -0.03, // -3%
    takeProfit: 0.05, // +5%
    maxPositionSize: 10000, // $10,000
    maxDailyTrades: 1, // 1日1取引
    emergencyStopLoss: -0.05, // -5%
  },

  screening: {
    minVolume: 1000000, // 100万株
    minPrice: 10, // $10
    maxPrice: 500, // $500
    excludeSectors: [],
    candidateCount: 10, // 上位10銘柄
  },

  trading: {
    enabled: false, // デフォルトは無効
    paperTrading: true, // ペーパートレーディング
    confirmBeforeTrade: true, // 取引前確認
    maxRetries: 3,
  },
};
```

### カスタマイズ例

```typescript
// より積極的な設定
const aggressiveConfig = {
  ...defaultDayTradingConfig,
  riskManagement: {
    ...defaultDayTradingConfig.riskManagement,
    takeProfit: 0.03, // +3%で利確（早め）
    maxDailyTrades: 3, // 1日3取引まで
  },
};

// より保守的な設定
const conservativeConfig = {
  ...defaultDayTradingConfig,
  riskManagement: {
    ...defaultDayTradingConfig.riskManagement,
    stopLoss: -0.02, // -2%でストップ（早め）
    takeProfit: 0.07, // +7%で利確（慎重）
  },
};
```

---

## 🧪 テストスクリプト

**ファイル**: `scripts/test-day-trading-scheduler.ts`

**実行方法**:

```bash
npm run practice:day-trading
```

**テスト内容**:

1. セットアップ（IB、市場データ、シグナル統合）
2. イベントリスナー設定
3. テストモード実行（即座に購入→売却）
4. 結果確認（ポジション、履歴、統計）
5. デイリーレポート生成

**出力例**:

```
🔧 === セットアップ ===
✅ Interactive Brokers接続完了
✅ 市場データサービス初期化完了
✅ シグナル統合サービス初期化完了（5サービス）
✅ デイトレードスケジューラー初期化完了

🧪 === テストモード実行 ===

🔍 ========== 購入フェーズ開始 ==========

📊 Step 1: 候補銘柄のスクリーニング
候補銘柄: AAPL, GOOGL, MSFT, TSLA, AMZN

📈 Step 2: シグナル集約
集約結果: AAPL
  BUY: 4/5 (80.0%)
  必要票数: 4票 (80%)
  判定: 購入=true

🎯 Step 3: 最適候補の選択
✅ 最適候補: AAPL
買い推奨率: 80.0%
賛成: 4/5サイト

💰 Step 4: 購入実行
銘柄: AAPL
購入価格: $175.50
購入数量: 50株
購入金額: $8,775.00
✅ 購入完了: AAPL × 50株 @ $175.50

⏰ 13:00から売却チェックを開始します

🔄 売却監視を開始します
📊 AAPL: $183.27 (+4.43%)
✅ 目標利益達成: AAPL (+5.12%)
シグナル確認: SELL=3/5

💰 ========== 売却実行 ==========
銘柄: AAPL
理由: 目標達成 (+5.12%)
購入価格: $175.50
現在価格: $184.48
損益率: 5.12%
損益額: $449.00
✅ 売却完了: AAPL × 50株

📄 === デイリーレポート ===

========== デイリーレポート ==========
日付: 2025/10/10

【取引統計】
取引回数: 1
勝ち: 1
負け: 0
勝率: 100.0%
総損益: $449.00

【取引履歴】
1. BUY AAPL × 50株 @ $175.50
   理由: シグナル集約: 4/5サイトが推奨

2. SELL AAPL × 50株 @ $184.48
   理由: 目標達成 (+5.12%)
   損益: 5.12% ($449.00)

========================================
```

---

## 🛡️ リスク管理

### 3段階の保護機能

#### レベル1: 緊急ストップロス（-5%）

```typescript
if (profitRate <= -0.05) {
  // 無条件で即座に売却
  // シグナル確認なし
  await this.executeSell('緊急ストップロス');
}
```

**目的**: 大損失を防ぐ最終防衛ライン

#### レベル2: 通常ストップロス（-3%）

```typescript
if (profitRate <= -0.03) {
  // 即座に売却
  // シグナル確認なし
  await this.executeSell('ストップロス');
}
```

**目的**: 損失を最小限に抑える

#### レベル3: テイクプロフィット（+5%）

```typescript
if (profitRate >= 0.05) {
  // シグナル確認後に判断
  const signal = await this.signalAggregator.aggregateSignals(symbol);

  if (signal.shouldSell || profitRate >= 0.07) {
    await this.executeSell('目標達成');
  }
}
```

**目的**: 利益を確実に確保しつつ、さらなる上昇も狙う

---

## 📈 取引制限

### 1日1取引の制限

```typescript
const todayTrades = this.tradeHistory.filter(
  (t) => t.date.toDateString() === today && t.action === 'BUY'
).length;

if (todayTrades >= this.config.riskManagement.maxDailyTrades) {
  // スキップ
}
```

**理由**: 過剰な取引を防ぎ、質の高い取引に集中

### 最大ポジションサイズ

```typescript
const quantity = Math.floor(this.config.riskManagement.maxPositionSize / price);
```

**例**:

- 最大ポジションサイズ: $10,000
- 株価: $200
- 購入数量: 50株（$10,000 / $200）

---

## 📊 ポジション管理

### Position インターフェース

```typescript
export interface Position {
  symbol: string; // 銘柄
  quantity: number; // 数量
  entryPrice: number; // 購入価格
  entryTime: Date; // 購入時刻
  currentPrice: number; // 現在価格
  profitRate: number; // 損益率
  profitAmount: number; // 損益額
}
```

### TradeHistory インターフェース

```typescript
export interface TradeHistory {
  date: Date; // 日時
  symbol: string; // 銘柄
  action: 'BUY' | 'SELL'; // 売買
  quantity: number; // 数量
  price: number; // 価格
  profitRate?: number; // 損益率
  profitAmount?: number; // 損益額
  reason: string; // 理由
}
```

---

## 📡 イベント

### 発行されるイベント

```typescript
scheduler.on('started', () => {
  // スケジューラー起動
});

scheduler.on('buySignalGenerated', (signal) => {
  // 購入シグナル生成（confirmBeforeTrade=trueの場合）
});

scheduler.on('buyExecuted', (position) => {
  // 購入実行完了
});

scheduler.on('sellExecuted', (position) => {
  // 売却実行完了
});

scheduler.on('error', (error) => {
  // エラー発生
});

scheduler.on('stopped', () => {
  // スケジューラー停止
});
```

---

## 💡 使用例

### 基本的な使用方法

```typescript
import { DayTradingScheduler } from './trading/day-trading-scheduler';
import { defaultDayTradingConfig } from './config/day-trading-config';

// 初期化
const scheduler = new DayTradingScheduler(
  defaultDayTradingConfig,
  signalAggregator,
  marketDataService,
  brokerIntegration
);

// イベントリスナー設定
scheduler.on('buyExecuted', (position) => {
  console.log('購入:', position.symbol);
  // メール通知など
});

scheduler.on('sellExecuted', (position) => {
  console.log('売却:', position.symbol);
  console.log('損益:', position.profitAmount);
  // メール通知など
});

// 開始
await scheduler.start();

// 停止
// await scheduler.stop();
```

### 本番運用での使用

```typescript
const productionConfig = {
  ...defaultDayTradingConfig,
  trading: {
    enabled: true, // 自動取引有効
    paperTrading: false, // 本番取引
    confirmBeforeTrade: false, // 確認なし
    maxRetries: 3,
  },
};

const scheduler = new DayTradingScheduler(
  productionConfig,
  signalAggregator,
  marketDataService,
  brokerIntegration
);

await scheduler.start();
```

**⚠️ 警告**: 本番運用は十分なテスト後のみ！

---

## 🔒 安全機能

### 1. デフォルトで無効化

```typescript
trading: {
  enabled: false,  // 明示的に有効化しない限り動作しない
}
```

### 2. 取引前確認

```typescript
trading: {
  confirmBeforeTrade: true,  // 取引前に確認
}
```

この設定の場合、実際には取引せず、シグナルのみ生成

### 3. ペーパートレーディング

```typescript
trading: {
  paperTrading: true,  // 仮想取引
}
```

### 4. 1日1取引制限

```typescript
riskManagement: {
  maxDailyTrades: 1,  // 過剰取引を防ぐ
}
```

---

## 📝 実装チェックリスト

### Phase3 実装

- [x] DayTradingScheduler作成
- [x] DayTradingConfig作成
- [x] 購入フェーズ実装
- [x] 売却フェーズ実装
- [x] ストップロス実装
- [x] テイクプロフィット実装
- [x] 強制決済実装
- [x] ポジション管理
- [x] 取引履歴管理
- [x] デイリーレポート生成
- [x] イベント発行
- [x] テストモード実装

### テスト

- [x] セットアップテスト
- [x] 購入フェーズテスト
- [x] 売却フェーズテスト
- [x] リスク管理テスト
- [x] レポート生成テスト

### ドキュメント

- [x] Phase3実装ドキュメント
- [x] スケジュール説明
- [x] フロー図
- [x] 設定詳細
- [x] 使用例

---

## 🚀 次のPhase

**Phase 4**: リアルタイム監視とリスク管理強化

**実装内容**:

- より詳細なリスク分析
- ポートフォリオ管理
- 複数戦略の並行実行
- パフォーマンス分析

**実装予定ファイル**:

- `src/trading/day-trading-risk-manager.ts`
- `src/analytics/performance-analyzer.ts`

---

## 📈 期待される成果

- ✅ 完全自動化された1日1取引システム
- ✅ 過半数判定による賢い意思決定
- ✅ 多段階リスク管理
- ✅ 詳細な取引履歴とレポート
- ✅ 安全機能による事故防止
- ✅ 柔軟な設定変更

**1日1取引の完全自動デイトレードシステムが完成しました！** 🎉
