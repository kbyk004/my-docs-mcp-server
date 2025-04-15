# my-docs-mcp-server

## 概要

このMCPサーバーは、指定したディレクトリ配下のMarkdown（.md）ファイルを全文検索インデックス化し、MCPプロトコル経由で検索・参照できるMCPサーバーです。

- MCPの`tools`として全文検索（search_docs）を提供
- MCPの`resources`としてファイル全文取得（read_doc）を提供
- TypeScript製

## 技術スタック・実装技術

- **TypeScript**: サーバー本体の実装言語。
- **@modelcontextprotocol/sdk**: MCPサーバーのプロトコル実装・通信に利用。
- **MiniSearch**: Markdownファイルの全文検索インデックス作成・検索に利用。軽量で高速な全文検索ライブラリ。
- **fast-glob**: docsディレクトリ配下のMarkdownファイルを再帰的に探索。
- **Node.js標準のfs/promises, path**: ファイル読み込みやパス操作。
- **Stdioサーバー**: MCPクライアント（Claude DesktopやInspector等）と標準入出力経由で通信。

## セットアップ

1. 依存パッケージのインストール

```bash
npm install
```

2. docsディレクトリの作成とMarkdownファイルの配置

```bash
mkdir docs
# 例: サンプルファイル作成
echo "# サンプル\nこれはテストです。" > docs/sample.md
```

3. TypeScriptビルド

```bash
npm run build
```

## サーバーの起動方法

### 開発用（TypeScriptを直接実行）
```bash
npm run dev -- [docsディレクトリのパス]
# 例: npm run dev -- ./docs
```

### 本番用（ビルド済みで実行）
```bash
npm start -- [docsディレクトリのパス]
# 例: npm start -- ./docs
```

- `docsディレクトリのパス`は省略可能（省略時は`docs/`が使われます）

## MCP Inspectorでの動作確認

[MCP Inspector](https://github.com/modelcontextprotocol/inspector)を使うと、GUIでサーバーのtools/resourcesをテストできます。

```bash
npm run inspect -- [docsディレクトリのパス]
# 例: npm run inspect -- ./docs
```

またはビルド済みで:
```bash
npx -y @modelcontextprotocol/inspector node build/index.js ./docs
```

## Claude Desktopでの利用例

1. Claude Desktopの設定ファイル（例: `~/Library/Application Support/Claude/claude_desktop_config.json`）を開き、以下のようにサーバーを追加します。

```json
{
  "mcpServers": {
    "docs-search": {
      "command": "node",
      "args": [
        "/path/to/docs-search/build/index.js",
        "/path/to/your-project/docs"
      ]
    }
  }
}
```

- `command`は`node`、`args`にビルド済みサーバーのパスとdocsディレクトリのパスを指定してください。
- パスは**絶対パス**推奨です。

2. Claude Desktopを再起動すると、MCPツール一覧に`search_docs`が表示されます。

## 提供ツール・リソース

### Tool: search_docs
- 概要: Markdownファイルを全文検索
- 入力: `query`（検索ワード, 必須）、`limit`（最大件数, 省略可, デフォルト5）
- 出力: 検索結果（ファイル名、パス、スニペット）

### Resource: read_doc
- 概要: ファイル全文取得
- 入力: `filePath`（MCPリソースURI経由で指定）
- 出力: ファイル全文

## ログ

サーバーは主要な処理ごとに標準エラー出力（stderr）へ詳細なログを出力します。

## ライセンス

MIT 