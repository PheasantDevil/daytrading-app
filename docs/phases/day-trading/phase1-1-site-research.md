# Phase 1-1: 参考サイトの調査・API確認

## 📋 目的

複数の金融情報サイトから売買シグナルを取得するため、各サイトのAPI・データ取得方法を調査し、実装方針を決定する。

---

## 🔍 調査対象サイト

### 1. Yahoo Finance ✅

**優先度**: 高（既に実装済み）

**提供情報**:
- リアルタイム株価
- アナリスト推奨（Buy/Hold/Sell）
- テクニカル指標
- 出来高データ
- 企業情報

**データ取得方法**:
- ✅ 既存実装: `src/services/yahoo-finance-service.ts`
- API: yahoo-finance2 パッケージ（非公式）
- 無料、制限あり

**シグナル抽出方法**:
```typescript
// アナリスト推奨から判定
// - Strong Buy / Buy → BUY
// - Hold → HOLD
// - Sell / Strong Sell → SELL
```

**評価**:
- ✅ 実装済み
- ✅ 無料
- ⚠️ 非公式API（変更リスク）
- ⚠️ レート制限あり

---

### 2. TradingView

**優先度**: 高

**提供情報**:
- テクニカルサマリー（総合評価）
- コミュニティシグナル
- 移動平均線の評価
- オシレーター評価

**データ取得方法**:
- **方法A**: 公式APIなし → スクレイピング必要
- **方法B**: TradingView Webhookを利用
- **方法C**: サードパーティAPI（有料）

**URL例**:
```
https://www.tradingview.com/symbols/NASDAQ-AAPL/technicals/
```

**HTML構造**:
```html
<div class="speedometerSignal">
  <span class="speedometerSignal-indicator">Buy</span>
</div>
```

**シグナル抽出方法**:
```typescript
// Technical Summary から判定
// - Strong Buy / Buy → BUY
// - Neutral → HOLD
// - Sell / Strong Sell → SELL
```

**評価**:
- ✅ 信頼性が高い
- ⚠️ スクレイピング必要
- ⚠️ 構造変更リスク
- ✅ 無料

---

### 3. Investing.com

**優先度**: 高

**提供情報**:
- テクニカルサマリー
- アナリスト意見
- ピボットポイント
- 移動平均線

**データ取得方法**:
- 公式APIなし → スクレイピング必要
- Puppeteer または Cheerio で取得

**URL例**:
```
https://www.investing.com/equities/apple-computer-inc-technical
```

**HTML構造**:
```html
<span class="technicalSummary">
  Strong Buy
</span>
```

**シグナル抽出方法**:
```typescript
// Technical Summary から判定
// - Strong Buy / Buy → BUY
// - Neutral → HOLD  
// - Sell / Strong Sell → SELL
```

**評価**:
- ✅ 詳細な分析
- ⚠️ スクレイピング必要
- ✅ 無料
- ⚠️ ログイン必要な場合あり

---

### 4. Finviz

**優先度**: 中

**提供情報**:
- スクリーナーデータ
- テクニカルパターン
- アナリストレーティング
- インサイダー取引

**データ取得方法**:
- 公式APIなし → スクレイピング必要
- シンプルなHTML構造で取得しやすい

**URL例**:
```
https://finviz.com/quote.ashx?t=AAPL
```

**HTML構造**:
```html
<td class="snapshot-td2" align="left">
  <b>Analyst Recom</b>
  <span>1.80</span> <!-- 1.0=Strong Buy, 5.0=Sell -->
</td>
```

**シグナル抽出方法**:
```typescript
// Analyst Recommendation (1.0-5.0)
// 1.0-2.0 → BUY
// 2.0-3.0 → HOLD
// 3.0-5.0 → SELL
```

**評価**:
- ✅ データ取得しやすい
- ✅ 無料
- ⚠️ スクレイピング必要
- ✅ シンプルな構造

---

### 5. StockCharts

**優先度**: 低

**提供情報**:
- テクニカル指標
- チャートパターン
- 相対強度

**データ取得方法**:
- 一部有料
- スクレイピングは困難（Flashベース）

**評価**:
- ⚠️ 有料プランが必要
- ❌ スクレイピング困難
- 🔽 優先度低

---

### 6. MarketWatch

**優先度**: 中

**提供情報**:
- アナリストレーティング
- 目標株価
- ニュースセンチメント

**データ取得方法**:
- 公式APIなし → スクレイピング必要
- Puppeteerで取得

**URL例**:
```
https://www.marketwatch.com/investing/stock/aapl/analystestimates
```

**シグナル抽出方法**:
```typescript
// Analyst Ratings (Buy/Hold/Sell の数から判定)
// Buy > Sell → BUY
// Buy = Sell → HOLD
// Buy < Sell → SELL
```

**評価**:
- ✅ アナリスト意見が豊富
- ⚠️ スクレイピング必要
- ✅ 無料

---

## 🎯 実装優先順位

### Phase 1-1-A: 即座に実装可能（既存技術）

1. **Yahoo Finance** ✅
   - 既に実装済み
   - 改善: シグナル変換ロジック追加

### Phase 1-1-B: スクレイピング基盤構築後

2. **TradingView** 
   - 優先度: 高
   - 実装難易度: 中

3. **Investing.com**
   - 優先度: 高
   - 実装難易度: 中

4. **Finviz**
   - 優先度: 中
   - 実装難易度: 低（シンプル）

### Phase 1-1-C: 余裕があれば

5. **MarketWatch**
   - 優先度: 中
   - 実装難易度: 中

6. **StockCharts**
   - 優先度: 低
   - 実装難易度: 高（有料）

---

## 🛠️ 技術選定

### スクレイピングライブラリ

**選択肢:**

1. **Puppeteer** ✅ 推奨
   ```bash
   npm install puppeteer
   ```
   - ✅ JavaScriptレンダリング対応
   - ✅ 複雑なサイトに対応
   - ⚠️ メモリ消費大

2. **Cheerio**
   ```bash
   npm install cheerio
   ```
   - ✅ 高速
   - ✅ 軽量
   - ❌ JavaScript未対応

3. **Playwright**
   ```bash
   npm install playwright
   ```
   - ✅ Puppeteerの後継
   - ✅ 複数ブラウザ対応
   - ⚠️ サイズが大きい

**結論**: Puppeteer を採用
- TradingView、Investing.comはJavaScript必須
- 実績が豊富
- ドキュメントが充実

### レート制限対策

**ライブラリ**: Bottleneck
```bash
npm install bottleneck
```

**実装例**:
```typescript
const limiter = new Bottleneck({
  minTime: 1000,  // 1秒に1リクエスト
  maxConcurrent: 1
});

const getSignal = limiter.wrap(async (symbol: string) => {
  // データ取得
});
```

---

## 📊 API/スクレイピング設計

### 共通インターフェース

```typescript
// src/services/external-signals/base-signal-service.ts

export interface SignalService {
  name: string;
  getSignal(symbol: string): Promise<TradingSignal>;
  isAvailable(): Promise<boolean>;
}

export interface TradingSignal {
  source: string;
  symbol: string;
  signal: 'BUY' | 'HOLD' | 'SELL';
  confidence: number;  // 0-100
  reason: string;
  timestamp: Date;
}
```

### 各サイト実装

```typescript
// src/services/external-signals/tradingview-signal.ts

export class TradingViewSignalService implements SignalService {
  name = 'tradingview';
  
  async getSignal(symbol: string): Promise<TradingSignal> {
    const url = `https://www.tradingview.com/symbols/NASDAQ-${symbol}/technicals/`;
    const page = await this.browser.newPage();
    await page.goto(url);
    
    // セレクタで判定を取得
    const signalText = await page.$eval(
      '.speedometerSignal-indicator',
      el => el.textContent
    );
    
    return {
      source: 'tradingview',
      symbol,
      signal: this.convertToSignal(signalText),
      confidence: this.calculateConfidence(signalText),
      reason: `TradingView Technical Summary: ${signalText}`,
      timestamp: new Date(),
    };
  }
  
  private convertToSignal(text: string): 'BUY' | 'HOLD' | 'SELL' {
    if (text.includes('Buy')) return 'BUY';
    if (text.includes('Sell')) return 'SELL';
    return 'HOLD';
  }
}
```

---

## 🔒 規約・制限事項

### 利用規約確認

各サイトのrobots.txtと利用規約を確認：

1. **TradingView**
   - robots.txt: https://www.tradingview.com/robots.txt
   - スクレイピング: グレーゾーン
   - 推奨: 控えめなアクセス頻度

2. **Investing.com**
   - robots.txt: https://www.investing.com/robots.txt
   - スクレイピング: 明示的な禁止なし
   - 推奨: レート制限遵守

3. **Finviz**
   - robots.txt: https://finviz.com/robots.txt
   - スクレイピング: 商用利用は禁止
   - 推奨: 個人利用のみ

### 推奨対策

1. **User-Agent設定**
   ```typescript
   const userAgent = 'DayTradingApp/1.0 (Personal Use)';
   ```

2. **レート制限**
   - 各サイト: 1秒に1リクエスト
   - 並列実行: 最大3サイト同時

3. **キャッシュ**
   - 同一銘柄: 5分間キャッシュ
   - エラー時: 1分間リトライ禁止

4. **エラーハンドリング**
   - 3回連続エラー → サービス無効化
   - 24時間後に自動再開

---

## 📝 実装チェックリスト

### Phase 1-1-A: Yahoo Finance改善
- [x] 既存サービス確認
- [ ] シグナル変換ロジック追加
- [ ] テストケース作成

### Phase 1-1-B: スクレイピング基盤
- [ ] Puppeteer インストール
- [ ] 基底クラス作成
- [ ] レート制限実装
- [ ] エラーハンドリング

### Phase 1-1-C: 各サイト実装
- [ ] TradingView シグナルサービス
- [ ] Investing.com シグナルサービス
- [ ] Finviz シグナルサービス
- [ ] MarketWatch シグナルサービス（オプション）

### Phase 1-1-D: テスト
- [ ] 単体テスト
- [ ] 統合テスト
- [ ] レート制限テスト
- [ ] エラーケーステスト

---

## 🚀 次のステップ

1. **Phase 1-2へ**: スクレイピング基盤構築
2. **Phase 1-3へ**: シグナルインターフェース定義
3. **Phase 2へ**: シグナル統合サービス実装

---

## 📊 期待される成果

- 4-6サイトからのシグナル取得機能
- 統一されたインターフェース
- エラーに強い設計
- 規約遵守の実装

