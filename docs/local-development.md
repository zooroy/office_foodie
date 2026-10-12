# 本機開發環境

專案使用 Node.js、pnpm 與 PostgreSQL。目前 Windows 的 PostgreSQL 17 安裝在 `.local/pgsql`，資料在 `.local/pgdata`，不會提交到 Git。

## 啟動與停止資料庫

在專案根目錄執行：

```powershell
npx --yes pnpm@10.28.2 db:start
npx --yes pnpm@10.28.2 db:status
npx --yes pnpm@10.28.2 db:stop
```

資料庫只監聽 `127.0.0.1:5432`。重新開機後先執行 `db:start`。

## 連線設定與 migration

`apps/api/.env` 保存這台機器的開發連線設定，不會提交到 Git。`DATABASE_URL` 給應用程式使用，`DIRECT_URL` 給 migration 使用；本機沒有連線池，因此兩者連至同一個資料庫。另有獨立的 `office_foodie_test` 測試資料庫。

```powershell
npx --yes pnpm@10.28.2 --filter @office-foodie/api db:migrate
npx --yes pnpm@10.28.2 --filter @office-foodie/api db:status
```

## 啟動應用程式

在兩個終端分別執行：

```powershell
npx --yes pnpm@10.28.2 --filter @office-foodie/api dev
```

```powershell
npx --yes pnpm@10.28.2 --filter @office-foodie/web dev
```

前端為 <http://localhost:3000>，API 健康檢查為 <http://localhost:3001/health>。

PostgreSQL 使用 EDB 的 Windows 二進位套件，來源見 [PostgreSQL 官方 Windows 下載頁](https://www.postgresql.org/download/windows/)。

## Docker Compose

安裝 Docker 並啟動引擎後，可在根目錄執行 `docker compose up --build`。Compose 使用自己的 PostgreSQL volume，主機連線埠是 `5433`，與前述本機 PostgreSQL 分開。API 使用 mock 辨識模式，不需要 Gemini API key。

容器版前後端同樣使用 `3000` 與 `3001`，啟動前先停止佔用這兩個埠的本機前後端程序。
