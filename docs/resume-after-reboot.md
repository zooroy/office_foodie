# 重開機後接續

更新日期：2026-10-12。

## 目前進度

- 專案：`D:\roy_space\office_foodie`。
- OpenSpec change：`office-group-ordering`，目前完成 45/52 項任務（第 1–9 階段、10.1–10.5 與 11.1）。
- pnpm monorepo、Nest API、Next.js + Tailwind + shadcn/ui 骨架已建立。
- PostgreSQL 17.11 已安裝至 `.local/pgsql`；資料在 `.local/pgdata`。
- 開發資料庫 `office_foodie`、測試資料庫 `office_foodie_test` 已建立。
- Prisma 空 migration 已套用，`migrate status` 驗證通過。
- 連線資訊在 `apps/api/.env`，密碼與資料庫檔案均被 Git 忽略。
- Docker Compose 已建置並啟動；375px 瀏覽器驗證首頁與跨網域 API 健康檢查均為 200，無頁面錯誤或橫向溢出。

## 目前阻礙

Docker 問題已排除：資料檔確認位於 `D:\DockerData\DockerDesktopWSL`，
Compose 的 PostgreSQL 與 API 為 healthy，web 已啟動。
GitHub 權限已排除，已成功 push；CI run `38212020991` 執行成功。
資料模型、共用 DTO、Postgres e2e factory、身份工具、Guard、加入/恢復身份 API 與前端憑證工具均已完成。
使用者已確認：任何揪團引用餐廳時禁止刪除，包含結案與取消。餐廳 CRUD、搜尋、菜單 API、手機前端均已完成。
Gemini 已以真實 API key 驗證範例菜單，辨識排骨飯 110 元、雞腿飯 120 元。上傳、DB 每日次數限制、前端壓縮與人工確認、揪團 API 與主揪 UI 均已完成。
使用者已確認負數金額規則：拒絕點餐變更，提示主揪先調整折扣；原訂單與折扣保持不變。
點餐、競態鎖定、Socket.IO 即時同步、統計、調整額與付款均已完成。
最新驗證：16 個測試 suite、129 項測試通過；手機兩視窗驗證即時同步、斷線恢復、複製彙總與付款確認通過；前端正式建置成功。
示範資料可重複載入、受保護的重置 API、5 筆模擬下單與模式入口、3 秒喚醒與 90 秒逾時重試均已驗證。
Neon 已建立，pooled 與 direct 連線已驗證，3 個 migration 套用成功，示範資料為 3 家餐廳、9 個品項、2 個揪團、10 位參與者。
正式資料庫憑證位於未追蹤的 `apps/api/.env.production.local`；本機開發 `.env` 保持原設定。
下一步帶使用者建立 Render 後端，再建立 Vercel 前端。
`render.yaml`、`apps/web/vercel.json`、`.github/workflows/demo-reset.yml` 已準備；詳見 `docs/deployment.md`。
10.6 的實際 workflow dispatch 需部署網址與 GitHub secrets，尚未勾選。11.2–12.3 亦尚未完成。

以下為搬移前的故障紀錄：

最新狀態：Docker 的 Client、Server 與 Compose 已可用，WSL 元件問題已解決。
實際執行 Compose 建置時，C 槽可用空間降至 0，Docker 在解壓映像時回報
`read-only file system`，引擎之後中斷（EOF）。D 槽仍有約 55 GB 可用。
需先透過 Docker Desktop 的 Settings → Resources → Advanced → Disk image location
將 Docker 資料移至 D 槽，再重啟引擎並重跑 Compose 驗證。

Git 遠端已設定為 `https://github.com/zooroy/office_foodie.git`；已 commit 並成功 push。
CI workflow 已建立，本機 Jest 2 個 suite／8 個測試、lint、typecheck 均通過。
故障發生時任務 1.5 與 1.6 尚未勾選；目前 1.5 已驗證完成，1.6 待 GitHub Actions 驗證。

以下為先前已排除的 WSL 問題紀錄：

Docker Desktop 已安裝，但 `docker version` 與 `hello-world` 回傳 engine HTTP 500。
本機檢查：WSL 3.0.1 已安装，但 `wsl --list --verbose` 回傳
`Wsl/WSL_E_WSL_OPTIONAL_COMPONENT_REQUIRED`。

使用者正在依指示，用管理員 PowerShell 啟用以下 Windows 元件，然後重開機：

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

## 重開機後

1. 開啟 Docker Desktop，等待引擎啟動。
2. 檢查 `wsl --list --verbose`、`docker version`、`docker run --rm hello-world`。
3. Docker 就緒後，接續 `$openspec-apply-change office-group-ordering`，從目前未完成任務接續。
4. 如需本機 PostgreSQL，先在專案根目錄執行：

```powershell
npx --yes pnpm@10.28.2 db:start
```

本機 API 與 web 程序會因重開機停止；啟動方式見 `docs/local-development.md`。
Compose 的 PostgreSQL 使用主機埠 5433；本機 PostgreSQL 使用 5432。
前後端使用 3000 與 3001，啟動 Compose 前確認這兩個埠沒有被本機程序佔用。
