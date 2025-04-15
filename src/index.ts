import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import MiniSearch from "minisearch";
import fg from "fast-glob";
import fs from "fs/promises";
import path from "path";

// インデックス用型
interface DocRecord {
  id: string; // ファイルパス
  title: string;
  body: string;
}

// docsディレクトリのパスをコマンドライン引数で指定可能に（絶対パス化）
const DOCS_DIR = path.resolve(process.argv[2] || "docs");
console.error(`[LOG] DOCS_DIR: ${DOCS_DIR}`);

// docs配下のmdファイルを全て取得
async function loadMarkdownFiles(): Promise<DocRecord[]> {
  // DOCS_DIR配下のmdファイルを再帰的に取得
  console.error(`[LOG] Searching for Markdown files in: ${DOCS_DIR}`);
  const files = await fg("**/*.md", { cwd: DOCS_DIR });
  console.error(`[LOG] Found ${files.length} Markdown files.`);
  const docs: DocRecord[] = [];
  for (const file of files) {
    const absPath = path.join(DOCS_DIR, file);
    const content = await fs.readFile(absPath, "utf-8");
    const title = content.match(/^#\s*(.+)$/m)?.[1] || path.basename(file);
    docs.push({ id: absPath, title, body: content });
  }
  return docs;
}

// MiniSearchインデックス作成
async function createIndex(): Promise<MiniSearch<DocRecord>> {
  console.error(`[LOG] Creating search index...`);
  const docs = await loadMarkdownFiles();
  const miniSearch = new MiniSearch<DocRecord>({
    fields: ["title", "body"],
    storeFields: ["id", "title", "body"],
    searchOptions: {
      boost: { title: 2, body: 1 },
      prefix: true,
      fuzzy: 0.2,
    },
  });
  miniSearch.addAll(docs);
  console.error(`[LOG] Index created with ${docs.length} documents.`);
  return miniSearch;
}

// search_docsツールの引数型
interface SearchDocsArgs {
  query: string;
  limit?: number;
}

async function main() {
  const miniSearch = await createIndex();
  const server = new Server({
    name: "md-search-server",
    version: "1.0.0",
  }, {
    capabilities: {
      tools: {},
      resources: {},
    },
  });

  // Tool: search_docs
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error(`[LOG] ListToolsRequest received`);
    return {
      tools: [
        {
          name: "search_docs",
          description: "docsディレクトリ配下のMarkdownファイルを全文検索します。",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "検索クエリ" },
              limit: { type: "number", description: "最大件数", default: 5 },
            },
            required: ["query"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    console.error(`[LOG] CallToolRequest: ${JSON.stringify(req.params)}`);
    if (req.params.name === "search_docs") {
      const args = req.params.arguments as unknown as SearchDocsArgs;
      if (!args || typeof args !== "object") {
        console.error(`[ERROR] argumentsが指定されていません`);
        throw new Error("argumentsが指定されていません");
      }
      const { query, limit = 5 } = args;
      if (typeof query !== "string") {
        console.error(`[ERROR] queryは必須です`);
        throw new Error("queryは必須です");
      }
      const results = miniSearch.search(query, { prefix: true, fuzzy: 0.2 }).slice(0, limit);
      console.error(`[LOG] search_docs: query='${query}', limit=${limit}, results=${results.length}`);
      return {
        content: [
          {
            type: "text",
            text: results.length === 0
              ? "該当するドキュメントはありません。"
              : results.map(r => `【${r.title}】\n${r.id}\n---\n${r.body.slice(0, 200)}...`).join("\n\n")
          }
        ]
      };
    }
    console.error(`[ERROR] 未知のツールが指定されました: ${req.params.name}`);
    throw new Error("未知のツールが指定されました");
  });

  // Resource: read_doc
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    console.error(`[LOG] ListResourcesRequest received`);
    // docs配下のmdファイル一覧をリスト
    const docs = await loadMarkdownFiles();
    return {
      resources: docs.map(doc => ({
        uri: `file://${doc.id}`,
        name: doc.title,
        description: doc.id,
        mimeType: "text/markdown",
      }))
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    console.error(`[LOG] ReadResourceRequest: ${JSON.stringify(req.params)}`);
    const uri = req.params.uri;
    if (!uri.startsWith("file://")) {
      console.error(`[ERROR] 無効なURIです: ${uri}`);
      throw new Error("無効なURIです");
    }
    const filePath = uri.replace("file://", "");
    const content = await fs.readFile(filePath, "utf-8");
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: content,
        }
      ]
    };
  });

  // stdioサーバー起動
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[LOG] md-search-server started");
}

main().catch(e => {
  console.error(`[FATAL] ${e}`);
  process.exit(1);
});
