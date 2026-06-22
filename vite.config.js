import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 如果部署到 GitHub Pages，把 base 改成你的 repo 名稱
// 例如 repo 是 github.com/yourname/learning-web
// 就設定 base: '/learning-web/'
// 如果是用自訂網域或根路徑，設定 base: '/'

export default defineConfig({
  plugins: [react()],
  base: '/learning-web/',  // kan090808/learning-web
})
