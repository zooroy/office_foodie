# Office Foodie

辦公室揪團點餐專案，使用 Next.js、NestJS、PostgreSQL 與 pnpm workspaces。

目前已建立前後端骨架、Prisma migration、Docker Compose 與 CI；點餐功能仍依 OpenSpec 任務逐步實作，尚未提供線上 demo。

## 在 Windows 或 Mac 啟動

先安裝並啟動 Docker Desktop；Mac 請依晶片選擇 Apple Silicon 或 Intel 版本。

```sh
git clone https://github.com/zooroy/office_foodie.git
cd office_foodie
docker compose up --build
```

- 前端：<http://localhost:3000>
- API 健康檢查：<http://localhost:3001/health>
- PostgreSQL：`127.0.0.1:5433`，資料庫與本機示範帳號均為 `office_foodie`。

Compose 會執行 migration，菜單辨識預設使用 mock，不需要 Gemini API key。資料庫使用 Docker volume 保存；停止服務可執行 `docker compose down`，不加 `--volumes` 會保留資料。

## 開發與驗證

使用 Node.js 24 和 pnpm 10.28.2：

```sh
npx --yes pnpm@10.28.2 install --frozen-lockfile
npx --yes pnpm@10.28.2 -r lint
npx --yes pnpm@10.28.2 -r typecheck
npx --yes pnpm@10.28.2 --filter @office-foodie/api test
```

詳細本機啟動方式見 [開發環境說明](docs/local-development.md)。各電腦的 `.env`、資料庫內容與 `.local` 不會隨 Git 搬移；需要保留資料時另行匯出、匯入。

## 接續實作

規格與進度位於 `openspec/changes/office-group-ordering/`。在可讀取專案的 Codex 對話使用：

```text
$openspec-apply-change office-group-ordering
```

CI 在 push 與 pull request 執行安裝、lint、型別檢查、資料庫 migration、測試及建置。
