# Tasks

## 1. 專案骨架與開發環境

- [x] 1.1 建立 pnpm workspaces monorepo（`apps/web`、`apps/api`、`packages/shared`），設定共用的 TypeScript、ESLint、Prettier；驗證：在根目錄執行 `pnpm install` 與 `pnpm -r lint` 成功
- [x] 1.2 以 Nest CLI 建立 `apps/api`，加上 `/health` 端點、全域 zod 驗證 pipe、統一錯誤格式 `{ code, message }`；驗證：`GET /health` 回傳 200
- [x] 1.3 以 create-next-app 建立 `apps/web`（App Router、TypeScript、Tailwind），安裝 shadcn/ui 並設定主色與圓角的 CSS 變數 token；驗證：首頁能顯示 shadcn Button
- [x] 1.4 在 `apps/api` 設定 Prisma，`DATABASE_URL` / `DIRECT_URL` 分開；驗證：`prisma migrate dev` 能在本機 Postgres 建立空的 migration
- [x] 1.5 撰寫 `docker-compose.yml`（postgres、api、web）與各 app 的 Dockerfile，api 預設使用 `MENU_EXTRACTOR=mock`；驗證：`docker compose up` 後瀏覽器可開啟 web，web 能打到 api 的 `/health`
- [x] 1.6 建立 `.github/workflows/ci.yml`：install → lint → typecheck → test（含 Postgres service container）→ build；驗證：push 到 GitHub 後 CI 通過

## 2. 資料模型與共用型別

- [x] 2.1 依 design D3 撰寫 Prisma schema（Restaurant、MenuItem、Group、Participant、OrderItem、ExtractionUsage 及 enum）並產生 migration；驗證：`prisma migrate dev` 成功，unique 約束 `(groupId, nicknameKey)` 存在
- [x] 2.2 在 `packages/shared` 定義 zod schema 與 DTO 型別（餐廳、品項、揪團、點餐、付款、錯誤碼）與即時事件名稱與 payload 型別；驗證：web 與 api 都能 import 且 typecheck 通過
- [x] 2.3 建立 e2e 測試基礎（獨立的測試資料庫、每個測試前清空資料表、supertest app factory）；驗證：一個呼叫 `/health` 的 e2e 測試通過

## 3. 參與者身份與權限（participant-identity）

- [x] 3.1 實作 token / secret 產生、SHA-256 雜湊與 constant-time 比對工具，以及暱稱正規化；驗證：單元測試涵蓋暱稱 trim、大小寫、空白與長度限制
- [x] 3.2 實作 `ParticipantGuard`（`X-Participant-Token`）與 `AdminGuard`（`X-Admin-Secret`）；驗證：e2e 測試確認錯誤或缺少憑證時回傳 401/403
- [x] 3.3 實作 `POST /groups/:slug/participants` 與 `GET /groups/:slug/me`；驗證：e2e 測試涵蓋成功加入、暱稱重複被拒、以 token 取回身份
- [x] 3.4 前端實作依 slug 保存 token 的 localStorage 工具（包在 try/catch 中），以及從 URL fragment 讀取管理 secret 的邏輯；API client 自動帶上對應 header；驗證：元件測試或手動確認重新整理後身份仍保留

## 4. 餐廳與菜單庫（restaurant-menu）

- [x] 4.1 實作餐廳 CRUD 與名稱搜尋 API；驗證：e2e 測試涵蓋建立、名稱必填、關鍵字篩選
- [x] 4.2 實作菜單品項的新增、修改、軟刪除，以及批次寫入（`PUT /restaurants/:id/items`）；驗證：e2e 測試涵蓋價格驗證（負數、小數被拒）與刪除後不再出現在菜單中
- [x] 4.3 前端實作餐廳列表與搜尋頁、新增餐廳表單；驗證：手機寬度（375px）下操作正常
- [x] 4.4 前端實作菜單編輯頁（依分類分組、逐筆新增編輯刪除）；驗證：手動新增 3 個品項後重新整理仍存在

## 5. 拍照辨識菜單（menu-extraction）

- [x] 5.1 定義 `MenuExtractor` 介面，實作 `MockMenuExtractor`，以 `MENU_EXTRACTOR` 環境變數切換 provider；驗證：單元測試確認 mock 模式下注入的是 mock 實作
- [x] 5.2 實作 `GeminiMenuExtractor`（JSON Schema 結構化輸出、zod 驗證、30 秒逾時、錯誤轉換為 `EXTRACTION_FAILED`）；驗證：以真實 API key 對一張範例菜單照片手動測試，並對回應解析邏輯撰寫單元測試
- [x] 5.3 實作 `POST /menu-extractions`（multer memory storage、格式與大小檢查、1–5 張、不寫入任何儲存空間）；驗證：e2e 測試（mock 模式）涵蓋成功、PDF 被拒、超過 5 MB 被拒
- [x] 5.4 實作 DB-backed 的每 IP 每日次數限制與全站每日上限，設定 `trust proxy`；驗證：e2e 測試確認第 6 次回傳 `EXTRACTION_LIMIT`
- [x] 5.5 前端實作拍照或選圖上傳（瀏覽器端壓縮到長邊 1600px）、辨識中狀態、可編輯的確認表格（可疑品項加上標示）、確認後批次寫入；失敗或超過上限時顯示訊息並提供「改為手動輸入」；驗證：mock 模式下走完上傳→修改→確認→菜單更新的流程

## 6. 揪團與狀態流轉（group-order）

- [x] 6.1 實作狀態轉換表與 `transition()`；驗證：單元測試涵蓋所有合法轉換，以及數個非法轉換被拒
- [x] 6.2 實作 `POST /groups`（隨機 slug、管理 secret 只回傳一次）、`GET /groups?status=OPEN`、`GET /groups/:slug`（公開快照不含 secret 或 token）；驗證：e2e 測試確認回應中沒有 secret 欄位
- [x] 6.3 實作 `POST /groups/:slug/transitions`（發布時檢查菜單不為空）與 `PATCH /groups/:slug`（只有草稿狀態可以換餐廳）；驗證：e2e 測試涵蓋空菜單發布被拒、開放後換餐廳被拒、非主揪操作被拒
- [x] 6.4 前端實作首頁（開放中的揪團列表、開團按鈕）與開團流程（選擇或新增餐廳 → 填寫資訊 → 顯示分享連結與管理連結，並提醒保存管理連結）；驗證：手動完成一次開團
- [x] 6.5 前端實作主揪管理頁的狀態操作（發布、結單、已訂購、結案、取消，加上確認對話框）、編輯揪團資訊、分享連結 QR code；驗證：手動完成從草稿到結案的狀態流轉

## 7. 點餐（order-placement）

- [x] 7.1 實作下單、修改、刪除 API（保存品名與單價快照、數量與備註驗證、本人或主揪權限、非開放狀態只有主揪可以變更）；驗證：e2e 測試涵蓋快照在菜單改價後不變、修改他人點餐被拒、結單後參與者下單被拒
- [x] 7.2 在下單與狀態變更中以 `SELECT ... FOR UPDATE` 鎖定 Group 列；驗證：e2e 測試同時送出結單與多筆下單，確認結單後沒有新的點餐寫入
- [x] 7.3 前端實作點餐頁：暱稱輸入、依分類列出的菜單（點按加入、數量、備註）、我的點餐（可修改刪除）、全團點餐列表、底部固定的小計列；驗證：手機寬度下完成點兩樣餐點並修改其中一樣
- [x] 7.4 前端實作主揪代改點餐（在管理頁為指定參與者新增、修改、刪除）；驗證：手動確認結單後主揪仍可刪除某人的點餐

## 8. 即時更新（realtime-updates）

- [x] 8.1 實作 Socket.IO gateway：`join` 時加入 `group:{slug}` room 並立即回傳快照；CORS 只允許前端網域；驗證：e2e 測試用 socket.io-client 連線 join 後收到快照
- [x] 8.2 在加入、點餐、揪團資訊與狀態、付款、調整額等寫入的 transaction commit 後，emit 對應事件並附上完整公開快照；驗證：e2e 測試確認兩個連線中，只有同一揪團的連線收到事件，且 payload 不含 secret 或 token
- [x] 8.3 前端以 TanStack Query 搭配 socket 事件 `setQueryData` 覆蓋快照，重連後重新 join；結單時立即停用點餐操作；驗證：手動開兩個瀏覽器視窗，一邊下單另一邊 2 秒內更新；中斷網路再恢復後畫面同步

## 9. 統計與付款（order-summary、payment-tracking）

- [x] 9.1 實作金額計算模組：依品項彙總、依人員應付金額（餐點小計 + 調整額）、不可為負的檢查；驗證：單元測試涵蓋多人點同一品項的合併、沒點餐者不列入、調整後為負被拒
- [x] 9.2 實作 `GET /groups/:slug/summary`（含應收、已收、未收，已收只計「已確認」）與 `PATCH /participants/:id/adjustment`；驗證：e2e 測試確認調整後統計即時變化
- [x] 9.3 實作 `PATCH /participants/:id/payment`：只允許在結單或已訂購狀態變更；參與者只能在未付與已回報之間切換，主揪可以設定任一狀態；驗證：e2e 測試涵蓋開放期間被拒、參與者設為已確認被拒
- [x] 9.4 前端實作主揪統計頁：依品項彙總（含複製純文字按鈕）、依人員清單（調整額輸入、付款狀態切換）、應收已收未收、全部收齊時提示結案；驗證：手動確認複製的文字內容正確
- [x] 9.5 前端在點餐頁顯示結單後的個人應付金額與「我已付款」或撤回按鈕；驗證：手動確認回報後主揪頁即時顯示待確認

## 10. Demo 體驗（demo-experience）

- [ ] 10.1 撰寫 `prisma/seed.ts`（3 家以上餐廳與完整菜單、固定 slug 的開放 demo 揪團（至少 5 位參與者）、已結單且部分付款的揪團），可重複執行；驗證：`prisma db seed` 執行兩次都成功，資料正確
- [ ] 10.2 實作 `DEMO_MODE` 開關，以及受 `X-Demo-Reset-Token` 保護的 `POST /demo/reset`（重用 seed 邏輯）；驗證：e2e 測試確認沒有 token 時被拒、demo 模式關閉時回傳 404、重置後 demo 揪團回到開放狀態
- [ ] 10.3 實作 `POST /demo/groups/:slug/simulate`：每 2–4 秒以模擬參與者下一筆隨機點餐，共 5 筆，只限開放狀態，同一團同時只能有一個模擬；驗證：e2e 測試使用 fake timers 確認產生 5 筆點餐，結單狀態下被拒
- [ ] 10.4 前端在 demo 模式下於首頁顯示「以主揪身份體驗」入口、在管理頁顯示「模擬同事下單」按鈕，並提示「開兩個視窗試試看」；驗證：`NEXT_PUBLIC_DEMO_MODE=false` 時這些入口都不出現
- [ ] 10.5 前端實作後端喚醒畫面（3 秒內 `/health` 沒有回應就顯示、每 3 秒重試、90 秒逾時顯示重試按鈕、就緒後自動進入原頁面）；驗證：本機先停掉 api 再開啟 web，確認畫面依序出現，啟動 api 後自動進入
- [ ] 10.6 建立 GitHub Actions 排程 workflow，每日呼叫 `/demo/reset`；驗證：以 `workflow_dispatch` 手動觸發一次並成功

## 11. 部署

- [ ] 11.1 建立 Neon 資料庫，取得 pooled 與 direct 連線字串；驗證：從本機以 direct URL 執行 `prisma migrate deploy` 成功
- [ ] 11.2 部署 api 到 Render（Docker、啟動前執行 migration、設定環境變數：DB、`GEMINI_API_KEY`、`MENU_EXTRACTOR=gemini`、`CORS_ORIGIN`、`DEMO_MODE`、reset token），並執行 seed；驗證：公開網址的 `/health` 回傳 200
- [ ] 11.3 部署 web 到 Vercel（root directory 設為 `apps/web`，設定 `NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_DEMO_MODE`）；驗證：公開網址可開啟首頁並看到 demo 揪團
- [ ] 11.4 在 GitHub 設定排程 workflow 需要的 secrets（API 網址、reset token）；驗證：手動觸發 reset workflow 成功

## 12. 整合驗證與作品集文件

- [ ] 12.1 在線上環境完整走一次：開團 → 拍照辨識並確認菜單 → 兩支手機以暱稱加入點餐（觀察即時更新）→ 結單 → 統計與複製 → 調整金額 → 回報與確認付款 → 結案；驗證：每一步都符合 specs 的情境，發現的問題回到對應的任務群組修正
- [ ] 12.2 撰寫 README：專案介紹、功能列表、線上 demo 連結與冷啟動說明、架構圖、技術選型理由（引用 design 的決策）、本機 `docker compose up` 的執行方式、CI badge；驗證：照著 README 在一台乾淨的機器上可以把專案跑起來
- [ ] 12.3 用 ScreenToGif 錄製示範 GIF（兩個視窗並排展示即時更新，以及拍照辨識流程），嵌入 README；驗證：在 GitHub 頁面上 GIF 能正常播放

## Workflow follow-up

- 全部任務完成並驗收後，以 `/opsx:archive` 封存此 change，讓 specs 成為專案的正式 spec。
- 第二輪「視覺精修」（品牌感、動畫、空狀態、深色模式）另開新的 change。
