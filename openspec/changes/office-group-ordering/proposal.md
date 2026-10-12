# Proposal

## Why

辦公室揪團訂午餐目前靠聊天群組接龍，主揪要人工整理誰點了什麼、加總品項打給店家、再逐一追款，容易漏單、算錯、催不到錢。這個專案打造一個「開連結、輸入暱稱就能點」的揪團點餐系統，同時作為可公開 demo 的全端作品集（Next.js + NestJS + PostgreSQL）。

## What Changes

- 新增揪團功能：任何人都能開團，開團者取得帶 secret 的管理連結；可同時存在多個進行中的團；由主揪手動結單（截止時間僅供顯示，不自動結單、不重新開放）。
- 新增免登入身份：參與者輸入暱稱即可點餐，瀏覽器 token 記住身份；換裝置後無法自行改單，由主揪代改。
- 新增餐廳與菜單庫：建立過的餐廳與菜單會保存，下次開團可直接套用；品項只有品名與價格（餐點類，無客製化選項）。
- 新增拍照辨識菜單：上傳菜單照片，由 AI 視覺模型（預設 Gemini Flash 免費方案，可抽換供應商）辨識成品項清單，經人工確認後才儲存；照片不保存；有使用次數限制，失敗時引導改為手動輸入。
- 新增點餐：可點多個品項，每項含數量與備註；結單前可修改；訂單保存品項名稱與價格快照。
- 新增即時更新：同一揪團的所有參與者即時看到點餐變化與結單狀態。
- 新增統計：依品項彙總（給店家）與依人員列出（收款用）；主揪可手動調整個人金額。
- 新增付款追蹤：僅記帳，主揪可標記已付/未付，參與者可自行標記「我已付款」。
- 新增 demo 體驗：種子資料、模擬同事下單、後端冷啟動喚醒畫面。
- 工程與作品集配套（不涉及 spec 行為）：Tailwind + shadcn/ui 手機優先的設計基礎、Docker Compose 本機環境、GitHub Actions CI、README 與示範 GIF、部署至 Vercel + Render + Neon。

## Capabilities

### New Capabilities
- `participant-identity`: 以暱稱加瀏覽器 token 識別參與者，以及主揪管理連結的權限辨識。
- `restaurant-menu`: 餐廳與菜單庫的建立、手動編輯與在開團時套用。
- `menu-extraction`: 從菜單照片辨識出品項清單、人工確認流程、使用次數限制與失敗後備。
- `group-order`: 揪團的建立、狀態流轉（草稿、開放、結單、已訂購、結案、取消）與主揪管理操作。
- `order-placement`: 參與者在揪團中新增、修改、刪除自己的點餐，以及主揪代改。
- `realtime-updates`: 揪團內點餐與狀態變更的即時廣播。
- `order-summary`: 依品項彙總、依人員列出應付金額與個人金額調整。
- `payment-tracking`: 每位參與者的付款狀態記錄與標記。
- `demo-experience`: 種子資料、模擬同事下單與後端喚醒等待畫面。

### Modified Capabilities

（無，專案尚無既有 spec）

## Impact

- 全新專案，建立 monorepo：`apps/web`（Next.js）、`apps/api`（NestJS）、PostgreSQL（Prisma）。
- 外部依賴：Gemini API（免費方案，需 API key）、Socket.IO、`@nestjs/throttler`、Tailwind CSS、shadcn/ui。
- 部署：Vercel（前端）、Render 免費方案（後端，會休眠）、Neon 免費 Postgres。
- 不在範圍內：外送費與分攤、登入/帳號系統、飲料客製化選項、自動結單與重新開放、金流串接、照片保存、品牌化視覺精修與深色模式（另開 change）。
