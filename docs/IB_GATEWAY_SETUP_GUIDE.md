# Interactive Brokers Gateway 設定ガイド

## 概要

Interactive Brokers Gateway（IBゲートウェイ）は、自動売買システムがInteractive BrokersのAPIに接続するために必要なソフトウェアです。

## 1. IBゲートウェイのダウンロード

### 1.1 公式サイトからダウンロード

1. **Interactive Brokers公式サイト**にアクセス
   - URL: https://www.interactivebrokers.com/jp/trading/ib-api.php

2. **IB Gateway**を選択
   - 「Standalone IB Gateway」をクリック
   - お使いのOS（Windows/Mac/Linux）に対応したバージョンをダウンロード

### 1.2 システム要件

- **Windows**: Windows 10以上
- **macOS**: macOS 10.14以上  
- **Linux**: Ubuntu 18.04以上
- **メモリ**: 最低2GB RAM
- **ディスク**: 500MB以上の空き容量

## 2. インストール手順

### 2.1 macOSの場合

```bash
# ダウンロードしたdmgファイルをマウント
open ibgateway-*.dmg

# アプリケーションフォルダにドラッグ&ドロップ
# または以下のコマンドでインストール
sudo installer -pkg "IB Gateway.pkg" -target /
```

### 2.2 Windowsの場合

```cmd
# ダウンロードしたexeファイルを実行
ibgateway-setup.exe

# インストールウィザードに従って進める
# デフォルト設定で問題ありません
```

### 2.3 Linuxの場合

```bash
# ダウンロードしたshファイルに実行権限を付与
chmod +x ibgateway-*.sh

# インストール実行
./ibgateway-*.sh

# または
sudo ./ibgateway-*.sh
```

## 3. 初期設定

### 3.1 IBゲートウェイの起動

1. **アプリケーション**から「IB Gateway」を起動
2. **ログイン画面**が表示されます

### 3.2 ログイン設定

```
ユーザー名: [IBアカウントのユーザー名]
パスワード: [IBアカウントのパスワード]
取引モード: 
  - Live Trading (本番取引)
  - Paper Trading (ペーパートレーディング)
```

**⚠️ 重要**: 初期テストでは必ず「Paper Trading」を選択してください。

### 3.3 API設定の有効化

1. **ログイン後**、設定メニューを開く
2. **「Configure」** → **「Settings」** → **「API」**
3. 以下の設定を有効化：

```
✅ Enable ActiveX and Socket Clients
✅ Allow connections from localhost only
✅ Read-Only API
Socket Port: 7497 (Paper Trading) / 7496 (Live Trading)
Master API client ID: 0
```

### 3.4 ポート設定の確認

| 取引モード | ポート番号 | 用途 |
|------------|------------|------|
| Paper Trading | 7497 | テスト・開発用 |
| Live Trading | 7496 | 本番取引用 |

## 4. 接続テスト

### 4.1 環境変数の設定

`.env.local`ファイルを確認・更新：

```env
# Paper Trading設定（推奨）
IB_HOST=127.0.0.1
IB_PORT=7497
IB_CLIENT_ID=1
IB_ACCOUNT_ID=DU123456  # 実際のペーパートレーディングアカウントID
IB_PAPER_TRADING=true

# Live Trading設定（本番運用時）
# IB_PORT=7496
# IB_ACCOUNT_ID=U123456  # 実際のライブアカウントID
# IB_PAPER_TRADING=false
```

### 4.2 接続テストスクリプトの実行

```bash
# 接続テスト実行
npm run test:ib-connection

# または手動テスト
node scripts/test-interactive-brokers.ts
```

### 4.3 期待される結果

```
✅ IB Gateway接続成功
✅ アカウント情報取得成功
✅ 市場データ接続成功
✅ 注文送信テスト成功（ペーパートレーディング）
```

## 5. トラブルシューティング

### 5.1 よくあるエラー

#### エラー1: 接続拒否
```
Error: Connection refused (ECONNREFUSED)
```

**解決方法**:
- IBゲートウェイが起動しているか確認
- ポート番号が正しいか確認（7497/7496）
- ファイアウォール設定を確認

#### エラー2: 認証エラー
```
Error: Authentication failed
```

**解決方法**:
- ユーザー名・パスワードを確認
- 2段階認証が有効な場合は、IBKeyアプリで認証
- アカウントがAPIアクセス可能か確認

#### エラー3: API無効エラー
```
Error: API access not enabled
```

**解決方法**:
- IBゲートウェイの設定で「Enable ActiveX and Socket Clients」を有効化
- 設定変更後、IBゲートウェイを再起動

### 5.2 ログの確認

```bash
# IBゲートウェイのログファイル確認
# macOS
tail -f ~/Jts/ibgateway/*/log/*.log

# Windows
type "%USERPROFILE%\Jts\ibgateway\*\log\*.log"

# Linux
tail -f ~/Jts/ibgateway/*/log/*.log
```

## 6. セキュリティ設定

### 6.1 推奨設定

```
✅ localhost接続のみ許可
✅ 読み取り専用API（初期設定）
✅ 信頼できるIPアドレスのみ許可
✅ 定期的なパスワード変更
```

### 6.2 本番運用時の注意点

1. **VPN接続**の使用を推奨
2. **ファイアウォール**設定の確認
3. **ログ監視**の実装
4. **異常検知**システムの導入

## 7. 次のステップ

IBゲートウェイの設定が完了したら：

1. **接続テスト**の実行
2. **市場データ**の取得確認
3. **ペーパートレーディング**での注文テスト
4. **自動売買システム**の統合テスト

---

## サポート情報

- **Interactive Brokers サポート**: https://www.interactivebrokers.com/jp/support/
- **API ドキュメント**: https://interactivebrokers.github.io/tws-api/
- **コミュニティフォーラム**: https://groups.io/g/twsapi
