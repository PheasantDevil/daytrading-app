# Phase 2: シグナル統合サービス実装

## 📋 目的

複数の外部シグナルサービスから取得したシグナルを統合し、過半数判定により購入・売却の意思決定を行うサービスを実装する。

---

## ✅ 実装完了内容

### 1. SignalAggregatorService

**ファイル**: `src/services/signal-aggregator-service.ts`

**主要機能**:
- ✅ 複数サービスからのシグナル並列取得
- ✅ 過半数判定による購入/売却判定
- ✅ 最適候補の自動選択
- ✅ タイムアウト制御
- ✅ エラーハンドリング
- ✅ 柔軟な設定変更

**インターフェース**:
```typescript
export interface AggregatedSignal {
  symbol: string;
  buySignals: number;       // 買いシグナル数
  holdSignals: number;      // 保留シグナル数
  sellSignals: number;      // 売りシグナル数
  totalSources: number;     // 総ソース数
  buyPercentage: number;    // 買い推奨率
  shouldBuy: boolean;       // 購入すべきか（過半数判定）
  shouldSell: boolean;      // 売却すべきか（過半数判定）
  signals: TradingSignal[]; // 個別シグナル詳細
  timestamp: Date;
}
```

**設定**:
```typescript
export interface SignalAggregatorConfig {
  // 過半数判定の閾値（サイト数ごと）
  requiredVoteRatio: {
    3: 0.67,  // 3サイト → 67%以上 = 2サイト以上
    4: 0.75,  // 4サイト → 75%以上 = 3サイト以上
    5: 0.80,  // 5サイト → 80%以上 = 4サイト以上
    6: 0.67,  // 6サイト → 67%以上 = 4サイト以上
  };
  timeout: number;        // タイムアウト（ms）
  minSources: number;     // 最小必要ソース数
}
```

---

## 🎯 過半数判定ロジック

### 判定ルール

要求仕様に基づいた過半数判定：

| 総サイト数 | 必要票数 | 閾値 | 計算式 |
|-----------|---------|------|--------|
| 3サイト | 2票以上 | 67% | ceil(3 × 0.67) = 2 |
| 4サイト | 3票以上 | 75% | ceil(4 × 0.75) = 3 |
| 5サイト | 4票以上 | 80% | ceil(5 × 0.80) = 4 |
| 6サイト | 4票以上 | 67% | ceil(6 × 0.67) = 4 |

### 実装コード

```typescript
private calculateRequiredVotes(total: number): number {
  const ratio = this.config.requiredVoteRatio[total] || 0.67;
  const required = Math.ceil(total * ratio);
  return required;
}
```

### 判定例

**例1: 5サービス中3つがBUY**
```
総サイト数: 5
BUY: 3票 (60%)
必要票数: 4票 (80%)
→ 判定: shouldBuy = false（見送り）
```

**例2: 5サービス中4つがBUY**
```
総サイト数: 5
BUY: 4票 (80%)
必要票数: 4票 (80%)
→ 判定: shouldBuy = true（購入推奨）
```

**例3: 3サービス中2つがBUY**
```
総サイト数: 3
BUY: 2票 (67%)
必要票数: 2票 (67%)
→ 判定: shouldBuy = true（購入推奨）
```

---

## 🏗️ 主要メソッド

### 1. aggregateSignals(symbol: string)

**機能**: 単一銘柄のシグナル集約

**処理フロー**:
```
1. 全サービスから並列にシグナル取得
   ├─ サービス可用性チェック
   ├─ タイムアウト制御（30秒）
   └─ エラー時はnull返却

2. 有効なシグナルをフィルタリング
   └─ null除外、最小ソース数チェック

3. シグナルを集計
   ├─ BUY/HOLD/SELL をカウント
   └─ パーセンテージ計算

4. 過半数判定
   ├─ 必要票数を計算
   └─ shouldBuy, shouldSell を判定

5. 結果を返却
```

**使用例**:
```typescript
const signal = await aggregator.aggregateSignals('AAPL');

console.log(signal.buySignals);      // 4
console.log(signal.totalSources);    // 5
console.log(signal.buyPercentage);   // 80.0
console.log(signal.shouldBuy);       // true
```

---

### 2. aggregateMultipleSignals(symbols: string[])

**機能**: 複数銘柄のシグナル集約

**使用例**:
```typescript
const signals = await aggregator.aggregateMultipleSignals([
  'AAPL', 'GOOGL', 'MSFT'
]);

// 各銘柄のシグナルを確認
signals.forEach(signal => {
  console.log(`${signal.symbol}: ${signal.shouldBuy ? '購入' : '見送り'}`);
});
```

---

### 3. filterBuyRecommendations(signals: AggregatedSignal[])

**機能**: 購入推奨銘柄のフィルタリング

**処理**:
- shouldBuy = true の銘柄を抽出
- 買い推奨率（buyPercentage）で降順ソート

**使用例**:
```typescript
const buyRecommendations = aggregator.filterBuyRecommendations(signals);

console.log(`購入推奨: ${buyRecommendations.length}銘柄`);
```

---

### 4. selectBestBuyCandidate(signals: AggregatedSignal[])

**機能**: 最適な購入候補を1つ選択

**選択基準**:
- shouldBuy = true の銘柄の中から
- 買い推奨率（buyPercentage）が最も高い銘柄

**使用例**:
```typescript
const best = aggregator.selectBestBuyCandidate(signals);

if (best) {
  console.log(`最適候補: ${best.symbol}`);
  console.log(`買い推奨率: ${best.buyPercentage}%`);
}
```

---

## 🧪 テストスクリプト

**ファイル**: `scripts/test-signal-aggregator.ts`

**実行方法**:
```bash
npm run practice:aggregator
```

**テスト内容**:

1. **単一銘柄のシグナル集約**
   - AAPL のシグナルを全5サービスから取得
   - 集約結果の表示
   - 個別シグナル詳細の表示

2. **複数銘柄のシグナル集約**
   - AAPL, GOOGL, MSFT の3銘柄
   - 各銘柄の購入推奨判定

3. **購入推奨銘柄のフィルタリング**
   - shouldBuy = true の銘柄を抽出
   - 買い推奨率でソート

4. **最適候補の選択**
   - 最も買い推奨率が高い銘柄を選択
   - 推奨理由の表示

5. **過半数判定ロジックの検証**
   - 8つのテストケース
   - 3-6サイトの各パターン

**出力例**:
```
📊 === テスト1: 単一銘柄のシグナル集約 ===

📈 集約結果:
銘柄: AAPL
総ソース数: 5
BUY: 4票 (80.0%)
HOLD: 1票 (20.0%)
SELL: 0票 (0.0%)
購入判定: ✅ YES
売却判定: ❌ NO

📋 個別シグナル詳細:
  1. yahoo_finance: BUY (80%)
     理由: 上昇トレンド(+1.5%), 高出来高(5.2M)
  2. tradingview: BUY (85%)
     理由: TradingView: Strong Buy, Buy
  3. investing_com: BUY (75%)
     理由: Investing.com: Strong Buy
  4. finviz: BUY (80%)
     理由: Finviz: Strong Buy (1.5)
  5. marketwatch: HOLD (50%)
     理由: MarketWatch: Buy=5 Hold=10 Sell=3

⭐ === テスト4: 最適候補の選択 ===

🎯 最適購入候補:
  銘柄: AAPL
  買い推奨率: 80.0%
  買い票数: 4/5
  判定: ✅ 購入推奨

  推奨理由:
    - yahoo_finance: 上昇トレンド(+1.5%), 高出来高(5.2M)
    - tradingview: TradingView: Strong Buy, Buy
    - investing_com: Investing.com: Strong Buy
    - finviz: Finviz: Strong Buy (1.5)
```

---

## 📊 データフロー

```
複数銘柄 ['AAPL', 'GOOGL', 'MSFT']
    ↓
┌─────────────────────────────────────┐
│ SignalAggregatorService             │
│                                     │
│ for each symbol:                    │
│   ├─ Yahoo Finance  → BUY (80%)    │
│   ├─ TradingView    → BUY (85%)    │
│   ├─ Investing.com  → BUY (75%)    │
│   ├─ Finviz         → BUY (80%)    │
│   └─ MarketWatch    → HOLD (50%)   │
│                                     │
│ 集計:                               │
│   BUY: 4票 (80%)                   │
│   HOLD: 1票 (20%)                  │
│   SELL: 0票 (0%)                   │
│                                     │
│ 過半数判定:                         │
│   必要票数: 4票 (80%)               │
│   shouldBuy: true ✅               │
└─────────────────────────────────────┘
    ↓
購入推奨銘柄リスト
    ↓
最適候補選択（買い推奨率最高）
    ↓
AAPL (80.0%)
```

---

## 🎯 使用例

### 基本的な使用方法

```typescript
import { SignalAggregatorService } from './services/signal-aggregator-service';
import { YahooFinanceSignalService } from './services/external-signals/yahoo-finance-signal';
import { TradingViewSignalService } from './services/external-signals/tradingview-signal';
// ... 他のサービスをimport

// サービスの初期化
const services = [
  new YahooFinanceSignalService(),
  new TradingViewSignalService(),
  new InvestingSignalService(),
  new FinvizSignalService(),
  new MarketWatchSignalService(),
];

// 統合サービスの作成
const aggregator = new SignalAggregatorService(services);

// シグナル集約
const signal = await aggregator.aggregateSignals('AAPL');

// 購入判定
if (signal.shouldBuy) {
  console.log(`${signal.symbol}を購入推奨`);
  console.log(`買い推奨率: ${signal.buyPercentage}%`);
  console.log(`賛成: ${signal.buySignals}/${signal.totalSources}`);
}
```

### 複数銘柄から最適候補を選択

```typescript
// 候補銘柄のスクリーニング
const candidates = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];

// 全候補のシグナル集約
const signals = await aggregator.aggregateMultipleSignals(candidates);

// 最適候補を選択
const best = aggregator.selectBestBuyCandidate(signals);

if (best) {
  console.log(`今日の購入候補: ${best.symbol}`);
  console.log(`買い推奨率: ${best.buyPercentage}%`);
  
  // 購入実行
  await executeTrade(best.symbol);
}
```

### カスタム設定

```typescript
// より厳しい判定基準
const strictAggregator = new SignalAggregatorService(services, {
  requiredVoteRatio: {
    3: 1.0,   // 3サイト → 100% = 全員一致
    4: 1.0,   // 4サイト → 100% = 全員一致
    5: 1.0,   // 5サイト → 100% = 全員一致
  },
  timeout: 20000,  // 20秒
  minSources: 3,   // 最低3サイト必要
});

// より緩い判定基準
const relaxedAggregator = new SignalAggregatorService(services, {
  requiredVoteRatio: {
    3: 0.5,   // 3サイト → 50%以上 = 2サイト以上
    4: 0.5,   // 4サイト → 50%以上 = 2サイト以上
    5: 0.6,   // 5サイト → 60%以上 = 3サイト以上
  },
  minSources: 2,   // 最低2サイトでOK
});
```

---

## 🔧 主要メソッド詳細

### aggregateSignals(symbol: string)

**戻り値**: `Promise<AggregatedSignal>`

**処理**:
1. 全サービスから並列にシグナル取得
2. タイムアウト・エラーハンドリング
3. シグナル集計
4. 過半数判定
5. 結果返却

**エラーハンドリング**:
- 個別サービスのエラーは無視（null返却）
- 有効ソースが最小数未満ならエラー
- タイムアウト時はnull返却

---

### aggregateMultipleSignals(symbols: string[])

**戻り値**: `Promise<AggregatedSignal[]>`

**処理**:
- 各銘柄に対してaggregateSignalsを実行
- エラー時はスキップして継続

---

### filterBuyRecommendations(signals: AggregatedSignal[])

**戻り値**: `AggregatedSignal[]`（買い推奨率降順）

**処理**:
- shouldBuy = true をフィルタ
- buyPercentageで降順ソート

---

### selectBestBuyCandidate(signals: AggregatedSignal[])

**戻り値**: `AggregatedSignal | null`

**処理**:
- filterBuyRecommendations を実行
- 最も買い推奨率が高い銘柄を返却
- 推奨銘柄がない場合はnull

---

## 📈 期待される動作

### シナリオ1: 全員一致

```
5サービス全てがBUY
→ buySignals: 5/5 (100%)
→ shouldBuy: true ✅
→ 確信度: 非常に高い
```

### シナリオ2: 過半数一致

```
5サービス中4つがBUY、1つがHOLD
→ buySignals: 4/5 (80%)
→ shouldBuy: true ✅
→ 確信度: 高い
```

### シナリオ3: 過半数未達

```
5サービス中3つがBUY、2つがHOLD
→ buySignals: 3/5 (60%)
→ shouldBuy: false ❌
→ 見送り
```

### シナリオ4: 意見が分かれる

```
5サービス中2つがBUY、2つがSELL、1つがHOLD
→ buySignals: 2/5 (40%)
→ sellSignals: 2/5 (40%)
→ shouldBuy: false, shouldSell: false
→ 見送り
```

---

## ⚙️ エラーハンドリング

### サービスエラー時

```typescript
// 個別サービスのエラーは無視
try {
  const signal = await service.getSignal(symbol);
} catch (error) {
  logger.warn(`${service.name} failed`);
  return null; // nullを返して継続
}

// 最終的に有効シグナルが最小数以上あればOK
if (validSignals.length >= minSources) {
  // 過半数判定を実行
}
```

### タイムアウト時

```typescript
// 30秒でタイムアウト
const signal = await Promise.race([
  service.getSignal(symbol),
  timeout(30000)
]);
```

### 最小ソース数未満

```typescript
if (validSignals.length < this.config.minSources) {
  throw new Error('Insufficient signal sources');
}
```

---

## 📊 統計とイベント

### イベント発行

```typescript
// シグナル集約完了時
aggregator.on('signalsAggregated', (result) => {
  console.log('シグナル集約完了:', result);
});
```

### 統計情報取得

```typescript
const stats = aggregator.getStats();

console.log('登録サービス数:', stats.totalServices);
console.log('アクティブサービス数:', stats.activeServices);
console.log('設定:', stats.config);
```

---

## 🚀 実際の使用フロー

### デイトレード戦略での使用

```typescript
// 11:00 - 購入フェーズ
async function executeBuyPhase() {
  // 1. 候補銘柄をスクリーニング
  const candidates = await screenStocks({
    minVolume: 1000000,
    minPrice: 50,
    maxPrice: 500,
  });
  
  // 2. 全候補のシグナル集約
  const signals = await aggregator.aggregateMultipleSignals(candidates);
  
  // 3. 最適候補を選択
  const best = aggregator.selectBestBuyCandidate(signals);
  
  if (best) {
    logger.info(`🎯 本日の購入銘柄: ${best.symbol}`);
    logger.info(`買い推奨率: ${best.buyPercentage}%`);
    logger.info(`賛成: ${best.buySignals}/${best.totalSources}`);
    
    // 4. 購入実行
    await placeBuyOrder(best.symbol);
  } else {
    logger.info('❌ 購入推奨銘柄なし、本日は見送り');
  }
}

// 13:00-15:00 - 売却フェーズ
async function executeSellPhase() {
  const positions = await getPositions();
  
  for (const position of positions) {
    const profitRate = calculateProfitRate(position);
    
    // +5%以上達成時
    if (profitRate >= 0.05) {
      // シグナル確認
      const signal = await aggregator.aggregateSignals(position.symbol);
      
      if (signal.shouldSell || profitRate >= 0.07) {
        logger.info(`💰 売却実行: ${position.symbol} (+${profitRate * 100}%)`);
        await placeSellOrder(position.symbol);
      }
    }
  }
}
```

---

## 📝 実装チェックリスト

### Phase2 実装
- [x] SignalAggregatorService作成
- [x] 過半数判定ロジック実装
- [x] 複数銘柄対応
- [x] フィルタリング機能
- [x] 最適候補選択機能
- [x] タイムアウト制御
- [x] エラーハンドリング
- [x] イベント発行
- [x] 統計情報取得

### テスト
- [x] 単一銘柄テスト
- [x] 複数銘柄テスト
- [x] フィルタリングテスト
- [x] 最適候補選択テスト
- [x] 過半数判定テスト

### ドキュメント
- [x] Phase2実装ドキュメント
- [x] 使用例
- [x] データフロー図

---

## 🌟 次のPhase

**Phase 3**: デイトレードスケジューラー

**実装内容**:
- 時間ベース自動実行（11:00購入、13:00-15:00売却）
- SignalAggregatorServiceとの統合
- 1日1取引の制限
- ポジション管理

**実装予定ファイル**:
- `src/trading/day-trading-scheduler.ts`
- `scripts/test-day-trading-scheduler.ts`

---

## 💡 Phase2の成果

- ✅ 複数サイトからのシグナル統合
- ✅ 過半数判定による意思決定
- ✅ 最適候補の自動選択
- ✅ エラーに強い設計
- ✅ 柔軟な設定変更
- ✅ 次Phaseへの橋渡し完了

**過半数判定による賢い意思決定システムが完成しました！** 🎉

