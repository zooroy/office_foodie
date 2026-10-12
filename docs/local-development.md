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

首次安裝或共用 DTO 修改後，先執行 `npx --yes pnpm@10.28.2 --filter @office-foodie/shared build`。

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

## API 測試

`apps/api/.env` 的 `TEST_DATABASE_URL` 必須連到獨立且名稱以 `_test` 結尾的資料庫。
測試 app factory 會先套用 migration，每個 e2e 測試前清空六張應用資料表，並拒絕使用未標示為測試用途的資料庫。

```powershell
npx --yes pnpm@10.28.2 --filter @office-foodie/api test
```

CI 使用 PostgreSQL service container，透過相同的 app factory 驗證真實資料庫。

## 菜單辨識 provider

預設 `MENU_EXTRACTOR=mock`，不需要 API key，回傳固定測試品項與需人工確認的價格。
Gemini provider 的真實驗證需先從 [Google AI Studio](https://aistudio.google.com/apikey) 建立 key，再於本機 `apps/api/.env` 設定 `GEMINI_API_KEY`。
測試真實辨識時使用 `MENU_EXTRACTOR=gemini`；`GEMINI_MODEL` 可選擇帳號可用的模型，預設為 `gemini-3.8-flash`。
實作依 [Gemini 結構化輸出文件](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) 使用 JSON Schema；解析後再次套用 Zod 驗證，無法解析的價格保留為需人工確認。
任務 5.2 已用真實 key 驗證範例圖片；需要重新驗證時，設定 key 後執行 `npx --yes pnpm@10.28.2 --filter @office-foodie/api test:gemini`。
Gemini REST `responseFormat.text.mimeType` 使用 `APPLICATION_JSON` enum，與 HTTP 的 `Content-Type: application/json` 不同，參見 [API reference](https://ai.google.dev/api/generate-content)。
此真實 API 測試不會在 CI 自動執行；CI 使用 mock/stub，不需要 key。
辨識次數以 UTC 日期存入 PostgreSQL：每 IP 預設 5 次，全站預設 100 次，可透過 `EXTRACTION_IP_DAILY_LIMIT` 與 `EXTRACTION_GLOBAL_DAILY_LIMIT` 設定。
