// src/editor.js
import { requireSession, renderTopBar } from './editorShell.js'
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
  if (typeof onClick === 'function' && !disabled) {
    btn.addEventListener('click', onClick)
  }
  return btn
}

function mountLayout(app) {
  app.innerHTML = ''

  // 主容器
  const root = document.createElement('div')
  root.style.minHeight = '100vh'
  root.style.display = 'flex'
  root.style.flexDirection = 'column'

  // 内容区（顶部栏下方）
  const main = document.createElement('div')
  main.style.flex = '1'
  main.style.display = 'flex'
  main.style.flexDirection = 'column'

  // 功能面板
  const panel = document.createElement('div')
  panel.style.padding = '12px'
  panel.style.display = 'flex'
  panel.style.gap = '10px'
  panel.style.flexWrap = 'wrap'
  panel.style.alignItems = 'center'

  // 信息区（用于输出“刚创建成功”之类的提示）
  const info = document.createElement('div')
  info.style.padding = '0 12px 12px'
  info.style.fontSize = '12px'
  info.style.color = 'rgba(0,0,0,.65)'
  info.textContent = '提示：先从「录入女优」开始。后续模块会按你的 6 文件结构继续补全。'

  main.appendChild(panel)
  main.appendChild(info)

  root.appendChild(main)
  app.appendChild(root)

  return { root, main, panel, info }
}

async function main() {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app container')

  // 1) 登录态检查
  const session = await requireSession()

  // 2) 基础布局
  const { panel, info } = mountLayout(app)

  // 3) 顶部栏
  const { topbar } = renderTopBar({ session })
  app.firstChild.insertBefore(topbar, app.firstChild.firstChild)

  // 4) 功能按钮（按你未来拆分结构先摆好）
  const btnCreateActress = makeButton('录入女优', {
    onClick: () => {
      openActressCreateModal({
        onCreated: (row) => {
          // 这里是“创建成功后的回调”
          // 你后续有女优列表/搜索区时，在这里触发刷新即可
          info.textContent = `已创建女优：${row?.actress_name ?? '(unknown)'}（ID: ${row?.actress_id ?? ''}）`
        }
      })
    }
  })

  const btnCreateVideo = makeButton('录入影片（待做）', { disabled: true })
  const btnCreateMeta = makeButton('录入其他信息（待做）', { disabled: true })
  const btnEditActress = makeButton('编辑女优（待做）', { disabled: true })
  const btnEditVideo = makeButton('编辑影片（待做）', { disabled: true })
  const btnSearch = makeButton('搜索与呈现（待做）', { disabled: true })

  panel.appendChild(btnCreateActress)
  panel.appendChild(btnCreateVideo)
  panel.appendChild(btnCreateMeta)
  panel.appendChild(btnEditActress)
  panel.appendChild(btnEditVideo)
  panel.appendChild(btnSearch)
}

// 顶层容错：避免白屏
main().catch((err) => {
  console.error(err)
  const app = document.getElementById('app')
  if (app) {
    app.innerHTML = `
      <div style="padding:16px;font-family:system-ui;">
        <div style="font-weight:700;margin-bottom:8px;">Editor 启动失败</div>
        <pre style="white-space:pre-wrap;border:1px solid rgba(0,0,0,.15);padding:12px;border-radius:10px;background:rgba(0,0,0,.03);">${String(err?.message ?? err)}</pre>
        <div style="margin-top:10px;font-size:12px;color:rgba(0,0,0,.65);">
          常见原因：缺少 .env / Supabase URL 或 Key 未填 / 未登录。
        </div>
      </div>
    `
  }
})
