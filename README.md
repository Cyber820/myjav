# JP Movie DB Starter (Supabase + Vite)

这是一个最小可跑的 starter：
- `index.html`：邮箱 Magic Link 登录
- `auth-callback.html`：登录回调，完成 session 落地
- `editor.html`：编辑入口（已登录才能进入）

## 1) 准备 Supabase
1. 在 Supabase 创建项目
2. Authentication -> Providers 里开启 Email（Magic Link）
3. 复制 Project URL 和 anon key

## 2) 本地运行
```bash
npm i
cp .env.example .env
# 填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## 3) 部署
- Railway/Vercel/Netlify：按常规 Vite 部署即可
- GitHub Pages：如果用子路径，需要在 `vite.config.js` 里设置 `base: '/你的仓库名/'`，并相应调整 `window.location.replace('/')` 等跳转（或改为相对路径）。

## 4) 下一步（你要做的数据库功能）
建议先在 Supabase 建表：
- movies（影片）
- performers（演员/女优）
- studios（片商/厂牌）
- tags（标签）+ movie_tags（多对多）
- watch_log（观看记录）
然后在 `src/editor.js` 里加录入表单与列表即可。
