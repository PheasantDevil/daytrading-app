# ドキュメント構成

デイトレーディングアプリケーションのドキュメント一覧です。

## 📁 ディレクトリ構造

```
docs/
├── README.md                          # このファイル
├── daytrading-app-requirements.md     # アプリケーション要件定義
├── daytrading-app-roadmap.md          # 開発ロードマップ
├── phases/                            # フェーズ別ドキュメント
│   ├── implementation-plans/          # 実装計画書
│   │   ├── phase1-implementation-plan.md
│   │   ├── phase2-implementation-plan.md
│   │   ├── phase3-implementation-plan.md
│   │   ├── phase4-implementation-plan.md
│   │   ├── phase5-implementation-plan.md
│   │   ├── phase6-implementation-plan.md
│   │   └── phase7-implementation-plan.md
│   ├── completion-reports/            # 完了レポート
│   │   ├── phase1-completion-report.md
│   │   ├── phase2-completion-report.md
│   │   ├── phase3-completion-report.md
│   │   ├── phase4-completion-report.md
│   │   ├── phase5-completion-report.md
│   │   ├── phase6-completion-report.md
│   │   └── phase7-completion-report.md
│   ├── phase-summary.md               # フェーズサマリー
│   ├── phase1-foundation.md           # Phase1詳細
│   ├── phase2-data-acquisition.md     # Phase2詳細
│   └── phase3-prediction-features.md  # Phase3詳細
├── setup-guides/                      # セットアップガイド
│   └── interactive-brokers-setup-guide.md
└── research/                          # 調査レポート
    ├── phase2-api-research-report.md
    └── stock-api-research.md
```

## 📚 ドキュメント一覧

### 基本ドキュメント

#### `daytrading-app-requirements.md`
- アプリケーションの要件定義
- 機能要件と非機能要件
- システムアーキテクチャ

#### `daytrading-app-roadmap.md`
- 開発ロードマップ
- 各フェーズの概要
- マイルストーン

### フェーズ別ドキュメント

#### Phase 1: コア機能実装
- **実装計画**: `phases/implementation-plans/phase1-implementation-plan.md`
- **完了レポート**: `phases/completion-reports/phase1-completion-report.md`
- **内容**: 手数料計算、リスク管理、バックテスト、テクニカル分析、LSTM、マルチタイムフレーム予測

#### Phase 2: データ統合とデモ取引
- **実装計画**: `phases/implementation-plans/phase2-implementation-plan.md`
- **完了レポート**: `phases/completion-reports/phase2-completion-report.md`
- **内容**: データ統合サービス、OANDA統合、Webull統合、デモ取引

#### Phase 3: リアル取引と戦略実装
- **実装計画**: `phases/implementation-plans/phase3-implementation-plan.md`
- **完了レポート**: `phases/completion-reports/phase3-completion-report.md`
- **内容**: リアル取引サービス、取引戦略、ML統合、バックテストエンジン

#### Phase 4: クラウド統合とスケーラビリティ
- **実装計画**: `phases/implementation-plans/phase4-implementation-plan.md`
- **完了レポート**: `phases/completion-reports/phase4-completion-report.md`
- **内容**: AWS統合、ロードバランサー、アプリケーション監視、認証管理

#### Phase 5: AI/ML統合とリアルタイム処理
- **実装計画**: `phases/implementation-plans/phase5-implementation-plan.md`
- **完了レポート**: `phases/completion-reports/phase5-completion-report.md`
- **内容**: 高度なML、WebSocket、国際化、PWA

#### Phase 6: エッジコンピューティングと次世代技術
- **実装計画**: `phases/implementation-plans/phase6-implementation-plan.md`
- **完了レポート**: `phases/completion-reports/phase6-completion-report.md`
- **内容**: エッジノード、量子最適化、ブロックチェーン、IoT

#### Phase 7: 統合と本格運用
- **実装計画**: `phases/implementation-plans/phase7-implementation-plan.md`
- **完了レポート**: `phases/completion-reports/phase7-completion-report.md`
- **内容**: 統合サービス、メインアプリケーション、パフォーマンス最適化、本番デプロイメント

### セットアップガイド

#### `setup-guides/interactive-brokers-setup-guide.md`
- Interactive Brokers口座開設手順
- TWS/IB Gatewayのインストール
- API接続の有効化
- 環境変数の設定
- 接続テスト手順
- トラブルシューティング

**特徴:**
- 🌍 世界中どこからでもアクセス可能
- 🌎 世界17カ国、50以上の取引所に対応
- 💰 低コストでグローバル取引
- 🔒 安全なAPI接続

### 調査レポート

#### `research/phase2-api-research-report.md`
- Phase2のAPI調査結果
- 各種API評価
- 推奨API選定

#### `research/stock-api-research.md`
- 株価API全般の調査
- 利用可能なAPIリスト
- 比較評価

## 🎯 ドキュメントの使い方

### 開発者向け
1. **新規開発者**: `daytrading-app-requirements.md`と`daytrading-app-roadmap.md`から開始
2. **フェーズ実装**: 該当フェーズの`implementation-plans/`を参照
3. **完了確認**: 該当フェーズの`completion-reports/`で確認

### 運用者向け
1. **セットアップ**: `setup-guides/interactive-brokers-setup-guide.md`を参照
2. **API設定**: 環境変数の設定手順に従う
3. **テスト実行**: `npm run test:ib-connection`で接続確認

### 調査・研究向け
1. **API調査**: `research/`ディレクトリを参照
2. **技術選定**: 調査レポートを基に判断
3. **実装参考**: サンプルコードと仕様書を活用

## 📊 開発進捗

### 完了済みフェーズ
- ✅ Phase 1: コア機能実装
- ✅ Phase 2: データ統合とデモ取引
- ✅ Phase 3: リアル取引と戦略実装
- ✅ Phase 4: クラウド統合とスケーラビリティ
- ✅ Phase 5: AI/ML統合とリアルタイム処理
- ✅ Phase 6: エッジコンピューティングと次世代技術
- ✅ Phase 7: 統合と本格運用

### 現在の状態
- **開発状況**: 全7フェーズ完了
- **証券会社**: Interactive Brokers統合完了
- **運用準備**: 本格運用可能

## 🔗 関連リンク

### 公式ドキュメント
- [Interactive Brokers API](https://www.interactivebrokers.co.jp/jp/trading/ib-api.php)
- [Interactive Brokers日本](https://www.interactivebrokers.co.jp/)

### 技術リソース
- [TWS APIガイド](https://www.interactivebrokers.com/en/software/api/apiguide/tables/api_guide.htm)
- [IBKRフォーラム](https://www.interactivebrokers.com/en/trading/ibforum.php)

### プロジェクトリポジトリ
- [GitHub Repository](https://github.com/PheasantDevil/daytrading-app)

---

**整理されたドキュメント構造により、開発・運用・保守がより効率的になりました。**
