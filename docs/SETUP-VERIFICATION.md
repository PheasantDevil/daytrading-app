# 4日間検証システム セットアップガイド

このガイドでは、4日間の仮想自動デイトレード検証システムのセットアップ手順を説明します。

---

## 📋 前提条件

- Node.js 18以上がインストールされていること
- Git が設定済みであること
- LINE Messaging APIのアカウントがあること（通知機能を使用する場合）

---

## 🛠️ セットアップ手順

### 1. 環境変数の設定

```bash
# 1. env.exampleから.env.localをコピー
cp env.example .env.local

# 2. .env.localを編集
nano .env.local  # または好みのエディタで開く
```

### 2. LINE設定の追加

`.env.local`ファイルに以下の内容を追加してください：

```bash
# LINE Messaging API設定（取引通知用）
LINE_CHANNEL_ACCESS_TOKEN=def031b6d31365406dc77b29b217daf6
LINE_USER_ID=Ua44a8b4a0828d37ff7edc22126377490
LINE_NOTIFICATION_ENABLED=true
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. LINE通知のテスト

```bash
npm run test:line
```

✅ LINEアプリに以下のような通知が届けば成功です：

- 🔔 テスト通知
- 🚀 デイトレード開始
- 📈 購入実行
- 💰 売却実行
- その他の通知メッセージ

---

## 🚀 実行方法

### 4日間検証の開始（10/14〜10/17）

```bash
# 毎日以下のコマンドを実行
npm run verify:trade
```

**実行スケジュール**：

- 10/14（火）: 保守的設定
- 10/15（水）: 標準設定
- 10/16（木）: 積極的設定
- 10/17（金）: 標準設定（再検証）

### システムの停止

```bash
# Ctrl+C で停止
# → 自動的に日次レポートが生成されます
```

### 4日間統合分析（10/17夕方以降）

```bash
npm run verify:analyze
```

統合レポートが `./reports/verification-comprehensive-report.md` に生成されます。

---

## 📊 生成されるファイル

### 日次ファイル（各日付ごと）

```
./reports/verification-{日付}/
├── daily-{日付}.json          # 取引データ（JSON）
├── realtime-log.jsonl          # リアルタイムログ
├── daily-report.txt            # 日次レポート
└── trades-export-{日付}.csv   # CSVエクスポート
```

### 統合レポート（10/17以降）

```
./reports/
└── verification-comprehensive-report.md  # 4日間の統合分析
```

---

## 📱 LINE通知の設定（オプション）

### 通知を無効にする場合

`.env.local`ファイルで以下を変更：

```bash
LINE_NOTIFICATION_ENABLED=false
```

### 通知をグループに送る場合

`.env.local`ファイルで以下を設定：

```bash
LINE_GROUP_ID=your_group_id_here
# LINE_USER_ID はコメントアウトまたは削除
```

---

## ⚠️ トラブルシューティング

### LINE通知が届かない

**原因**: トークン設定エラー

**解決方法**:

```bash
# 1. トークンの確認
cat .env.local | grep LINE

# 2. 接続テスト
npm run test:line

# 3. エラーメッセージを確認
```

### 取引が実行されない

**原因**: 設定が無効化されている

**解決方法**:

```bash
# verification-trading-config.ts を確認
# trading.enabled が true であることを確認
```

### システムが起動しない

**原因**: 依存関係の問題

**解決方法**:

```bash
# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
```

### 今日の日付の設定が見つからない

**原因**: 検証期間外の日付

**解決方法**:

- 10/14〜10/17の期間のみ実行可能
- または `src/config/verification-trading-config.ts` で日付を追加

---

## 📚 関連ドキュメント

- [4日間検証計画書](./4DAY-VERIFICATION-PLAN.md) - 詳細な検証計画
- [コマンドガイド](./COMMAND_GUIDE.md) - 全コマンド一覧
- [運用チェックリスト](./OPERATION_CHECKLIST.md) - 運用手順

---

## 🔒 セキュリティ注意事項

### 重要事項

1. **`.env.local`はGitにコミットしないこと**
   - すでに`.gitignore`に追加済み
   - トークンが漏洩しないよう注意

2. **LINE Channel Access Tokenの管理**
   - 定期的にトークンをリフレッシュ
   - 第三者に共有しない

3. **本番取引との区別**
   - 必ず `paperTrading: true` で実行
   - `IB_PAPER_TRADING=true` を確認

---

## ✅ セットアップ完了チェックリスト

- [ ] `.env.local`ファイルを作成
- [ ] LINE設定を追加（トークン、ユーザーID）
- [ ] `npm install` を実行
- [ ] `npm run test:line` でLINE通知をテスト
- [ ] テスト通知がLINEに届くことを確認
- [ ] `npm run verify:trade` のテスト実行（Ctrl+Cですぐ停止）

---

**最終更新**: 2025年10月13日  
**担当者**: [あなたの名前]
