# デイトレード用Webアプリケーション

**世界中どこからでも、世界中の市場で取引可能な自動売買システム**

個人利用を目的としたグローバル対応のデイトレードアプリケーションです。

## 🌟 主要機能

### 取引機能
- ✅ **ペーパートレーディング**: 仮想資金$100,000での取引シミュレーション
- ✅ **自動売買**: 複数戦略による24時間自動取引
- ✅ **リアルタイム市場データ**: 米国株・日本株のリアルタイム価格
- ✅ **リスク管理**: ストップロス、テイクプロフィット、日次損失制限

### AI/ML機能
- ✅ **LSTM予測**: ディープラーニングによる価格予測
- ✅ **マルチタイムフレーム分析**: 複数時間軸での予測
- ✅ **テクニカル分析**: SMA、EMA、RSI、MACD、ボリンジャーバンド
- ✅ **オンライン学習**: リアルタイムモデル更新

### グローバル対応
- ✅ **Interactive Brokers統合**: 世界17カ国、50以上の取引所
- ✅ **マルチマーケット**: 米国、日本、欧州、アジア市場
- ✅ **国際化**: 多言語、多通貨、タイムゾーン対応
- ✅ **PWA**: モバイル対応、オフライン機能

### インフラ
- ✅ **クラウド統合**: AWS（S3、RDS、Lambda、CloudWatch）
- ✅ **スケーラビリティ**: ロードバランサー、自動スケーリング
- ✅ **監視**: アプリケーション監視、アラート、レポート
- ✅ **セキュリティ**: JWT認証、MFA、暗号化

### 次世代技術
- ✅ **エッジコンピューティング**: 低レイテンシ処理
- ✅ **量子最適化**: ポートフォリオ最適化
- ✅ **ブロックチェーン**: 分散取引、スマートコントラクト
- ✅ **IoT**: リアルタイムセンサーデータ統合

## 🚀 クイックスタート

### 前提条件
- Node.js 18以上
- Docker & Docker Compose
- PostgreSQL
- Redis

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/PheasantDevil/daytrading-app.git
cd daytrading-app

# 依存関係のインストール
npm install

# 環境変数の設定
cp env.example .env.local
# .env.localを編集して必要な情報を設定

# データベースとRedisの起動
docker-compose up -d

# 開発サーバーの起動
npm run dev
```

### ペーパートレーディングを試す

```bash
# Interactive Brokersペーパートレーディング（推奨）
npm run ib:paper-trading

# 結果: 仮想資金$100,000で実際の取引をシミュレート
# - リアルタイム価格変動
# - 自動約定処理
# - 損益計算
# - 取引統計
```

## 📚 ドキュメント

### セットアップガイド
- [Interactive Brokers設定ガイド](./docs/setup-guides/interactive-brokers-setup-guide.md)

### 開発ドキュメント
- [要件定義書](./docs/daytrading-app-requirements.md)
- [開発ロードマップ](./docs/daytrading-app-roadmap.md)
- [ドキュメント一覧](./docs/README.md)

### フェーズ別実装記録
- [Phase1-7 実装計画書](./docs/phases/implementation-plans/)
- [Phase1-7 完了レポート](./docs/phases/completion-reports/)
- [プロジェクトサマリー](./docs/phases/phase-summary.md)

### 技術調査
- [API調査レポート](./docs/research/)

## 🛠️ 利用可能なコマンド

### 開発
```bash
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run start        # 本番サーバー起動
npm run lint         # リント実行
npm run format       # コード整形
npm run type-check   # 型チェック
```

### Interactive Brokers
```bash
npm run ib:setup          # IB接続設定
npm run ib:test           # IB接続テスト
npm run ib:paper-trading  # ペーパートレーディング実行
```

### 自動売買
```bash
npm run trading:auto      # 自動売買機能テスト
```

### テスト
```bash
npm run test:all-phases   # 全フェーズテスト実行
npm run test:phase1       # Phase1テスト
npm run test:phase2       # Phase2テスト
npm run test:phase3       # Phase3テスト
npm run test:phase4       # Phase4テスト
npm run test:phase5       # Phase5テスト
npm run test:phase6       # Phase6テスト
npm run test:phase7       # Phase7テスト
```

### デプロイ
```bash
npm run workflow:deploy   # 自動デプロイワークフロー
```

### Docker
```bash
npm run docker:dev        # 開発環境起動
npm run docker:build      # イメージビルド
npm run docker:up         # コンテナ起動
npm run docker:down       # コンテナ停止
```

## 🏗️ プロジェクト構造

```
daytrading-app/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── agents/                 # 自動売買エージェント
│   ├── ai/                     # AI/ML統合
│   ├── backtesting/            # バックテストエンジン
│   ├── blockchain/             # ブロックチェーン統合
│   ├── brokers/                # 証券会社統合
│   │   ├── broker-integration-service.ts
│   │   ├── interactive-brokers-integration.ts
│   │   └── mock-ib-api.ts     # モックAPI
│   ├── cloud/                  # AWS統合
│   ├── config/                 # 設定ファイル
│   │   └── interactive-brokers-config.ts
│   ├── deployment/             # デプロイメント
│   ├── edge/                   # エッジコンピューティング
│   ├── i18n/                   # 国際化
│   ├── integration/            # サービス統合
│   ├── iot/                    # IoT統合
│   ├── mobile/                 # PWA管理
│   ├── ml/                     # 機械学習
│   ├── monitoring/             # アプリケーション監視
│   ├── optimization/           # パフォーマンス最適化
│   ├── quantum/                # 量子コンピューティング
│   ├── realtime/               # WebSocket管理
│   ├── scalability/            # ロードバランサー
│   ├── security/               # 認証・認可
│   ├── services/               # コアサービス
│   ├── strategies/             # 取引戦略
│   ├── trading/                # 取引システム
│   │   ├── auto-trading-service.ts
│   │   ├── trading-scheduler.ts
│   │   └── paper-trading-system.ts
│   └── utils/                  # ユーティリティ
├── scripts/                    # テスト・セットアップスクリプト
│   ├── setup-interactive-brokers.ts
│   ├── test-interactive-brokers.ts
│   ├── test-paper-trading-system.ts
│   ├── test-auto-trading-features.ts
│   ├── test-phase1-features.ts
│   ├── test-phase2-features.ts
│   ├── test-phase3-features.ts
│   ├── test-phase4-features.ts
│   ├── test-phase5-features.ts
│   ├── test-phase6-features.ts
│   ├── test-phase7-features.ts
│   └── workflow-routine.ts
├── docs/                       # ドキュメント
│   ├── phases/                 # フェーズ別記録
│   ├── setup-guides/           # セットアップガイド
│   └── research/               # 技術調査
├── prisma/                     # データベーススキーマ
└── reports/                    # 生成レポート
```

## 📊 開発進捗

### 完了済みフェーズ

- ✅ **Phase1**: コア機能実装（手数料計算、リスク管理、バックテスト、LSTM）
- ✅ **Phase2**: データ統合とデモ取引
- ✅ **Phase3**: リアル取引と戦略実装
- ✅ **Phase4**: クラウド統合とスケーラビリティ
- ✅ **Phase5**: AI/ML統合とリアルタイム処理
- ✅ **Phase6**: エッジコンピューティングと次世代技術
- ✅ **Phase7**: 統合と本格運用

### 現在の状態

- ✅ **証券会社**: Interactive Brokers統合完了
- ✅ **ペーパートレーディング**: 完全動作可能
- ✅ **自動売買**: バックグラウンド実行対応
- ✅ **グローバル市場**: 世界17カ国、50以上の取引所対応

## 🌍 Interactive Brokers統合

### 特徴
- **グローバルアクセス**: 世界中どこからでも取引可能
- **マルチマーケット**: 米国、日本、欧州、アジア市場
- **マルチアセット**: 株式、オプション、先物、FX、債券、CFD
- **低コスト**: 1株$0.005から

### 取引可能市場
- 🇺🇸 **米国**: NYSE, NASDAQ, AMEX
- 🇯🇵 **日本**: 東京証券取引所（TSE）
- 🇬🇧 **欧州**: LSE（ロンドン）、XETRA（ドイツ）
- 🇭🇰 **アジア**: HKEX（香港）、SGX（シンガポール）

### モック実装（すぐに使える）

現在、**実際のTWS/IB Gatewayなしで完全に動作**します：
- ✅ モックIB API実装済み
- ✅ リアルタイム価格変動シミュレーション
- ✅ 仮想口座管理
- ✅ 自動約定処理
- ✅ 損益計算

```bash
# すぐに試せる
npm run ib:paper-trading
```

## 🔧 環境変数設定

```bash
# .env.local

# Interactive Brokers設定
IB_HOST=127.0.0.1
IB_PORT=7497  # 7497=ペーパー, 7496=本番
IB_CLIENT_ID=1
IB_ACCOUNT_ID=PAPER123456
IB_PAPER_TRADING=true

# データベース
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/daytrading_app

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

## 📈 技術スタック

### フロントエンド
- **Next.js 15**: App Router
- **React 19**: UI構築
- **TypeScript**: 型安全性
- **TailwindCSS**: スタイリング

### バックエンド
- **Node.js**: サーバーサイド
- **TypeScript**: 全コード
- **WebSocket**: リアルタイム通信
- **Express**: API

### データベース
- **PostgreSQL**: メインDB
- **Redis**: キャッシュ・セッション
- **Prisma**: ORM

### 機械学習
- **TensorFlow.js**: LSTM、ニューラルネットワーク
- **カスタムML**: 予測モデル、最適化

### 証券会社統合
- **Interactive Brokers**: グローバル市場
- **モックAPI**: 開発・テスト用

### インフラ
- **AWS**: S3、RDS、Lambda、CloudWatch
- **Docker**: コンテナ化
- **CI/CD**: 自動デプロイ

## 🎯 使用方法

### 1. ペーパートレーディング（推奨）

```bash
# 仮想取引システムを起動
npm run ib:paper-trading

# 結果:
# - 初期資金: $100,000
# - リアルタイム価格変動
# - 自動約定処理
# - 損益計算
# - 取引統計
```

### 2. Interactive Brokers接続テスト

```bash
# IB接続確認
npm run ib:test

# IB初期設定
npm run ib:setup
```

### 3. 自動売買システム

```bash
# 自動売買機能テスト
npm run trading:auto
```

### 4. 全機能テスト

```bash
# 全フェーズの機能をテスト
npm run test:all-phases
```

## 📊 プロジェクト統計

- **総コード行数**: 20,000+ 行
- **実装サービス**: 35+ サービス
- **対応銘柄**: 米国株・日本株・グローバル株
- **取引可能市場**: 17カ国、50以上の取引所
- **完了フェーズ**: 7フェーズ完了

## 🔒 セキュリティ

- **JWT認証**: セキュアな認証システム
- **パスワードハッシュ化**: bcrypt使用
- **MFA**: 多要素認証対応
- **ロールベースアクセス制御**: RBAC実装
- **暗号化**: データ・通信の暗号化

## 🌐 グローバル対応

### 取引可能時間（市場時間）
- **米国市場**: 9:30-16:00 EST（22:30-5:00 JST夏時間）
- **日本市場**: 9:00-15:00 JST
- **欧州市場**: 各取引所により異なる
- **アジア市場**: 各取引所により異なる

### 対応通貨
- USD（米ドル）
- JPY（日本円）
- EUR（ユーロ）
- GBP（英ポンド）
- その他主要通貨

## ⚠️ 重要な注意事項

### 投資リスク
- 投資にはリスクが伴います
- 過去の実績は将来の運用成果を保証しません
- 自己責任での取引をお願いします

### 法的事項
- 金融商品取引法の遵守が必要です
- 海外証券会社での取引は確定申告が必要です
- APIキーは厳重に管理してください

### 技術的制約
- Interactive Brokers口座開設が必要（本番取引時）
- 市場データは別途契約が必要な場合があります
- API制限を遵守してください

## 📝 ライセンス

このプロジェクトは個人利用を目的としています。

## 🤝 サポート

### 公式リソース
- [Interactive Brokers日本](https://www.interactivebrokers.co.jp/)
- [TWS APIガイド](https://www.interactivebrokers.com/en/software/api/apiguide/tables/api_guide.htm)

### プロジェクトリポジトリ
- [GitHub](https://github.com/PheasantDevil/daytrading-app)
- [Issues](https://github.com/PheasantDevil/daytrading-app/issues)

---

**世界中どこにいても、世界中の市場で取引可能な次世代デイトレーディングシステム** 🌍📈🤖