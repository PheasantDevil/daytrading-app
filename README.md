# デイトレード用Webアプリケーション

**世界中どこからでも、世界中の市場で取引可能な自動売買システム**

> ⚠️ **重要**: このシステムは仮想取引（練習用）と本番取引の2つのモードがあります。
>
> - 🟢 **初めての方**: `practice:*` コマンドから開始してください（リスクなし）
> - 🔴 **本番取引**: `production:*` コマンドは実際の資金を使用します（要注意）

---

## 🎯 クイックスタート（初心者向け）

### まず試してみる（5分で開始）

```bash
# 1. リポジトリのクローン
git clone https://github.com/PheasantDevil/daytrading-app.git
cd daytrading-app

# 2. 依存関係のインストール
npm install

# 3. 仮想取引を試す（安全・無料）
npm run practice:start
```

**これだけで仮想資金$100,000での取引シミュレーションが開始されます！**

---

## 📚 利用可能なコマンド一覧

### 🟢 仮想取引（練習用）- 初心者向け・安全

| コマンド                  | 説明                                  | リスク | おすすめ度 |
| ------------------------- | ------------------------------------- | ------ | ---------- |
| `npm run practice:start`  | 仮想取引を開始（初期資金$100,000）    | なし   | ⭐⭐⭐⭐⭐ |
| `npm run practice:hybrid` | Yahoo + IB ハイブリッドシステムテスト | なし   | ⭐⭐⭐⭐   |

**特徴:**

- ✅ 実際の資金は一切使用しない
- ✅ リアルタイム価格変動シミュレーション
- ✅ 損益計算、取引統計を確認可能
- ✅ 何度でもやり直し可能

**実行結果例:**

```
初期資金: $100,000
取引例: AAPL 100株購入 → 50株売却
最終結果: 損益、勝率、ドローダウンなどを表示
```

---

### 🔴 本番取引用 - 上級者向け（注意）

| コマンド                    | 説明                        | リスク | 注意事項      |
| --------------------------- | --------------------------- | ------ | ------------- |
| `npm run production:setup`  | Interactive Brokers接続設定 | 低     | 初回のみ実行  |
| `npm run production:test`   | 接続テスト                  | 低     | 設定確認用    |
| `npm run production:deploy` | 本番環境へデプロイ          | **高** | ⚠️ 慎重に実行 |

**⚠️ 警告:**

- 実際の資金を使用します
- Interactive Brokers口座開設が必要
- 十分に練習してから使用してください
- 損失のリスクがあります

---

### 🧪 開発・テスト用

| コマンド               | 説明               | 用途               |
| ---------------------- | ------------------ | ------------------ |
| `npm run dev`          | 開発サーバー起動   | フロントエンド開発 |
| `npm run build`        | 本番ビルド         | デプロイ前         |
| `npm run lint`         | コードチェック     | コード品質確認     |
| `npm run format`       | コード整形         | コード整形         |
| `npm run test:trading` | 自動売買機能テスト | 機能確認           |
| `npm run test:phases`  | 全フェーズテスト   | 全機能確認         |

---

### 🐳 Docker関連

| コマンド               | 説明           | 用途         |
| ---------------------- | -------------- | ------------ |
| `npm run docker:dev`   | 開発環境起動   | ローカル開発 |
| `npm run docker:build` | イメージビルド | コンテナ作成 |
| `npm run docker:up`    | コンテナ起動   | 環境起動     |
| `npm run docker:down`  | コンテナ停止   | 環境停止     |

---

## 🎓 使い方ガイド

### レベル1: 初心者（まずはここから！）

**目的:** システムの動作を理解する

```bash
# Step 1: 仮想取引を試す
npm run practice:start

# 結果:
# - 仮想資金$100,000でスタート
# - AAPL, GOOGL, MSFTを自動売買
# - リアルタイム損益を確認
# - 取引統計を表示
```

**何が起こる？**

- ✅ 架空の資金で取引シミュレーション
- ✅ リアルタイムで価格が変動
- ✅ 自動で注文が執行される
- ✅ 損益がリアルタイムで計算される
- ❌ 実際のお金は一切使わない

### レベル2: 中級者（慣れてきたら）

**目的:** ハイブリッドシステムを理解する

```bash
# Step 2: ハイブリッドシステムを試す
npm run practice:hybrid

# 結果:
# - Yahoo Financeで銘柄探索（無料）
# - 企業情報・履歴データ取得（無料）
# - Interactive Brokersで取引シミュレーション
# - コスト最小・精度最大を体験
```

**何が起こる？**

- ✅ Yahoo Financeで銘柄をスクリーニング
- ✅ 履歴データで分析
- ✅ 企業情報を取得
- ✅ IBで模擬取引を実行
- ❌ 実際のお金は一切使わない

### レベル3: 上級者（十分な練習後）

**目的:** 本番環境への移行準備

```bash
# Step 3-1: Interactive Brokers口座開設
# 公式サイト: https://www.interactivebrokers.co.jp/
# 審査期間: 1-3営業日

# Step 3-2: ペーパートレーディングアカウント申請
# （仮想資金$1,000,000で本番環境をテスト）

# Step 3-3: TWS/IB Gatewayをインストール
# （取引プラットフォーム）

# Step 3-4: 接続設定
npm run production:setup

# Step 3-5: 接続テスト
npm run production:test

# Step 3-6: 本番運用開始（⚠️ 慎重に）
npm run production:deploy
```

---

## 🆚 仮想取引 vs 本番取引

### 🟢 仮想取引（練習用）

| 項目           | 詳細                           |
| -------------- | ------------------------------ |
| **資金**       | 架空の$100,000                 |
| **リスク**     | なし（ゼロ）                   |
| **コスト**     | 無料                           |
| **データ**     | シミュレーション               |
| **約定**       | 即座に執行                     |
| **用途**       | 学習、戦略テスト、システム確認 |
| **おすすめ度** | ⭐⭐⭐⭐⭐                     |

**コマンド:**

```bash
npm run practice:start    # 基本的な仮想取引
npm run practice:hybrid   # ハイブリッドシステム
```

### 🔴 本番取引（実資金）

| 項目           | 詳細                       |
| -------------- | -------------------------- |
| **資金**       | 実際のお金                 |
| **リスク**     | **高い（損失の可能性）**   |
| **コスト**     | 取引手数料、市場データ料金 |
| **データ**     | リアルタイム市場データ     |
| **約定**       | 実際の市場で執行           |
| **用途**       | 実際の投資・運用           |
| **おすすめ度** | ⚠️ 十分な練習後のみ        |

**コマンド:**

```bash
npm run production:setup    # 初回設定のみ
npm run production:test     # 接続確認
npm run production:deploy   # ⚠️ 本番デプロイ（慎重に）
```

---

## ⚠️ 重要な注意事項

### 絶対に守ること

1. **🟢 まず練習**: 必ず `practice:*` コマンドから開始
2. **📚 十分な学習**: システムを理解してから本番へ
3. **💰 少額から開始**: 本番は少額からスタート
4. **🛡️ リスク管理**: ストップロス・テイクプロフィットを設定
5. **📊 継続的監視**: 自動売買でも定期的に確認

### やってはいけないこと

1. **❌ いきなり本番**: 練習なしで本番取引
2. **❌ 大金を投入**: 最初から大きな金額
3. **❌ 放置**: 自動売買を無監視で放置
4. **❌ 理解せず実行**: システムを理解せずに使用
5. **❌ production:deploy を安易に実行**: 本番デプロイは慎重に

---

## 🛠️ セットアップ（初回のみ）

```bash
# リポジトリのクローン
git clone https://github.com/PheasantDevil/daytrading-app.git
cd daytrading-app

# 依存関係のインストール
npm install

# 環境変数の設定
cp env.example .env.local
# .env.localを編集（必要に応じて）

# データベースとRedisの起動（オプション）
docker-compose up -d
```

---

## 📖 詳細ドキュメント

### 初心者向け

- [ハイブリッドシステムガイド](./docs/setup-guides/hybrid-system-guide.md) - Yahoo + IB の使い分け
- [Interactive Brokers設定ガイド](./docs/setup-guides/interactive-brokers-setup-guide.md) - 本番環境設定

### 開発者向け

- [要件定義書](./docs/daytrading-app-requirements.md)
- [開発ロードマップ](./docs/daytrading-app-roadmap.md)
- [ドキュメント一覧](./docs/README.md)

### Phase別実装記録

- [Phase1-7 実装計画書](./docs/phases/implementation-plans/)
- [Phase1-7 完了レポート](./docs/phases/completion-reports/)

---

## 🌟 主要機能

### 仮想取引機能

- ✅ **ペーパートレーディング**: 仮想資金$100,000
- ✅ **リアルタイム価格変動**: 1秒ごとに更新
- ✅ **自動約定処理**: 成行・指値注文対応
- ✅ **損益計算**: 未実現・実現損益の自動計算
- ✅ **取引統計**: 勝率、ドローダウン、シャープレシオ

### ハイブリッドシステム

- ✅ **Yahoo Finance**: 無料で銘柄探索・分析
- ✅ **Interactive Brokers**: 正確な取引執行
- ✅ **自動切り替え**: 用途別に最適なAPIを使用
- ✅ **コスト最小**: 開発中は完全無料

### AI/ML機能

- ✅ **LSTM予測**: ディープラーニングによる価格予測
- ✅ **テクニカル分析**: 複数指標の自動計算
- ✅ **リスク管理**: 自動ストップロス・テイクプロフィット
- ✅ **オンライン学習**: リアルタイムモデル更新

### グローバル対応

- ✅ **世界17カ国**: 50以上の取引所
- ✅ **米国・日本・欧州・アジア**: マルチマーケット
- ✅ **24時間取引**: 市場時間に応じて自動取引
- ✅ **多通貨対応**: USD, JPY, EUR, GBP等

---

## 🏗️ プロジェクト構造

```
daytrading-app/
├── src/
│   ├── brokers/              # 証券会社統合
│   │   ├── mock-ib-api.ts          # モックAPI（練習用）
│   │   └── interactive-brokers-integration.ts
│   ├── services/             # サービス層
│   │   ├── yahoo-finance-service.ts     # Yahoo Finance統合
│   │   └── hybrid-market-data-service.ts # ハイブリッド
│   ├── trading/              # 取引システム
│   │   ├── paper-trading-system.ts      # 仮想取引
│   │   ├── auto-trading-service.ts      # 自動売買
│   │   └── trading-scheduler.ts         # スケジューラー
│   └── ...
├── scripts/                  # 実行スクリプト
│   ├── test-paper-trading-system.ts     # 仮想取引テスト
│   ├── test-hybrid-market-data.ts       # ハイブリッドテスト
│   ├── setup-interactive-brokers.ts     # IB設定
│   └── ...
└── docs/                     # ドキュメント
    ├── setup-guides/         # セットアップガイド
    └── phases/               # 開発記録
```

---

## 💡 よくある質問（FAQ）

### Q1: 初めて使うのですが、何から始めればいいですか？

**A:** まず `npm run practice:start` を実行してください。これは完全に安全で、実際のお金は一切使いません。

### Q2: practice と production の違いは？

**A:**

- **practice**: 架空の資金で練習（リスクなし）
- **production**: 実際の資金で取引（リスクあり）

### Q3: いつ本番取引に移行すべきですか？

**A:** 以下の条件を満たしてから：

- ✅ practice で10回以上取引して仕組みを理解
- ✅ 取引統計で勝率50%以上を達成
- ✅ リスク管理を理解している
- ✅ Interactive Brokers口座を開設済み

### Q4: コストはかかりますか？

**A:**

- **practice コマンド**: 完全無料
- **production コマンド**: 取引手数料、市場データ料金（月$0-30）

### Q5: どのコマンドを実行してはいけませんか？

**A:**

- ⚠️ `production:deploy` - 本番デプロイ（十分な準備後のみ）
- ⚠️ `workflow:deploy` - 自動デプロイ（管理者のみ）
- ℹ️ その他のコマンドは安全です

---

## 🎯 推奨学習パス

### Week 1-2: 基礎学習

```bash
# 1. 仮想取引を試す
npm run practice:start

# 2. ハイブリッドシステムを理解
npm run practice:hybrid

# 3. ドキュメントを読む
./docs/setup-guides/hybrid-system-guide.md
```

### Week 3-4: 機能理解

```bash
# 4. 各フェーズの機能をテスト
npm run test:phase1  # Phase1機能
npm run test:phase2  # Phase2機能
# ... 続けて全フェーズをテスト

# 5. 自動売買機能を確認
npm run test:trading
```

### Week 5-8: 戦略開発

- 自分の取引戦略を開発
- バックテストで検証
- リスク管理を設定

### Week 9+: 本番準備（オプション）

```bash
# Interactive Brokers口座開設
# ペーパートレーディングで検証

npm run production:setup  # 接続設定
npm run production:test   # 接続確認

# 十分なテスト後...
npm run production:deploy # 本番運用
```

---

## 📊 システムの特徴

### コスト最適化

- **開発時**: $0/月（Yahoo Finance使用）
- **本番時**: $0-10/月（月間取引$30以上で無料）

### データソース

- **Yahoo Finance**: 銘柄探索、履歴分析（無料）
- **Interactive Brokers**: リアルタイム取引（有料）

### 取引可能市場

- 🇺🇸 米国（NYSE, NASDAQ）
- 🇯🇵 日本（TSE）
- 🇪🇺 欧州（LSE, XETRA）
- 🌏 アジア（HKEX, SGX）

---

## 🔒 セキュリティと法的事項

### 投資リスク

- ⚠️ 投資には損失のリスクが伴います
- ⚠️ 過去の実績は将来の運用成果を保証しません
- ⚠️ 自己責任での取引をお願いします

### 法的事項

- 📜 金融商品取引法の遵守が必要
- 📜 海外証券会社での取引は確定申告が必要
- 📜 このシステムは個人利用を目的としています

---

## 🤝 サポート

### 困ったときは

1. **ドキュメントを確認**: `./docs/` フォルダ
2. **Issues を確認**: [GitHub Issues](https://github.com/PheasantDevil/daytrading-app/issues)
3. **公式サポート**: [Interactive Brokers日本](https://www.interactivebrokers.co.jp/)

---

## 📝 ライセンス

このプロジェクトは個人利用を目的としています。

---

**まずは `npm run practice:start` で仮想取引を試してみましょう！** 🚀
