# 部署設定

先完成本機驗證，再依序建立 Neon、Render、Vercel。此文件不代表線上部署已完成。

## 1. Neon 資料庫

1. 前往 https://console.neon.tech，以 GitHub 登入，建立 `office-foodie` 專案，選擇免費方案。
2. 在專案的 Connect 視窗複製兩種連線字串：啟用 connection pooling 的字串作為 `DATABASE_URL`；關閉 pooling 的字串作為 `DIRECT_URL`。
3. 將字串存入本機未追蹤的 `apps/api/.env.production.local`。保留原本開發用 `.env`。
4. 在 `apps/api` 執行下列命令套用 migration；請勿把連線字串貼在聊天或 commit。

```powershell
node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy
```

Neon 官方操作：[Connect to Neon](https://neon.com/docs/connect/connect-from-any-app)。

## 2. Render API

1. 前往 https://dashboard.render.com，以 GitHub 登入。
2. New → Web Service，選擇 `zooroy/office_foodie`、`main`。
3. Runtime 選 Docker、Root Directory 留空、Dockerfile Path 填 `apps/api/Dockerfile`、方案選 Free、Health Check Path 填 `/health`。
4. 填入以下環境變數。也可透過 repo 的 `render.yaml` 建立 Blueprint。

| 名稱               | 值                                            |
| ------------------ | --------------------------------------------- |
| `DATABASE_URL`     | Neon pooled 字串                              |
| `DIRECT_URL`       | Neon direct 字串                              |
| `MENU_EXTRACTOR`   | `gemini`                                      |
| `GEMINI_API_KEY`   | 目前本機使用的 key                            |
| `GEMINI_MODEL`     | `gemini-3.8-flash`                            |
| `DEMO_MODE`        | `true`                                        |
| `DEMO_RESET_TOKEN` | 隨機產生的重置憑證；Blueprint 可自動產生      |
| `CORS_ORIGIN`      | 完成 Vercel 後填入前端 origin，不含最後的 `/` |

Docker 啟動程序會先 migration，demo 模式下再 seed，成功後啟動 API。取得公開 URL 後確認 `/health` 為 200。

Render 官方操作：[Docker](https://render.com/docs/docker)、[環境變數](https://render.com/docs/configure-environment-variables)。

## 3. Vercel 前端

1. 前往 https://vercel.com/new，以 GitHub 登入並匯入同一 repo。
2. Framework 選 Next.js、Root Directory 填 `apps/web`，允許包含 root directory 外的檔案。
3. repo 的 `apps/web/vercel.json` 已設定先建置 shared 套件再建置 web。
4. `NEXT_PUBLIC_API_URL` 填 Render API origin；`NEXT_PUBLIC_DEMO_MODE` 填 `true`。
5. 部署後把前端 origin 回填 Render 的 `CORS_ORIGIN`，重新部署 API。

Vercel 官方操作：[Monorepos](https://vercel.com/docs/monorepos)。

## 4. 每日重置

GitHub repository → Settings → Secrets and variables → Actions，加入：

- `API_URL`：Render API origin。
- `DEMO_RESET_TOKEN`：與 Render 相同的重置憑證。

Actions → Reset demo → Run workflow，確認成功。排程為每天 UTC 19:00（台灣隔日 03:00）。

最後以兩個視窗完成點餐、結單、折扣、回報與確認付款；再測試真實 Gemini 菜單辨識。完成線上驗證後才勾選部署與排程任務。
