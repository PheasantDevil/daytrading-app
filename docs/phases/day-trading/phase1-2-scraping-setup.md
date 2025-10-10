# Phase 1-2: スクレイピング基盤の構築

## 📋 目的

複数の金融情報サイトから安全かつ効率的にデータを取得するため、共通のスクレイピング基盤を構築する。

---

## ✅ 実装完了内容

### 1. 必要なパッケージの追加

```json
{
  "dependencies": {
    "puppeteer": "^21.11.0", // ブラウザ自動化
    "cheerio": "^1.0.0-rc.12", // HTML解析
    "bottleneck": "^2.19.5", // レート制限
    "node-cache": "^5.1.2", // キャッシュ
    "lodash": "^4.17.21" // ユーティリティ
  },
  "devDependencies": {
    "@types/lodash": "^4.17.13"
  }
}
```

### 2. 基底クラス: BaseSignalService

**ファイル**: `src/services/external-signals/base-signal-service.ts`

**機能**:

- ✅ シグナル取得の共通インターフェース
- ✅ キャッシュ機能（デフォルト5分）
- ✅ レート制限（デフォルト1秒/1リクエスト）
- ✅ エラーハンドリング
- ✅ 自動サービス無効化（3回連続エラー）
- ✅ 24時間後の自動再開

**インターフェース**:

```typescript
export interface TradingSignal {
  source: string; // データソース名
  symbol: string; // 銘柄コード
  signal: 'BUY' | 'HOLD' | 'SELL';
  confidence: number; // 0-100 (確信度)
  reason: string; // 判定理由
  timestamp: Date; // 取得日時
}

export interface ISignalService {
  name: string;
  getSignal(symbol: string): Promise<TradingSignal>;
  isAvailable(): Promise<boolean>;
}
```

**主要メソッド**:

- `getSignal(symbol)`: シグナル取得（キャッシュ・レート制限付き）
- `fetchSignal(symbol)`: 実際の取得処理（サブクラスで実装）
- `isAvailable()`: サービス可用性確認
- `handleError(error)`: エラーハンドリング
- `clearCache()`: キャッシュクリア
- `reset()`: サービスリセット

### 3. スクレイピングヘルパー: ScrapingHelper

**ファイル**: `src/services/external-signals/scraping-helper.ts`

**機能**:

- ✅ Puppeteerブラウザのシングルトン管理
- ✅ User-Agent自動設定
- ✅ ビューポート設定
- ✅ タイムアウト制御
- ✅ ページクローズの自動管理
- ✅ プロセス終了時の自動クリーンアップ

**主要メソッド**:

```typescript
// ブラウザインスタンス取得
static async getBrowser(): Promise<Browser>

// 新しいページを開く
static async newPage(): Promise<Page>

// URLからHTMLを取得
static async fetchHTML(url: string, timeout?: number): Promise<string>

// セレクタでテキストを取得
static async getTextBySelector(url, selector, timeout?): Promise<string | null>

// 複数セレクタでテキストを取得
static async getTextsBySelector(url, selector, timeout?): Promise<string[]>

// カスタム評価関数を実行
static async evaluate<T>(url, evaluateFn, timeout?): Promise<T | null>

// スクリーンショット（デバッグ用）
static async screenshot(url, path, timeout?): Promise<void>

// ブラウザクローズ
static async close(): Promise<void>
```

**User-Agent**:

```
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DayTradingApp/1.0
```

---

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────┐
│  SignalAggregatorService            │
│  （Phase 2で実装）                  │
└────────────┬────────────────────────┘
             │
    ┌────────┼────────┬────────┐
    │        │        │        │
┌───▼───┐ ┌─▼────┐ ┌─▼────┐ ┌─▼────┐
│Yahoo  │ │Trading│ │Invest│ │Finviz│
│Signal │ │View   │ │.com  │ │Signal│
└───┬───┘ └──┬────┘ └──┬───┘ └──┬───┘
    │        │          │        │
    └────────┼──────────┼────────┘
             │          │
    ┌────────▼──────────▼────────┐
    │  BaseSignalService         │
    │  - Cache (5分)             │
    │  - Rate Limit (1秒)        │
    │  - Error Handling          │
    └────────┬───────────────────┘
             │
    ┌────────▼───────────────────┐
    │  ScrapingHelper            │
    │  - Puppeteer管理           │
    │  - User-Agent設定          │
    │  - Timeout制御             │
    └────────────────────────────┘
```

---

## 🔧 使用例

### 基本的な実装例

```typescript
// src/services/external-signals/example-signal.ts

import { BaseSignalService, TradingSignal } from './base-signal-service';
import { ScrapingHelper } from './scraping-helper';

export class ExampleSignalService extends BaseSignalService {
  name = 'example';

  protected async fetchSignal(symbol: string): Promise<TradingSignal> {
    const url = `https://example.com/stock/${symbol}`;

    // 方法1: シンプルなテキスト取得
    const signalText = await ScrapingHelper.getTextBySelector(
      url,
      '.signal-indicator'
    );

    // 方法2: カスタム評価
    const data = await ScrapingHelper.evaluate(url, async (page) => {
      const signal = await page.$eval('.signal', (el) => el.textContent);
      const confidence = await page.$eval(
        '.confidence',
        (el) => el.textContent
      );
      return { signal, confidence };
    });

    return {
      source: this.name,
      symbol,
      signal: this.convertToSignal(signalText),
      confidence: this.calculateConfidence(signalText),
      reason: `Example signal: ${signalText}`,
      timestamp: new Date(),
    };
  }

  private convertToSignal(text: string | null): 'BUY' | 'HOLD' | 'SELL' {
    if (!text) return 'HOLD';
    if (text.includes('Buy')) return 'BUY';
    if (text.includes('Sell')) return 'SELL';
    return 'HOLD';
  }

  private calculateConfidence(text: string | null): number {
    if (!text) return 50;
    if (text.includes('Strong')) return 90;
    if (text.includes('Weak')) return 60;
    return 75;
  }
}
```

### 使用方法

```typescript
const exampleService = new ExampleSignalService();

// シグナル取得（キャッシュ・レート制限自動適用）
const signal = await exampleService.getSignal('AAPL');
console.log(signal);

// サービス可用性確認
const isAvailable = await exampleService.isAvailable();

// キャッシュクリア
exampleService.clearCache();

// サービスリセット
exampleService.reset();
```

---

## 🛡️ エラーハンドリング

### 自動エラー管理

```typescript
// エラー発生
try {
  const signal = await service.getSignal('AAPL');
} catch (error) {
  // エラーカウント +1
  // 3回連続エラー → サービス無効化
  // 24時間後に自動再開
}

// イベントリスナー
service.on('serviceDisabled', (name) => {
  console.log(`${name} が無効化されました`);
});

service.on('serviceEnabled', (name) => {
  console.log(`${name} が再開されました`);
});
```

### 手動リセット

```typescript
// エラーカウントリセット
service.reset();

// 即座に再開
service.isDisabled = false;
service.errorCount = 0;
```

---

## 📊 パフォーマンス最適化

### キャッシュ戦略

- **デフォルトTTL**: 5分（300秒）
- **カスタマイズ可能**:
  ```typescript
  // 10分キャッシュ
  const service = new ExampleSignalService(600);
  ```

### レート制限

- **デフォルト**: 1秒に1リクエスト
- **カスタマイズ可能**:
  ```typescript
  // 2秒に1リクエスト
  const service = new ExampleSignalService(300, 2000);
  ```

### メモリ管理

- ブラウザはシングルトン（1プロセス1インスタンス）
- ページは使用後自動クローズ
- プロセス終了時に自動クリーンアップ

---

## 🧪 テスト

### ユニットテスト例

```typescript
// tests/scraping-helper.test.ts

describe('ScrapingHelper', () => {
  afterAll(async () => {
    await ScrapingHelper.close();
  });

  test('fetchHTML should return HTML content', async () => {
    const html = await ScrapingHelper.fetchHTML('https://example.com');
    expect(html).toContain('<html');
  });

  test('getTextBySelector should return text', async () => {
    const text = await ScrapingHelper.getTextBySelector(
      'https://example.com',
      'h1'
    );
    expect(text).toBeTruthy();
  });
});
```

### 統合テスト例

```typescript
// tests/signal-service.test.ts

describe('ExampleSignalService', () => {
  let service: ExampleSignalService;

  beforeEach(() => {
    service = new ExampleSignalService();
  });

  test('getSignal should return valid signal', async () => {
    const signal = await service.getSignal('AAPL');
    expect(signal.source).toBe('example');
    expect(signal.symbol).toBe('AAPL');
    expect(['BUY', 'HOLD', 'SELL']).toContain(signal.signal);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(100);
  });

  test('cache should work', async () => {
    const signal1 = await service.getSignal('AAPL');
    const signal2 = await service.getSignal('AAPL');
    expect(signal1.timestamp).toEqual(signal2.timestamp);
  });

  test('error handling should disable service after 3 errors', async () => {
    // Simulate 3 errors
    for (let i = 0; i < 3; i++) {
      try {
        await service.getSignal('INVALID');
      } catch (e) {}
    }
    expect(service.isDisabled).toBe(true);
  });
});
```

---

## 📝 実装チェックリスト

### 基盤構築

- [x] Puppeteerインストール
- [x] BaseSignalService作成
- [x] ScrapingHelper作成
- [x] エラーハンドリング実装
- [x] キャッシュ機能実装
- [x] レート制限実装

### ドキュメント

- [x] 使用例の作成
- [x] テストケースの作成
- [x] アーキテクチャ図の作成

### 次のステップ

- [ ] 各サイトの具体的な実装（Phase1-3）
- [ ] シグナル統合サービス（Phase2）
- [ ] エンドツーエンドテスト

---

## 🚀 次のPhase

**Phase 1-3**: シグナルインターフェース定義

- 各サイトの具体的な実装
- Yahoo Finance改善
- TradingView実装
- Investing.com実装
- Finviz実装

---

## 💡 ベストプラクティス

### 1. レート制限を遵守

```typescript
// 各サイトごとに適切なレート制限を設定
const yahoo = new YahooSignalService(300, 1000); // 1秒
const tradingView = new TradingViewSignalService(300, 2000); // 2秒
```

### 2. エラー時の代替手段

```typescript
// 複数サービスから取得
const services = [yahoo, tradingView, investing];
for (const service of services) {
  try {
    const signal = await service.getSignal('AAPL');
    return signal;
  } catch (e) {
    continue; // 次のサービスを試す
  }
}
```

### 3. ログ監視

```typescript
// イベントリスナーでログ監視
service.on('signalFetched', (signal) => {
  logger.info('Signal fetched:', signal);
});

service.on('serviceDisabled', (name) => {
  logger.error(`Service disabled: ${name}`);
  // アラート送信など
});
```

---

## 📈 期待される成果

- ✅ 再利用可能なスクレイピング基盤
- ✅ エラーに強い設計
- ✅ キャッシュによる高速化
- ✅ レート制限による安全性
- ✅ 自動復旧機能
- ✅ メモリ効率の良い実装
