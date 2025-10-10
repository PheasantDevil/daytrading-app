# Terminal セットアップガイド

## pyenv エラーの解消

### 問題
```
/Users/konishikenji/.zshrc:112: command not found: pyenv
```

### 原因
pyenvがインストールされていない環境で、無条件に`eval "$(pyenv init - zsh)"`を実行しているため。

### 解決方法

`~/.zshrc`の112行目付近を以下のように修正：

**修正前:**
```bash
eval "$(pyenv init - zsh)"
```

**修正後:**
```bash
if command -v pyenv >/dev/null 2>&1; then 
  eval "$(pyenv init - zsh)"
fi
```

### 適用方法

```bash
# 自動修正スクリプト
cat > /tmp/fix_zshrc.sh << 'SCRIPT'
#!/bin/bash
ZSHRC="$HOME/.zshrc"
BACKUP="$HOME/.zshrc.backup.$(date +%Y%m%d_%H%M%S)"

# バックアップ作成
cp "$ZSHRC" "$BACKUP"

# pyenv関連の行を条件付きに修正
sed -i.tmp '112s|^eval "$(pyenv init - zsh)"$|if command -v pyenv >/dev/null 2>\&1; then eval "$(pyenv init - zsh)"; fi|' "$ZSHRC"

rm -f "$ZSHRC.tmp"

echo "✅ .zshrcを修正しました"
echo "📁 バックアップ: $BACKUP"
SCRIPT

bash /tmp/fix_zshrc.sh

# 変更を反映
source ~/.zshrc
```

### 確認

新しいターミナルを開いて、エラーが出ないことを確認してください。

---

## その他のセットアップ

### Node.js バージョン確認
```bash
node --version  # v18以上が必要
```

### 必要なツールのインストール
```bash
# Homebrewがない場合
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# pyenvが必要な場合
brew install pyenv
```

### トラブルシューティング

**Q: sourceコマンドでエラーが出る**
A: ターミナルを再起動してください

**Q: 他の行でもエラーが出る**
A: `~/.zshrc`のバックアップから復元して、再度修正してください
