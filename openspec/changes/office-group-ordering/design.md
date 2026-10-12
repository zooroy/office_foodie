# Design

## Context

全新專案，目前只有 OpenSpec 設定，沒有任何程式碼。動機與範圍見 `proposal.md`，行為需求見 `specs/`。

主要限制：
- 作品集定位：要公開 demo、零成本營運，部署在 Vercel（前端）+ Render 免費方案（後端，閒置約 15 分鐘休眠）+ Neon 免費 Postgres。
- Render 休眠代表**後端記憶體狀態不可靠**（重啟就清空），任何需要跨請求保留的狀態都要放 DB。
- Vercel 是 serverless，無法承載長連線，所以 WebSocket 必須由 Render 上的 NestJS 直接提供。
- 免登入：身份只靠參與者 token 與管理 secret。

## Goals / Non-Goals

**Goals:**
- 前後端分離、型別共用的 monorepo，本機用一個 `docker compose up` 就能跑起完整環境。
- 狀態流轉與金額計算的邏輯集中在後端，並有單元測試覆蓋。
- AI 辨識供應商可抽換，本機開發和測試不需要真的 API key。
- 第一輪就有一致、手機優先的基本視覺（shadcn/ui），足以 demo 與錄 GIF。

**Non-Goals:**
- 水平擴展（多台後端共享 WebSocket）：單一實例即可，不導入 Redis adapter。
- 離線支援、PWA、推播通知。
- 品牌化視覺、動畫、深色模式（另開 change）。
- 多語系（介面只做繁體中文）。

## Decisions

### D1. Monorepo 結構：pnpm workspaces

```
apps/
  web/        Next.js (App Router)
  api/        NestJS
packages/
  shared/     共用型別、zod schema、即時事件名稱與 payload 型別
docker-compose.yml
.github/workflows/ci.yml
```

- `packages/shared` 讓前後端共用 DTO 與事件型別，避免兩邊各寫一份而不同步。
- 替代方案：Nx / Turborepo。功能更多但設定成本高；這個規模用 pnpm workspaces 就夠，之後要加 Turborepo 做快取也很容易。

### D2. ORM：Prisma

- schema 一目了然、migration 工具成熟，型別生成可以直接用在 Nest service。
- 搭配 Neon：`DATABASE_URL` 使用 pooled 連線（給應用程式），`DIRECT_URL` 使用直連（給 `prisma migrate`）。
- 替代方案：TypeORM（Nest 官方範例常用，但型別安全與 migration 體驗較差）、Drizzle（輕量，但生態與教學資源較少）。

### D3. 資料模型

```
Restaurant (id, name, phone?, address?, createdAt)
  1--* MenuItem (id, restaurantId, name, price:Int, category?, sortOrder, deletedAt?)

Group (id, slug, title, restaurantId, status, deadlineAt?,
       note?, adminSecretHash, isDemo, createdAt)
  1--* Participant (id, groupId, nickname, nicknameKey, tokenHash, joinedAt,
                   adjustment:Int, paymentStatus)
         1--* OrderItem (id, participantId, menuItemId?, nameSnapshot,
                         unitPriceSnapshot:Int, quantity, note?, createdAt)

ExtractionUsage (ip, date, count)   -- 辨識次數，存 DB 以免休眠後被清空
```

- **金額一律 Int（元）**，不使用浮點數。
- `MenuItem` 用軟刪除（`deletedAt`），讓 `OrderItem.menuItemId` 仍可追溯；但金額計算只看快照欄位。
- `nicknameKey` = 正規化後的暱稱（trim、小寫），搭配 `(groupId, nicknameKey)` unique 約束保證不重複。
- 付款狀態與調整額放在 `Participant` 上：一位參與者在一個揪團只有一個應付金額，不需要另開 Payment 表。
- `Group.status` enum：`DRAFT | OPEN | CLOSED | ORDERED | SETTLED | CANCELLED`。
- 應付金額**不落地儲存**，每次讀取時由點餐快照與調整額即時計算，避免點餐變動時資料不一致。

### D4. 身份與權杖

- **揪團網址用隨機 slug**（nanoid，10 字元），不暴露流水號 ID，避免被逐一猜測。
- **參與者 token**：加入時產生 32 bytes 隨機字串，DB 只存 SHA-256 雜湊；前端以 `localStorage` 依 slug 分別保存，API 請求帶 `X-Participant-Token` header。
- **管理 secret**：同樣只存雜湊。管理連結格式為 `/g/{slug}/admin#{secret}`，**把 secret 放在 URL fragment**，因為 fragment 不會送到伺服器 log，也不會出現在 Referer 中。前端讀出 fragment 後存進 `localStorage`，之後以 `X-Admin-Secret` header 送出。
- Nest 用兩個 Guard（`ParticipantGuard`、`AdminGuard`）實作權限，比對時使用 constant-time compare。
- 替代方案：cookie。但前端（Vercel）與後端（Render）不同網域，會遇到第三方 cookie 限制；header 方式最單純。

### D5. 狀態機與結單競態

- 狀態流轉集中在 `GroupService.transition(from, to)`，以一張允許轉換表判斷，非法轉換一律拋出 409。
- **結單競態**：點餐寫入與狀態變更都在 transaction 中以 `SELECT ... FOR UPDATE` 鎖住 `Group` 那一列，再檢查狀態。結單與下單會因此被序列化：下單要嘛在結單前完成，要嘛看到 `CLOSED` 而被拒絕。
- 替代方案：樂觀鎖（version 欄位）。同樣可行，但衝突時需要重試邏輯；這個規模用列鎖最直觀。

### D6. 即時更新：Socket.IO + 每團一個 room

- Nest `@WebSocketGateway`，客戶端連線後送出 `join` 事件並帶上 slug，伺服器把連線加入 `group:{slug}` room。
- **只做單向推播**：所有寫入一律走 REST，寫入的 transaction commit 成功後，才 emit 事件到 room。WebSocket 不接受寫入，權限檢查只需維護一套（REST Guard）。
- 事件（型別定義在 `packages/shared`）：`participant.joined`、`order.changed`、`group.updated`、`payment.updated`。
- **Payload 策略**：事件只帶「變更後該揪團的完整公開快照」，而不是 diff。以每團幾十筆的資料量，快照只有幾 KB；前端直接覆蓋狀態即可，避免 diff 合併出錯，也讓「斷線重連」與「收到事件」走同一條路徑。
- **斷線重連**：Socket.IO 會自動重連；重連後客戶端重新 `join`，伺服器立即回傳最新快照。
- 前端用 TanStack Query 管理 server state：REST 取得初始資料，收到事件就呼叫 `setQueryData` 覆蓋。
- 跨網域：Socket.IO 直接連到 Render 的網址，指定 `transports: ['websocket']`，CORS 只允許前端網域。

### D7. 菜單辨識：`MenuExtractor` 介面 + Gemini 實作

```
interface MenuExtractor {
  extract(images: Buffer[], mimeTypes: string[]): Promise<ExtractedItem[]>
}
  - GeminiMenuExtractor   正式環境（Gemini Flash 免費方案，JSON Schema 結構化輸出）
  - MockMenuExtractor     本機開發與測試，回傳固定的假菜單
```

- 以環境變數 `MENU_EXTRACTOR=gemini|mock` 決定注入哪個實作（Nest custom provider）。
- **照片不落地**：multer 使用 memory storage，Buffer 用完即丟，不寫入磁碟或任何儲存服務。
- **前端先壓縮**：瀏覽器端把長邊縮到 1600px、轉成 JPEG 品質 0.8，減少上傳時間與 token 用量。
- Prompt 要求模型輸出 `{ items: [{ name, price, category? }] }`，後端再用 zod 驗證；價格無法解析的品項保留下來，但標記為需要人工確認。
- **次數限制存 DB**（`ExtractionUsage`），不使用 `@nestjs/throttler` 預設的記憶體儲存，因為 Render 休眠重啟就會清空計數。另外設一個**全站每日總上限**（例如 100 次）作為第二道保護，守住免費額度。
- 取得真實 IP：Render 位於 proxy 後方，需要設定 Express `trust proxy`，從 `X-Forwarded-For` 取得來源 IP。
- 逾時 30 秒，逾時或錯誤時回傳可辨識的錯誤碼，讓前端導向手動輸入。

### D8. API 概要（REST）

```
GET    /health
GET    /restaurants?q=             POST /restaurants
GET    /restaurants/:id            PATCH /restaurants/:id
POST   /restaurants/:id/items      PATCH/DELETE /menu-items/:id
DELETE /restaurants/:id            (僅限未被任何揪團引用；包含歷史團的引用皆禁止刪除)
PUT    /restaurants/:id/items      (確認辨識結果後批次寫入)
POST   /menu-extractions           (multipart，回傳辨識結果，不寫入)

POST   /groups                     -> { slug, adminSecret }
GET    /groups?status=OPEN
GET    /groups/:slug               (公開快照)
PATCH  /groups/:slug               [admin]
POST   /groups/:slug/transitions   [admin] { to }
POST   /groups/:slug/participants  -> { participantToken }
GET    /groups/:slug/me            [participant]
POST   /groups/:slug/orders        [participant|admin]
PATCH/DELETE /orders/:id           [participant 本人 | admin]
PATCH  /participants/:id/payment   [participant 本人（限未付/已回報）| admin]
PATCH  /participants/:id/adjustment [admin]
GET    /groups/:slug/summary

POST   /demo/groups/:slug/simulate [admin, demo 模式]
POST   /demo/reset                 [X-Demo-Reset-Token, demo 模式]
```

- 統一錯誤格式 `{ code, message }`，`code` 是給前端判斷用的穩定字串（例如 `GROUP_CLOSED`、`NICKNAME_TAKEN`、`EXTRACTION_LIMIT`）。
- 輸入驗證使用 `packages/shared` 的 zod schema，前後端共用同一套規則。

### D9. Demo 功能實作

- **種子資料**：`prisma/seed.ts`，同時被 `prisma db seed` 與 `/demo/reset` 重用。demo 揪團使用固定 slug 與固定的管理 secret（只在 demo 模式下由首頁公開）。
- **模擬同事下單**：後端收到請求後，以 `setTimeout` 依序建立 5 位「模擬同事」並各下一筆隨機點餐，每筆都走正常的下單 service，所以會觸發即時推播。同一個揪團同時只允許一個模擬在進行。後端如果在模擬途中重啟，剩下的筆數就直接放棄，這是可以接受的。
- **每日重置**：GitHub Actions 排程（每日一次）呼叫 `/demo/reset`，順便喚醒後端。Render 休眠時 Nest 內建的排程器不會執行，所以不能依賴 `@nestjs/schedule`。
- **喚醒畫面**：Next.js 在 root layout 的 client 元件中先打 `/health`；3 秒內沒有回應就顯示喚醒畫面，每 3 秒重試一次，90 秒後顯示逾時。
- `DEMO_MODE=true|false` 環境變數控制所有 demo 入口，前端透過 `NEXT_PUBLIC_DEMO_MODE` 取得。

### D10. 前端與設計基礎

- Next.js App Router；頁面以 client component 為主（即時互動），只有首頁列表可用 server component 搭配 revalidate。
- **Tailwind CSS + shadcn/ui**；以 CSS 變數定義主色與圓角，第二輪精修時只需調整 token。
- **手機優先**：以 375px 寬度為基準設計，桌面版做成置中的單欄或兩欄。
- 主要畫面：

| 路徑 | 畫面 | 重點 |
|---|---|---|
| `/` | 首頁 | 開放中的揪團列表、「開團」按鈕、demo 入口 |
| `/groups/new` | 開團 | 選擇或新增餐廳 → 填標題、截止時間、備註 |
| `/restaurants/:id/menu` | 菜單編輯 | 手動逐筆編輯、「拍照辨識」入口、辨識結果確認表格 |
| `/g/:slug` | 點餐頁 | 暱稱輸入、依分類列出菜單（點按加入）、我的點餐、全團點餐列表；底部固定顯示我的小計 |
| `/g/:slug/admin` | 主揪管理 | 狀態操作按鈕、分享連結 QR code、依品項與依人員統計、調整額、付款狀態 |

### D11. 測試與 CI

- **單元測試（Jest）**：狀態轉換表、應付金額計算（含調整額）、暱稱正規化。
- **e2e 測試（Jest + supertest）**：連線到真實的 Postgres（CI 使用 service container），涵蓋開團→點餐→結單→統計→付款的完整流程，以及結單競態與權限拒絕的情境。
- **前端**：關鍵元件做少量的 React Testing Library 測試；端對端 UI 測試（Playwright）列為加分項目，不是必做。
- **GitHub Actions**：在 push 和 PR 時執行 install → lint → typecheck → test（含 Postgres service）→ build。

### D12. 部署

| 元件 | 平台 | 設定重點 |
|---|---|---|
| web | Vercel | Root directory 設為 `apps/web`；`NEXT_PUBLIC_API_URL` 指向 Render |
| api | Render Web Service（Docker） | 啟動前執行 `prisma migrate deploy`；`CORS_ORIGIN` 設為 Vercel 網域 |
| db | Neon | pooled URL 給 `DATABASE_URL`，direct URL 給 `DIRECT_URL` |
| 排程 | GitHub Actions | 每日呼叫 `/demo/reset` |

本機的 `docker-compose.yml` 包含 postgres、api、web 三個服務，api 預設使用 `MENU_EXTRACTOR=mock`，沒有 API key 也能跑。

## Risks / Trade-offs

- [Render 冷啟動 30–60 秒，第一印象不佳] → 加上喚醒畫面（D9）；README 說明原因；每日排程也會順便喚醒一次。
- [Gemini 免費方案的額度或條款變動] → 介面可抽換（D7），改用 Groq 或 OpenRouter 只需新增一個實作與改環境變數；辨識失敗一律導向手動輸入。
- [公開 demo 被濫用，例如大量開團或灌點餐] → 辨識有雙層次數限制；一般 API 加上寬鬆的全域 rate limit；每日重置 demo 資料。正式資料沒有保護需求（只是作品集），可以接受。
- [暱稱制可以冒名，換裝置後無法改單] → 已接受的取捨；主揪可以代改點餐。
- [單一後端實例，WebSocket 無法水平擴展] → 作品集與辦公室規模不需要；之後如有需要，可加上 Socket.IO Redis adapter。
- [事件 payload 帶完整快照，資料量比 diff 大] → 每團只有幾 KB，換來實作簡單與一致性，值得。
- [Neon 閒置後自動休眠] → 喚醒約 1 秒內，影響很小；Prisma 連線設定足夠的 connect timeout。
- [AI 把價格辨識錯] → 強制人工確認（spec 要求），確認表格中標示可疑的品項。

## Migration Plan

全新專案，沒有既有資料需要遷移。部署順序：建立 Neon DB → 部署 Render（執行 migration 與 seed）→ 部署 Vercel → 設定 GitHub Actions secrets 與排程。出問題時，Vercel 和 Render 都可以一鍵回滾到前一個部署版本。

## Open Questions

- 專案與網站的正式名稱，目前暫用 `office_foodie`。
- Gemini 實際要使用的模型版本，實作時依當下免費方案中可用的 Flash 模型決定。
