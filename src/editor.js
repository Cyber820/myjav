// src/editor.js
import { requireSession, renderTopBar } from './editorShell.js'
import { openActressCreateModal } from './actress-create.js'
import { openMetaCreateModal } from './meta-create.js'

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
  info.textContent = '提示：录入成功后会出现“确定”，点击后回到录入页面继续录入。'

  main.appendChild(panel)
  main.appendChild(info)

  root.appendChild(main)
  app.appendChild(root)

  return { root, panel, info }
}

async function main() {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app container')

  const session = await requireSession()
  const { root, panel, info } = mountLayout(app)

  const { topbar } = renderTopBar({ session })
  root.insertBefore(topbar, root.firstChild)

  const btnCreateActress = makeButton('录入女优', {
    onClick: () => {
      openActressCreateModal({
        onCreated: (row) => {
          info.textContent = `已创建女优：${row?.actress_name ?? '(unknown)'}（ID: ${row?.actress_id ?? ''}）`
        },
      })
    },
  })

  const btnCreateVideo = makeButton('录入影片（待做）', { disabled: true })

  const btnCreateMeta = makeButton('录入其他信息', {
    onClick: () => openMetaCreateModal(),
  })

  const btnEditActress = makeButton('编辑/修改女优（待做）', { disabled: true })
  const btnEditVideo = makeButton('编辑/修改影片（待做）', { disabled: true })
  const btnSearch = makeButton('搜索与呈现（待做）', { disabled: true })

  panel.appendChild(btnCreateActress)
  panel.appendChild(btnCreateVideo)
  panel.appendChild(btnCreateMeta)
  panel.appendChild(btnEditActress)
  panel.appendChild(btnEditVideo)
  panel.appendChild(btnSearch)
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
