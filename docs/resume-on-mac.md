# 回家用 Mac 接續

記錄時間：2026-10-12，下課前暫停。

## 目前停在哪裡

- Repository：<https://github.com/zooroy/office_foodie>，分支 `main`。
- OpenSpec change：`office-group-ordering`，完成 **45/52** 項。
- 最新完整功能 CI：<https://github.com/zooroy/office_foodie/actions/runs/38223120643>，成功。
- 本機驗證：16 個 suite、129 項測試，lint、typecheck、正式建置與 Docker 手機雙視窗流程通過。
- Neon 已建立，Singapore 區域，資料庫 `neondb`；pooled 與 direct 連線均已驗證。
- Neon 已套用 3 個 migration，已載入 3 家餐廳、9 個品項、2 個示範揪團、10 位參與者。
- **Render 尚未確認部署**：使用者停在 New Web Service 的 Environment Variables 畫面，畫面顯示 $0/month。
- 已提供填寫說明，但尚未收到變數填妥、Deploy 成功或公開 URL 的確認；接續時先確認實際狀態，不要重複建立服務。
- Vercel 與 GitHub 每日重置 secrets 尚未設定，線上全流程與 GIF 尚未驗證。

## 回家後

若 Mac 尚無專案，執行：

```sh
git clone https://github.com/zooroy/office_foodie.git
cd office_foodie
```

若 Mac 已有專案，先在該資料夾檢查 `git status`；沒有未提交修改時執行 `git pull --ff-only`。若有修改，先讓 Codex 檢查，不要覆蓋。

以 Codex 開啟 Mac 上的專案資料夾，貼上：

> 請先讀 docs/resume-on-mac.md，接續 office-group-ordering。上課時完成 45/52 項，Neon migration 與 seed 已成功，停在 Render 環境變數設定畫面，請帶我繼續部署。

專案程式、OpenSpec、技能與部署設定已在 GitHub；不需重新實作。可直接在瀏覽器繼續 Render 設定，不必先啟動 Mac 的本機服務。

## Render 設定核對

登入同一個 Render 帳號，先查看是否已有 `office-foodie-api`；若建立表單未保存，重新填寫：

| 欄位 | 設定 |
| --- | --- |
| Repository | `zooroy/office_foodie` |
| Name | `office-foodie-api` |
| Language | Docker |
| Branch | `main` |
| Region | Singapore |
| Root Directory | 留空 |
| Instance Type | Free（$0/month） |
| Dockerfile Path | `apps/api/Dockerfile` |
| Docker Build Context Directory（若有） | `.` |
| Docker Command | 留空 |
| Health Check Path | `/health` |

Environment Variables：

| KEY | VALUE |
| --- | --- |
| `DATABASE_URL` | Neon Connect 中開啟 Connection pooling 的完整字串 |
| `DIRECT_URL` | 同一資料庫，關閉 Connection pooling 的完整字串 |
| `GEMINI_API_KEY` | 既有 Google AI Studio key |
| `MENU_EXTRACTOR` | `gemini` |
| `GEMINI_MODEL` | `gemini-3.8-flash` |
| `DEMO_MODE` | `true` |
| `DEMO_RESET_TOKEN` | 右側 Generate 產生，後續 GitHub secret 必須使用同一值 |
| `CORS_ORIGIN` | 暫填 `http://localhost:3000`，Vercel 部署後改成前端 origin |

VALUE 只填等號後的內容。填妥後 Deploy web service，提供公開 `https://…onrender.com` URL 讓 Codex 驗證 `/health`，再部署 Vercel。

## 憑證與本機資料

Windows 上 `apps/api/.env`、`apps/api/.env.production.local`、`.local/` 與 Docker volume **不在 GitHub**，Mac clone 不會取得。

- Neon 連線字串可登入同一 Neon 帳號重新複製，不必建立新的資料庫。
- Gemini key 可從既有 Google AI Studio 專案取得；若沒有保存可建立新 key，更新 Render 的值。
- 需要在 Mac 保存 Neon 字串時，建立未追蹤的 `apps/api/.env.production.local`；不要把密碼、key 或 reset token commit 或貼進聊天。
- Windows 本機 PostgreSQL 的啟停腳本不適用 Mac。需要本機預覽時，Mac 裝好並啟動 Docker Desktop 後，在 repo 根目錄執行 `docker compose up --build -d`，開啟 <http://localhost:3000>。預設使用 mock，無需 Gemini key。
- Mac 本機 Docker 資料庫起初是空的；Neon 示範資料仍在雲端。不要把 API 測試指向 Neon 正式資料庫，測試會清空專用測試資料表。

## 已確認的產品規則

- 餐廳只要被任一揪團使用，就禁止刪除，包含已結案與已取消的團。
- 修改或刪除點餐若使「餐點小計＋既有折扣」為負，拒絕整次變更，提示主揪先調整折扣；不自動改動折扣。

## 剩餘任務

- 10.6：實際觸發每日 demo reset workflow，需部署與 GitHub secrets。
- 11.2：Render API 部署與公開健康檢查。
- 11.3：Vercel web 部署，回填 API 的 `CORS_ORIGIN`。
- 11.4：GitHub Actions secrets：`API_URL`、`DEMO_RESET_TOKEN`。
- 12.1–12.3：線上完整驗證、README 與示範 GIF。

詳細部署欄位見 [deployment.md](deployment.md)。只在完成實際驗證後勾選 OpenSpec 任務。
