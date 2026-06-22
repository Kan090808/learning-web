# 學習引擎 🧠

AI 驅動的科學學習 App，支援主動回憶、費曼技巧、交錯練習、刻意練習四種學習法。

## 使用技術

- React 18 + Vite
- OpenRouter API（DeepSeek V4 Flash 免費模型）
- 瀏覽器內建 TTS 語音朗讀
- 純前端，無後端

## 本地開發

```bash
npm install
npm run dev
```

## 部署到 GitHub Pages

### 步驟一：修改 vite.config.js

把 `base` 改成你的 repo 名稱：

```js
base: '/你的repo名稱/',
```

如果用自訂網域，改成：

```js
base: '/',
```

### 步驟二：推上 GitHub

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的帳號/你的repo名稱.git
git push -u origin main
```

### 步驟三：開啟 GitHub Pages

1. 進入 repo → Settings → Pages
2. Source 選 **GitHub Actions**
3. 推上 main 後會自動觸發 deploy
4. 等 1~2 分鐘，網址會出現在 Pages 設定頁

## 取得 OpenRouter API Key

1. 前往 https://openrouter.ai/keys
2. 登入（不需信用卡）
3. 點 Create Key，複製貼入 App 右上角「設定 API」

免費額度：20 requests/分鐘，200 requests/天
