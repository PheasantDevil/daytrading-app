# 楽天証券API設定ガイド

## 概要

楽天証券のAPIを使用して自動売買システムを構築するための詳細な設定手順です。

## 必要な情報

### 1. 楽天証券API認証情報
- **アプリケーションID**: アプリケーション識別用
- **アプリケーションシークレット**: 認証用
- **アクセストークン**: API呼び出し用
- **リフレッシュトークン**: トークン更新用

### 2. 口座情報
- **口座番号**: 楽天証券の口座番号
- **支店コード**: 口座の支店コード
- **口座種別**: 普通/特定/信用

### 3. 取引設定
- **取引パスワード**: 6桁の数字
- **暗証番号**: 4桁の数字
- **取引上限額**: 1回の取引上限

## 手動設定手順

### Step 1: 楽天証券APIの申込

1. **楽天証券ホームページにアクセス**
   - URL: https://www.rakuten-sec.co.jp/
   - ログインして口座にアクセス

2. **API利用申込**
   - メニューから「楽天証券API」を選択
   - 「API利用申込」をクリック
   - 必要事項を入力：
     - 利用目的: 個人投資用
     - 取引種別: 現物・信用取引
     - 取引上限額: 希望額を入力
     - 利用期間: 継続利用

3. **申込完了**
   - 申込内容を確認して送信
   - 審査完了まで1-3営業日

### Step 2: アプリケーション登録

1. **API管理画面にアクセス**
   - 審査完了後、メールで通知
   - 「楽天証券API」ページでログイン

2. **新規アプリケーション作成**
   - 「アプリケーション管理」をクリック
   - 「新規アプリケーション作成」をクリック
   - 以下を入力：
     - アプリケーション名: `DayTradingApp`
     - 説明: `自動売買システム`
     - コールバックURL: `http://localhost:3000/callback`
     - スコープ: `read write`

3. **アプリケーションID取得**
   - 作成完了後、以下が表示される：
     - アプリケーションID
     - アプリケーションシークレット
   - これらの情報をコピーして保存

### Step 3: アクセストークン取得

1. **認証URLにアクセス**
   ```
   https://api.rakuten-sec.co.jp/oauth/authorize?response_type=code&client_id=YOUR_APP_ID&redirect_uri=http://localhost:3000/callback&scope=read%20write
   ```

2. **認証完了**
   - 楽天証券のログイン画面が表示
   - 口座番号とパスワードでログイン
   - 認証完了後、コールバックURLにリダイレクト
   - URLの`code`パラメータをコピー

3. **アクセストークン取得**
   ```bash
   curl -X POST https://api.rakuten-sec.co.jp/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "code=YOUR_AUTH_CODE" \
     -d "client_id=YOUR_APP_ID" \
     -d "client_secret=YOUR_SECRET" \
     -d "redirect_uri=http://localhost:3000/callback"
   ```

4. **レスポンス確認**
   ```json
   {
     "access_token": "YOUR_ACCESS_TOKEN",
     "refresh_token": "YOUR_REFRESH_TOKEN",
     "token_type": "Bearer",
     "expires_in": 3600
   }
   ```

### Step 4: 口座情報の確認

1. **口座番号の確認**
   - 楽天証券のホームページでログイン
   - 「口座情報」から口座番号を確認

2. **支店コードの確認**
   - 口座番号の最初の3桁が支店コード
   - 例: 口座番号が`123456789012`の場合、支店コードは`123`

3. **口座種別の確認**
   - 普通口座: `普通`
   - 特定口座: `特定`
   - 信用口座: `信用`

## 設定ファイルの作成

### 1. 環境変数ファイルの作成

```bash
# .env.local ファイルを作成
touch .env.local
```

### 2. 環境変数の設定

```bash
# .env.local に以下を追加
# 楽天証券API設定
RAKUTEN_APP_ID=your_rakuten_app_id
RAKUTEN_APP_SECRET=your_rakuten_app_secret
RAKUTEN_ACCESS_TOKEN=your_rakuten_access_token
RAKUTEN_REFRESH_TOKEN=your_rakuten_refresh_token
RAKUTEN_ACCOUNT_NUMBER=your_rakuten_account_number
RAKUTEN_BRANCH_CODE=your_rakuten_branch_code
RAKUTEN_ACCOUNT_TYPE=普通

# 取引設定
TRADING_PASSWORD=your_trading_password
TRADING_PIN=your_trading_pin
MAX_TRADING_AMOUNT=1000000
```

### 3. 設定ファイルの作成

```typescript
// src/config/rakuten-config.ts
export const rakutenConfig = {
  name: 'rakuten',
  appId: process.env.RAKUTEN_APP_ID || '',
  appSecret: process.env.RAKUTEN_APP_SECRET || '',
  accessToken: process.env.RAKUTEN_ACCESS_TOKEN || '',
  refreshToken: process.env.RAKUTEN_REFRESH_TOKEN || '',
  accountNumber: process.env.RAKUTEN_ACCOUNT_NUMBER || '',
  branchCode: process.env.RAKUTEN_BRANCH_CODE || '',
  accountType: process.env.RAKUTEN_ACCOUNT_TYPE || '普通',
  baseUrl: 'https://api.rakuten-sec.co.jp',
  timeout: 30000,
  retryAttempts: 3,
  tradingPassword: process.env.TRADING_PASSWORD || '',
  tradingPin: process.env.TRADING_PIN || '',
  maxTradingAmount: parseInt(process.env.MAX_TRADING_AMOUNT || '1000000'),
};
```

## 接続テスト

### 1. 接続テストスクリプトの実行

```bash
# 接続テストを実行
npm run test:rakuten-connection
```

### 2. テスト結果の確認

- アカウント情報の取得
- ポジション情報の取得
- 注文履歴の取得
- 市場データの取得

## 注意事項

### セキュリティ
- APIキーは絶対に第三者に漏洩させない
- 環境変数ファイルは`.gitignore`に追加
- 定期的にアクセストークンを更新

### 取引制限
- 取引時間: 平日9:00-15:00
- 取引上限: 設定した上限を超えない
- リスク管理: ストップロス・テイクプロフィットの設定

### 監視
- 24時間監視システムの構築
- 取引ログの定期確認
- 異常時のアラート設定

## トラブルシューティング

### よくある問題
1. **認証エラー**: アプリケーションIDとシークレットの確認
2. **トークン期限切れ**: リフレッシュトークンで更新
3. **取引エラー**: 口座残高と取引上限の確認
4. **接続エラー**: ネットワーク接続の確認

### サポート
- 楽天証券APIサポート: https://api.rakuten-sec.co.jp/support
- 技術的な質問: サポートフォームから問い合わせ
- 緊急時: 楽天証券カスタマーサポート（0120-889-100）

---

**楽天証券APIの設定が完了したら、自動売買システムの本格運用を開始できます！**
