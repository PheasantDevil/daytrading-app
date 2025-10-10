# Phase 1-3: シグナルサービス実装

## 📋 目的

複数の金融情報サイトから売買シグナルを取得するサービスを実装し、過半数判定の基盤を構築する。

---

## ✅ 実装完了内容

### 1. Yahoo Finance シグナルサービス

**ファイル**: `src/services/external-signals/yahoo-finance-signal.ts`

**機能**:

- 既存のYahooFinanceServiceを活用
- テクニカル分析に基づくシグナル生成
- 複数指標の総合判定

**分析項目**:

1. 価格変動率（changePercent）
   - +2%以上: 買いスコア+2
   - 0%以上: 買いスコア+1
   - -2%以下: 売りスコア+2

2. 出来高分析
   - 平均の1.5倍以上: 買いスコア+1
   - 平均の0.5倍以下: 売りスコア+1

3. 価格位置（高値・安値との比較）
   - 上位80%以上: 売りスコア+1（高値圏）
   - 下位20%以下: 買いスコア+1（安値圏）

4. ギャップ分析（前日終値との比較）
   - +1%以上: 買いスコア+1
   - -1%以下: 売りスコア+1

**シグナル判定**:

- 買いスコア > 売りスコア+1 → BUY
- 売りスコア > 買いスコア+1 → SELL
- それ以外 → HOLD

**確信度計算**: 60 + スコア × 10（最大95%）

---

### 2. TradingView シグナルサービス

**ファイル**: `src/services/external-signals/tradingview-signal.ts`

**機能**:

- Puppeteerでテクニカルサマリーをスクレイピング
- Overall、移動平均線、オシレーターの3指標を統合

**取得データ**:

- Overall Signal (Strong Buy/Buy/Neutral/Sell/Strong Sell)
- Moving Averages Signal
- Oscillators Signal

**URL**: `https://www.tradingview.com/symbols/NASDAQ-{SYMBOL}/technicals/`

**セレクタ**:

- `.speedometerSignal-pyzN--tL` - Overall Signal
- `[data-name="moving-averages-gauge"]` - MA Signal
- `[data-name="oscillators-gauge"]` - Oscillator Signal

**シグナル判定**:

- Strong Buy: 買いカウント+2
- Buy: 買いカウント+1
- Strong Sell: 売りカウント+2
- Sell: 売りカウント+1

**確信度計算**: 50 + カウント × 15（最大95%）

---

### 3. Investing.com シグナルサービス

**ファイル**: `src/services/external-signals/investing-signal.ts`

**機能**:

- Technical Summary と各時間軸のシグナルを取得
- 複数時間軸の総合判定

**取得データ**:

- Technical Summary (Strong Buy/Buy/Neutral/Sell/Strong Sell)
- 5分足、1時間足、日足のシグナル

**URL**: `https://www.investing.com/equities/{SYMBOL_SLUG}-technical`

**シンボルマッピング**:

```typescript
AAPL → apple-computer-inc
GOOGL → alphabet-inc
MSFT → microsoft-corp
```

**セレクタ**:

- `.technicalSummary` - Technical Summary
- `.summaryTableLine` - 時間軸別シグナル

**シグナル判定**:

- Summary Strong Buy: +3
- Summary Buy: +2
- 各時間軸Buy: +1

**確信度計算**: 50 + カウント × 10（最大95%）

---

### 4. Finviz シグナルサービス

**ファイル**: `src/services/external-signals/finviz-signal.ts`

**機能**:

- アナリストレーティングとテクニカル指標を分析
- RSI、週間パフォーマンスを考慮

**取得データ**:

- Analyst Recommendation (1.0-5.0)
- RSI (14)
- Performance Week
- Performance Month

**URL**: `https://finviz.com/quote.ashx?t={SYMBOL}`

**セレクタ**:

- `.snapshot-td2` - 各種データ

**シグナル判定**:

- Analyst Recom 1.0-1.5: 買いスコア+3
- Analyst Recom 1.5-2.0: 買いスコア+2
- Analyst Recom 4.0-5.0: 売りスコア+3
- RSI < 30: 買いスコア+2（過売り）
- RSI > 70: 売りスコア+2（過買い）
- 週間 +5%以上: 買いスコア+1

**確信度計算**: 60 + スコア × 8（最大95%）

---

### 5. MarketWatch シグナルサービス

**ファイル**: `src/services/external-signals/marketwatch-signal.ts`

**機能**:

- アナリストレーティングの集計
- Buy/Hold/Sell の比率から判定

**取得データ**:

- Buy レーティング数
- Hold レーティング数
- Sell レーティング数
- 目標株価

**URL**: `https://www.marketwatch.com/investing/stock/{SYMBOL}/analystestimates`

**セレクタ**:

- `.table__row` - レーティング行
- `.table__cell` - セル

**シグナル判定**:

- Buy比率 > 60%: BUY
- Sell比率 > 60%: SELL
- Buy比率 > Sell比率: BUY（弱気）
- その他: HOLD

**確信度計算**: 60 + 比率 × 30（最大95%）

---

## 🏗️ アーキテクチャ

```
┌────────────────────────────────────┐
│   各シグナルサービス               │
├────────────────────────────────────┤
│ YahooFinanceSignalService          │
│ TradingViewSignalService           │
│ InvestingSignalService             │
│ FinvizSignalService                │
│ MarketWatchSignalService           │
└────────────┬───────────────────────┘
             │ extends
    ┌────────▼───────────────────────┐
    │   BaseSignalService            │
    │   - Cache (5分)                │
    │   - Rate Limit (1-2秒)         │
    │   - Error Handling             │
    │   - Auto Disable/Recovery      │
    └────────┬───────────────────────┘
             │ uses
    ┌────────▼───────────────────────┐
    │   ScrapingHelper               │
    │   (TradingView, Investing等)   │
    └────────────────────────────────┘
```

---

## 🧪 テストスクリプト

**ファイル**: `scripts/test-signal-services.ts`

**実行方法**:

```bash
npm run test:signals
```

**テスト内容**:

1. 各サービスの個別テスト
2. キャッシュ機能のテスト
3. エラーハンドリングのテスト
4. サービス無効化/再開のテスト

**出力例**:

```
📊 === Yahoo Finance シグナルテスト ===
AAPL: {
  シグナル: 'BUY',
  確信度: '80%',
  理由: '上昇トレンド(+1.5%), 高出来高(5.2M)',
  ソース: 'yahoo_finance'
}

📈 === TradingView シグナルテスト ===
AAPL: {
  シグナル: 'BUY',
  確信度: '85%',
  理由: 'TradingView: Strong Buy, Buy',
  ソース: 'tradingview'
}
```

---

## 📊 シグナル取得フロー

```
シンボル入力（例: AAPL）
    ↓
キャッシュ確認
    ↓
キャッシュあり？
├─ YES → キャッシュから返却（高速）
└─ NO  → データ取得開始
         ↓
    レート制限チェック
         ↓
    データ取得（API/スクレイピング）
         ↓
    シグナル分析
         ↓
    結果をキャッシュに保存
         ↓
    シグナル返却
```

---

## ⚙️ 設定とカスタマイズ

### キャッシュTTL変更

```typescript
// デフォルト: 5分
const service = new YahooFinanceSignalService();

// カスタム: 10分
const service = new YahooFinanceSignalService(600);
```

### レート制限変更

```typescript
// デフォルト: 1秒
const service = new YahooFinanceSignalService(300, 1000);

// カスタム: 3秒
const service = new YahooFinanceSignalService(300, 3000);
```

### エラー時の動作

```typescript
// イベントリスナー
service.on('serviceDisabled', (name) => {
  console.log(`${name} が無効化されました`);
  // アラート送信など
});

service.on('serviceEnabled', (name) => {
  console.log(`${name} が再開されました`);
});

// 手動でリセット
service.reset();
```

---

## 🎯 各サービスの特徴

| サービス      | 取得方法       | レート制限 | 強み             | 弱み                 |
| ------------- | -------------- | ---------- | ---------------- | -------------------- |
| Yahoo Finance | API            | 1秒        | 高速・安定       | 分析が簡易的         |
| TradingView   | スクレイピング | 2秒        | 総合評価が優秀   | 遅い・構造変更リスク |
| Investing.com | スクレイピング | 2秒        | 複数時間軸       | 遅い                 |
| Finviz        | スクレイピング | 2秒        | アナリスト意見   | 米国株のみ           |
| MarketWatch   | スクレイピング | 2秒        | レーティング豊富 | 遅い                 |

---

## ⚠️ 注意事項

### スクレイピングのリスク

- サイトの構造変更に対応が必要
- アクセス制限される可能性
- レート制限を厳守

### エラー対策

- 3回連続エラーで自動無効化
- 24時間後に自動再開
- 他のサービスでカバー

### 法的事項

- 個人利用のみ
- 商用利用は各サイトの規約確認が必要
- 過度なアクセスは避ける

---

## 🚀 次のPhase

**Phase 2**: シグナル統合サービス

- 複数シグナルの集約
- 過半数判定ロジック
- 最適銘柄の選択

**実装予定ファイル**:

- `src/services/signal-aggregator-service.ts`
- `scripts/test-signal-aggregator.ts`

---

## 📈 期待される成果

- ✅ 5つのサイトから独立してシグナル取得
- ✅ キャッシュによる高速化
- ✅ エラーに強い設計
- ✅ 過半数判定の準備完了
- ✅ 次Phase（統合サービス）への橋渡し
