// src/editor.js
//
import { supabase } from './supabaseClient.js'
import { renderTopBar } from './editorShell.js'
import { openActressCreateModal } from './actress-create.js'

function makeButton(label, { onClick, disabled = false } = {}) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = label
  btn.disabled = disabled
  btn.style.padding = '8px 12px'
  btn.style.borderRadius = '10px'
  btn.style.border = '1px solid rgba(0,0,0,.25)'
  btn.style.background = disabled ? 'rgba(0,0,0,.04)' : '#fff'
  btn.style.cursor = disabled ? 'not-allowed' : 'pointer'
  btn.style.opacity = disabled ? '0.6' : '1'
  if (typeof onClick === 'function' && !disabled) btn.addEventListener('click', onClick)
  return btn
}

function mountLayout(app) {
  app.innerHTML = ''

  const root = document.createElement('div')
  root.style.minHeight = '100vh'
  root.style.display = 'flex'
  root.style.flexDirection = 'column'

  const debug = document.createElement('div')
  debug.style.borderBottom = '1px solid rgba(0,0,0,.15)'
  debug.style.padding = '12px'
  debug.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  debug.style.fontSize = '12px'
  debug.style.whiteSpace = 'pre-wrap'
  debug.style.background = 'rgba(0,0,0,.03)'

  const main = document.createElement('div')
  main.style.flex = '1'
  main.style.display = 'flex'
  main.style.flexDirection = 'column'

  const panel = document.createElement('div')
  panel.style.padding = '12px'
  panel.style.display = 'flex'
  panel.style.gap = '10px'
  panel.style.flexWrap = 'wrap'
  panel.style.alignItems = 'center'

  const info = document.createElement('div')
  info.style.padding = '0 12px 12px'
  info.style.fontSize = '12px'
  info.style.color = 'rgba(0,0,0,.65)'
  info.textContent = '提示：点击「录入女优」会弹出输入框。'

  main.appendChild(panel)
  main.appendChild(info)

  root.appendChild(debug)
  root.appendChild(main)
  app.appendChild(root)

  return { debug, panel, info, root }
}

function fmtSession(session) {
  if (!session) return 'session: null (未登录)'
  return [
    `session: OK (已登录)`,
    `user.id: ${session.user?.id ?? ''}`,
    `user.email: ${session.user?.email ?? ''}`,
    `access_token: ${session.access_token ? '[present]' : '[missing]'}`,
    `expires_at: ${session.expires_at ?? ''}`,
  ].join('\n')
}

function fmtEventLine(event, session) {
  const email = session?.user?.email ?? ''
  return `[auth event] ${event}${email ? ` (${email})` : ''}`
}

async function main() {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app container')

  const { debug, panel, info, root } = mountLayout(app)

  // 1) 初始 session
  const { data: { session }, error: sessErr } = await supabase.auth.getSession()
  debug.textContent =
    `Supabase getSession():\n` +
    (sessErr ? `ERROR: ${sessErr.message}\n\n` : '') +
    fmtSession(session) +
    `\n\n提示：如果这里一直显示 null，说明当前浏览器没有 session，先去 index.html 登录。`

  // 2) 监听 auth 事件
  const { data: sub } = supabase.auth.onAuthStateChange((event, session2) => {
    debug.textContent =
      `Supabase getSession():\n` +
      fmtSession(session2) +
      `\n\n` +
      fmtEventLine(event, session2)
  })

  // 3) 顶部栏（只有已登录才渲染，避免你误以为“没输入框”）
  if (session) {
    const { topbar } = renderTopBar({ session })
    root.insertBefore(topbar, root.firstChild) // 放在 debug 面板上方
  } else {
    // 未登录时给一个按钮方便你跳回去
    const btnGoLogin = makeButton('去登录页（index.html）', {
      onClick: () => (window.location.href = '/index.html')
    })
    panel.appendChild(btnGoLogin)
  }

  // 4) 功能按钮：已登录才可用
  const btnCreateActress = makeButton('录入女优', {
    disabled: !session,
    onClick: () => {
      openActressCreateModal({
        onCreated: (row) => {
          info.textContent = `已创建女优：${row?.actress_name ?? '(unknown)'}（ID: ${row?.actress_id ?? ''}）`
        }
      })
    }
  })

  panel.appendChild(btnCreateActress)

  // 5) 防止热更新/重载时重复订阅（可选）
  window.addEventListener('beforeunload', () => {
    try { sub?.subscription?.unsubscribe?.() } catch {}
  })
}

main().catch((err) => {
  console.error(err)
  const app = document.getElementById('app')
  if (app) {
    app.innerHTML = `
      <div style="padding:16px;font-family:system-ui;">
        <div style="font-weight:700;margin-bottom:8px;">Editor 启动失败</div>
        <pre style="white-space:pre-wrap;border:1px solid rgba(0,0,0,.15);padding:12px;border-radius:10px;background:rgba(0,0,0,.03);">${String(err?.message ?? err)}</pre>
      </div>
    `
  }
})
