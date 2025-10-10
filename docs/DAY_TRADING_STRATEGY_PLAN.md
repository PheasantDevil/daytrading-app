# デイトレード戦略実装計画

## 📊 戦略概要

### 取引ルール

- **取引頻度**: 1日1回のデイトレード
- **購入タイミング**: 昼前（11:00-11:30）
- **売却タイミング**: 昼過ぎ（13:00-15:00）
- **売却条件**: 購入価格から+5%以上
- **判定基準**: 複数サイト（3-6サイト）の過半数で「上昇確率高」と判定

### 過半数判定ロジック

```
3サイト → 2/3以上（67%）= 2サイト以上が推奨
4サイト → 3/4以上（75%）= 3サイト以上が推奨
5サイト → 4/5以上（80%）= 4サイト以上が推奨
6サイト → 4/6以上（67%）= 4サイト以上が推奨
```

---

## 🎯 実装プラン

### Phase 1: 外部サイト統合（2-3週間）

#### 1.1 参考サイトの選定と分析

**推奨サイト候補:**

1. **Yahoo Finance（無料）** ✅ 既に実装済み
   - リアルタイム株価
   - アナリスト評価
   - トレンド分析

2. **TradingView（無料枠あり）**
   - テクニカル指標の総合評価
   - コミュニティの売買シグナル
   - AIによる予測スコア

3. **Investing.com（無料）**
   - アナリストの推奨
   - テクニカルサマリー
   - センチメント分析

4. **Finviz（無料）**
   - スクリーナー機能
   - テクニカルパターン検出
   - 出来高分析

5. **StockCharts（一部無料）**
   - テクニカル指標
   - チャートパターン
   - 相対強度

6. **MarketWatch（無料）**
   - アナリストレーティング
   - ニュースセンチメント
   - 機関投資家の動向

#### 1.2 データ取得戦略

各サイトからのデータ取得方法：

```typescript
// 新規ファイル: src/services/signal-aggregator-service.ts

export interface TradingSignal {
  source: string; // データソース名
  symbol: string; // 銘柄コード
  signal: 'BUY' | 'HOLD' | 'SELL';
  confidence: number; // 0-100 (確信度)
  reason: string; // 判定理由
  timestamp: Date;
}

export interface AggregatedSignal {
  symbol: string;
  buySignals: number; // 買いシグナル数
  holdSignals: number; // 保留シグナル数
  sellSignals: number; // 売りシグナル数
  totalSources: number; // 総ソース数
  buyPercentage: number; // 買い推奨率
  shouldBuy: boolean; // 購入すべきか（過半数判定）
  signals: TradingSignal[]; // 個別シグナル詳細
}
```

---

### Phase 2: シグナル収集サービス（2週間）

#### 2.1 各サイトからのデータ取得実装

```typescript
// src/services/external-signals/yahoo-finance-signal.ts
export class YahooFinanceSignalService {
  async getSignal(symbol: string): Promise<TradingSignal> {
    // Yahoo Financeからデータ取得
    // - アナリスト推奨（Buy/Hold/Sell）
    // - テクニカル指標（RSI, MACD等）
    // - 出来高トレンド
  }
}

// src/services/external-signals/tradingview-signal.ts
export class TradingViewSignalService {
  async getSignal(symbol: string): Promise<TradingSignal> {
    // TradingViewのテクニカルサマリー取得
    // APIまたはスクレイピング
  }
}

// src/services/external-signals/investing-signal.ts
export class InvestingSignalService {
  async getSignal(symbol: string): Promise<TradingSignal> {
    // Investing.comのテクニカル分析取得
  }
}

// ... 他のサイトも同様
```

#### 2.2 シグナル統合サービス

```typescript
// src/services/signal-aggregator-service.ts

export class SignalAggregatorService {
  private signalServices: SignalService[];

  constructor(services: SignalService[]) {
    this.signalServices = services;
  }

  async aggregateSignals(symbol: string): Promise<AggregatedSignal> {
    // 全サービスから並列にシグナル取得
    const signals = await Promise.all(
      this.signalServices.map((service) =>
        service.getSignal(symbol).catch((err) => null)
      )
    );

    // nullを除外
    const validSignals = signals.filter((s) => s !== null);

    // BUYシグナルをカウント
    const buySignals = validSignals.filter((s) => s.signal === 'BUY').length;
    const totalSources = validSignals.length;
    const buyPercentage = (buySignals / totalSources) * 100;

    // 過半数判定
    const requiredVotes = this.calculateRequiredVotes(totalSources);
    const shouldBuy = buySignals >= requiredVotes;

    return {
      symbol,
      buySignals,
      holdSignals: validSignals.filter((s) => s.signal === 'HOLD').length,
      sellSignals: validSignals.filter((s) => s.signal === 'SELL').length,
      totalSources,
      buyPercentage,
      shouldBuy,
      signals: validSignals,
    };
  }

  private calculateRequiredVotes(total: number): number {
    // 過半数の計算
    // 3 → 2, 4 → 3, 5 → 4, 6 → 4
    if (total <= 3) return Math.ceil(total * 0.67);
    if (total === 4) return 3;
    if (total === 5) return 4;
    return Math.ceil(total * 0.67);
  }
}
```

---

### Phase 3: デイトレードスケジューラー（1週間）

#### 3.1 時間ベース自動実行

```typescript
// src/trading/day-trading-scheduler.ts

export class DayTradingScheduler {
  private signalAggregator: SignalAggregatorService;
  private tradingService: TradingService;

  async initialize() {
    // 毎日のスケジュール設定

    // 11:00 - 購入判定開始
    cron.schedule('0 11 * * 1-5', async () => {
      await this.executeBuyPhase();
    });

    // 13:00 - 売却判定開始（+5%チェック）
    cron.schedule('0 13 * * 1-5', async () => {
      await this.executeSellPhase();
    });

    // 15:00 - 強制決済（市場クローズ前）
    cron.schedule('0 15 * * 1-5', async () => {
      await this.forceClosePositions();
    });
  }

  private async executeBuyPhase() {
    logger.info('🔍 購入フェーズ開始');

    // 1. 候補銘柄をスクリーニング
    const candidates = await this.screenCandidates();

    // 2. 各候補のシグナル集約
    const signalResults = [];
    for (const symbol of candidates) {
      const signal = await this.signalAggregator.aggregateSignals(symbol);
      if (signal.shouldBuy) {
        signalResults.push(signal);
      }
    }

    // 3. 最も確信度の高い銘柄を選択
    const bestCandidate = this.selectBestCandidate(signalResults);

    if (bestCandidate) {
      // 4. 購入実行
      await this.executeBuy(bestCandidate);
    }
  }

  private async executeSellPhase() {
    logger.info('💰 売却フェーズ開始');

    // 1. 現在のポジションを取得
    const positions = await this.tradingService.getPositions();

    for (const position of positions) {
      const currentPrice = await this.getCurrentPrice(position.symbol);
      const profitRate =
        (currentPrice - position.entryPrice) / position.entryPrice;

      // 2. +5%以上かチェック
      if (profitRate >= 0.05) {
        // 3. 売却シグナル確認
        const signal = await this.signalAggregator.aggregateSignals(
          position.symbol
        );

        // 過半数が「売り」または「保留」なら売却
        const shouldSell = signal.sellSignals >= signal.buySignals;

        if (shouldSell || profitRate >= 0.05) {
          await this.executeSell(position);
        }
      }
    }
  }

  private selectBestCandidate(
    signals: AggregatedSignal[]
  ): AggregatedSignal | null {
    if (signals.length === 0) return null;

    // 買いシグナル率が最も高いものを選択
    return signals.reduce((best, current) =>
      current.buyPercentage > best.buyPercentage ? current : best
    );
  }
}
```

---

### Phase 4: リスク管理強化（1週間）

#### 4.1 ストップロス・テイクプロフィット

```typescript
// src/trading/day-trading-risk-manager.ts

export class DayTradingRiskManager {
  private readonly MAX_LOSS_RATE = -0.03; // -3%でストップロス
  private readonly TARGET_PROFIT_RATE = 0.05; // +5%でテイクプロフィット

  async monitorPositions() {
    // 1分ごとに監視
    setInterval(async () => {
      const positions = await this.getActivePositions();

      for (const position of positions) {
        const currentPrice = await this.getCurrentPrice(position.symbol);
        const profitRate =
          (currentPrice - position.entryPrice) / position.entryPrice;

        // ストップロス判定
        if (profitRate <= this.MAX_LOSS_RATE) {
          logger.warn(
            `⚠️ ストップロス発動: ${position.symbol} (${profitRate * 100}%)`
          );
          await this.emergencySell(position);
        }

        // テイクプロフィット判定（+5%以上）
        if (profitRate >= this.TARGET_PROFIT_RATE) {
          logger.info(`✅ 目標達成: ${position.symbol} (${profitRate * 100}%)`);
          await this.executeSellWithSignalCheck(position);
        }
      }
    }, 60000); // 1分
  }

  private async executeSellWithSignalCheck(position: Position) {
    // シグナル確認後に売却
    const signal = await this.signalAggregator.aggregateSignals(
      position.symbol
    );

    // 売りシグナルが過半数、または+7%以上なら即売却
    if (signal.sellSignals >= signal.buySignals || profitRate >= 0.07) {
      await this.sell(position);
    }
  }
}
```

---

### Phase 5: 統合とテスト（1週間）

#### 5.1 エンドツーエンドテスト

```typescript
// scripts/test-day-trading-strategy.ts

async function testDayTradingStrategy() {
  // 1. シグナル収集テスト
  const aggregator = new SignalAggregatorService([
    new YahooFinanceSignalService(),
    new TradingViewSignalService(),
    new InvestingSignalService(),
    new FinvizSignalService(),
  ]);

  const signal = await aggregator.aggregateSignals('AAPL');
  console.log('集約シグナル:', signal);

  // 2. スケジューラーテスト（デモモード）
  const scheduler = new DayTradingScheduler();
  await scheduler.testRun(); // 実際の時間を待たずにテスト実行

  // 3. リスク管理テスト
  const riskManager = new DayTradingRiskManager();
  await riskManager.testStopLoss();
}
```

---

## 📋 実装フェーズ詳細

### 📅 タイムライン（合計6-8週間）

#### **Week 1-2: Phase 1 - 外部サイト統合準備**

- [ ] 参考サイトの調査・API確認
- [ ] スクレイピングまたはAPI実装方針決定
- [ ] データ取得ライブラリの選定
- [ ] 各サイトのレート制限・規約確認

**成果物:**

- サイト選定ドキュメント
- API/スクレイピング設計書

#### **Week 3-4: Phase 2 - シグナル収集実装**

- [ ] Yahoo Finance シグナルサービス
- [ ] TradingView シグナルサービス
- [ ] Investing.com シグナルサービス
- [ ] Finviz シグナルサービス
- [ ] シグナル統合サービス
- [ ] 過半数判定ロジック

**成果物:**

- `src/services/external-signals/*.ts`
- `src/services/signal-aggregator-service.ts`
- テストスクリプト

#### **Week 5: Phase 3 - デイトレードスケジューラー**

- [ ] 時間ベース実行ロジック
- [ ] 購入フェーズ実装
- [ ] 売却フェーズ実装（+5%判定）
- [ ] 強制決済ロジック

**成果物:**

- `src/trading/day-trading-scheduler.ts`
- スケジューラー設定

#### **Week 6: Phase 4 - リスク管理**

- [ ] ストップロス（-3%）
- [ ] テイクプロフィット（+5%）
- [ ] リアルタイム監視
- [ ] 緊急売却機能

**成果物:**

- `src/trading/day-trading-risk-manager.ts`
- リスク管理設定

#### **Week 7-8: Phase 5 - 統合とテスト**

- [ ] 統合テスト
- [ ] ペーパートレーディングで検証
- [ ] パフォーマンス測定
- [ ] ドキュメント作成

**成果物:**

- テスト結果レポート
- 運用ドキュメント

---

## 🛠️ 必要なツール・ライブラリ

### 新規追加が必要なもの

```json
{
  "dependencies": {
    // スクレイピング用
    "puppeteer": "^21.0.0", // ブラウザ自動化
    "cheerio": "^1.0.0-rc.12", // HTML解析
    "axios": "^1.11.0", // 既にあり

    // データ処理
    "lodash": "^4.17.21", // ユーティリティ

    // スケジューリング
    "node-cron": "^3.0.3", // 既にあり

    // レート制限
    "bottleneck": "^2.19.5", // APIレート制限管理

    // キャッシュ
    "node-cache": "^5.1.2" // インメモリキャッシュ
  }
}
```

---

## 📊 データフロー図

```
毎日 11:00
    ↓
[候補銘柄スクリーニング]
    ↓
[複数サイトからシグナル収集]
    ├─ Yahoo Finance → BUY/HOLD/SELL
    ├─ TradingView → BUY/HOLD/SELL
    ├─ Investing.com → BUY/HOLD/SELL
    └─ Finviz → BUY/HOLD/SELL
    ↓
[過半数判定]
    ↓
YES → [購入実行] → [ポジション保持]
NO  → [スキップ]


毎日 13:00-15:00 (1分ごと監視)
    ↓
[現在価格チェック]
    ↓
+5%以上？
    ↓
YES → [売却シグナル確認]
         ↓
      過半数が売り推奨？
         ↓
      YES → [売却実行]
      NO  → [継続保持]
NO  → [継続監視]

-3%以下？
    ↓
YES → [ストップロス実行]
```

---

## 🎯 設定ファイル例

```typescript
// config/day-trading-config.ts

export const dayTradingConfig = {
  // スケジュール
  schedule: {
    buyTime: '11:00', // 購入時刻
    sellCheckStart: '13:00', // 売却チェック開始
    forceClose: '15:00', // 強制決済時刻
  },

  // シグナルソース
  signalSources: [
    { name: 'yahoo', weight: 1, enabled: true },
    { name: 'tradingview', weight: 1, enabled: true },
    { name: 'investing', weight: 1, enabled: true },
    { name: 'finviz', weight: 1, enabled: true },
  ],

  // 過半数判定
  requiredVoteRatio: {
    3: 0.67, // 3サイト → 67%以上
    4: 0.75, // 4サイト → 75%以上
    5: 0.8, // 5サイト → 80%以上
    6: 0.67, // 6サイト → 67%以上
  },

  // リスク管理
  riskManagement: {
    stopLoss: -0.03, // -3%
    takeProfit: 0.05, // +5%
    maxPositionSize: 10000, // 最大1万ドル
    maxDailyTrades: 1, // 1日1取引
  },

  // スクリーニング
  screening: {
    minVolume: 1000000, // 最小出来高
    minPrice: 10, // 最小価格
    maxPrice: 500, // 最大価格
    excludeSectors: [], // 除外セクター
  },
};
```

---

## 💡 コマンド追加提案

```json
// package.json に追加
{
  "scripts": {
    "trade:day-start": "tsx scripts/day-trading-scheduler.ts",
    "trade:test-signals": "tsx scripts/test-signal-aggregator.ts",
    "trade:backtest-strategy": "tsx scripts/backtest-day-trading.ts"
  }
}
```

---

## ⚠️ 重要な注意事項

### 1. 法的・規約面

- 各サイトの利用規約を確認
- スクレイピングの許可確認
- APIのレート制限遵守

### 2. 技術的リスク

- サイトの構造変更に対応
- ネットワークエラーハンドリング
- データの信頼性検証

### 3. 取引リスク

- バックテストで十分検証
- ペーパートレーディングで実証
- 少額から開始

---

## 🚀 実装開始の手順

1. **Phase 1 から開始**: 外部サイト統合の基盤構築
2. **段階的実装**: 各Phaseごとにテスト・検証
3. **バックテスト**: 過去データで戦略検証
4. **ペーパートレーディング**: 仮想資金で実証
5. **本番運用**: 少額から開始

---

## 📈 期待される成果

### 短期的成果（1-2ヶ月）

- 複数サイトからのシグナル収集自動化
- 過半数判定による銘柄選定
- 自動売買システムの基盤完成

### 中期的成果（3-6ヶ月）

- 実績データの蓄積
- 戦略の最適化
- リスク管理の精緻化

### 長期的成果（6-12ヶ月）

- 安定した収益の実現
- 複数戦略の運用
- ポートフォリオの多様化
