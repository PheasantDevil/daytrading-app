# ハイブリッド市場データシステムガイド

## 概要

**Yahoo Finance（無料） + Interactive Brokers（取引用）**のハイブリッドシステムにより、コストを最小化しながら正確な取引を実現します。

## システムアーキテクチャ

```
┌─────────────────────────────────────────┐
│   ハイブリッド市場データシステム         │
└─────────────────────────────────────────┘
              │
       ┌──────┴──────┐
       │             │
   ┌───▼───┐    ┌───▼───┐
   │Yahoo  │    │  IB   │
   │Finance│    │ API   │
   └───┬───┘    └───┬───┘
       │             │
   ┌───▼─────────────▼───┐
   │   用途別データソース   │
   ├────────────────────┤
   │ 銘柄探索: Yahoo      │
   │ 履歴分析: Yahoo      │
   │ スクリーニング: Yahoo │
   │ リアルタイム: 両方    │
   │ 取引執行: IB         │
   └────────────────────┘
```

## 用途別の使い分け

### Yahoo Finance API を使用する場面

#### ✅ 銘柄スクリーニング

```typescript
// 無料で多数の銘柄を検索
const candidates = await hybridService.screenStocks({
  minPrice: 50,
  maxPrice: 200,
  minVolume: 5000000,
});
```

**理由:**

- 無料で制限なし
- 多数の銘柄を一括検索可能
- IBだと課金対象になる

#### ✅ 履歴データ分析

```typescript
// 過去20年分のデータを無料取得
const historical = await hybridService.getHistoricalData(
  'AAPL',
  new Date('2020-01-01'),
  new Date()
);
```

**理由:**

- 完全無料
- 長期間のデータが取得可能
- バックテストに最適

#### ✅ 企業情報・ファンダメンタル分析

```typescript
// 企業情報を無料取得
const companyInfo = await hybridService.getCompanyInfo('AAPL');
const trending = await hybridService.getTrendingStocks();
```

**理由:**

- 完全無料
- 豊富な企業情報
- トレンド分析に有用

### Interactive Brokers API を使用する場面

#### ✅ 実取引の執行

```typescript
// 正確な価格で取引執行
await ibIntegration.placeOrder({
  symbol: 'AAPL',
  side: 'buy',
  quantity: 100,
  type: 'market',
});
```

**理由:**

- 唯一の選択肢
- 正確な約定価格
- リアルタイム執行

#### ✅ リアルタイム板情報

```typescript
// 買気配・売気配を取得
const marketData = await ibIntegration.getMarketData('AAPL');
console.log(marketData.bid, marketData.ask);
```

**理由:**

- 板情報が必要
- Yahoo Financeにはない情報
- デイトレードに必須

## 推奨ワークフロー

### Phase 1: 開発・テスト（現在）

```typescript
// Yahoo Finance中心で開発
const config = {
  mode: 'development',
  dataSource: {
    screening: 'yahoo', // 無料
    historical: 'yahoo', // 無料
    realtime: 'yahoo', // 無料
    trading: 'ib', // モックAPI
  },
};
```

**コスト: $0/月**

### Phase 2: 本格運用準備

```typescript
// IBのペーパートレーディングで検証
const config = {
  mode: 'staging',
  dataSource: {
    screening: 'yahoo', // 無料（引き続き）
    historical: 'yahoo', // 無料（引き続き）
    realtime: 'ib', // IB実API使用開始
    trading: 'ib', // IB実API
  },
};
```

**コスト: $0-10/月**（市場データ料金、取引すれば無料）

### Phase 3: 本格運用

```typescript
// 本番環境
const config = {
  mode: 'production',
  dataSource: {
    screening: 'yahoo', // 無料（引き続き）
    historical: 'yahoo', // 無料（引き続き）
    realtime: 'ib', // IB実API
    trading: 'ib', // IB実API
  },
};
```

**コスト: $0-10/月**（月間取引手数料$30以上で市場データ無料）

## 実装例

### 基本的な使用方法

```typescript
import { HybridMarketDataService } from './services/hybrid-market-data-service';
import { InteractiveBrokersIntegration } from './brokers/interactive-brokers-integration';

// 初期化
const ibIntegration = new InteractiveBrokersIntegration(config);
await ibIntegration.connect();

const hybridService = new HybridMarketDataService(
  {
    mode: 'development',
    dataSource: {
      screening: 'yahoo',
      historical: 'yahoo',
      realtime: 'yahoo',
      trading: 'ib',
    },
    yahoo: { enabled: true, cacheTTL: 60000 },
    ib: { enabled: true, useRealAPI: false },
  },
  ibIntegration
);

await hybridService.initialize();

// 使用例
// 1. Yahoo Financeで候補を探す
const candidates = await hybridService.screenStocks({
  minPrice: 50,
  maxPrice: 200,
  minVolume: 5000000,
});

// 2. Yahoo Financeで詳細分析
for (const symbol of candidates) {
  const quote = await hybridService.getMarketData(symbol);
  const historical = await hybridService.getHistoricalData(symbol, startDate);
  // 分析ロジック...
}

// 3. Interactive Brokersで取引
await ibIntegration.placeOrder({
  symbol: bestSymbol,
  side: 'buy',
  quantity: 100,
  type: 'market',
});
```

## コスト比較

### Yahoo Finance のみ

- **月額コスト**: $0
- **制限**: リアルタイム性低、取引不可
- **用途**: 分析のみ

### Interactive Brokers のみ

- **月額コスト**: $10-30
- **制限**: スクリーニングで課金
- **用途**: 全て可能だがコスト高

### ハイブリッド（推奨）

- **月額コスト**: $0-10（取引すれば$0）
- **制限**: なし
- **用途**: 分析は無料、取引は正確

## メリット

### コスト削減

- ✅ Yahoo Financeで分析は無料
- ✅ IBは取引時のみ使用
- ✅ 月間取引すればIB市場データも無料

### 精度向上

- ✅ Yahoo Financeで銘柄探索（多数の銘柄を無料で）
- ✅ IBで正確な取引執行（リアルタイム板情報）

### 柔軟性

- ✅ データソースを用途別に切り替え可能
- ✅ 開発時はYahoo、本番時はIBに簡単切り替え
- ✅ どちらかがダウンしても継続可能

## 注意事項

### Yahoo Finance

- **遅延**: 15-20分遅延の可能性
- **非公式**: APIが突然変更される可能性
- **制限**: 高頻度リクエストは避ける

### Interactive Brokers

- **接続必須**: TWS/IB Gateway起動が必要（本番時）
- **市場データ料金**: 取引しない月は課金の可能性
- **複雑性**: 設定が複雑

## トラブルシューティング

### Yahoo Financeエラー

```
エラー: "Too many requests"
→ 解決策: リクエスト頻度を下げる、キャッシュTTLを延ばす
```

### IBエラー

```
エラー: "Market data not subscribed"
→ 解決策: 市場データをサブスクライブ、またはYahooに切り替え
```

## まとめ

ハイブリッドシステムにより：

- 💰 **コスト最小**: Yahoo Financeで分析は無料
- 🎯 **精度最大**: IBで正確な取引執行
- 🚀 **最適なバランス**: 両方の長所を活用

**開発時はYahoo Finance中心、本番時はIB中心に自動切り替え可能！**
