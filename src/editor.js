// src/editor.js
import { supabase } from './supabaseClient.js'

// 录入功能（你已有）
import { openActressCreateModal } from './actress-create.js'
import { openMetaCreateModal } from './meta-create.js'
import { openVideoCreateModal } from './video-create.js'

// 搜索（已接入）
import { mountSearchEditPage } from './search/search-edit.js'

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else if (k === 'html') node.innerHTML = v
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v)
    else if (v === null || v === undefined) continue
    else node.setAttribute(k, v)
  }
  for (const c of children) node.appendChild(c)
  return node
}

function ensureStyles() {
  if (document.getElementById('af-editor-style')) return
  const style = el('style', {
    id: 'af-editor-style',
    html: `
      .af-page{padding:14px;max-width:1100px;margin:0 auto;}
      .af-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
      .af-title{font-size:18px;font-weight:800;}
      .af-sub{margin-top:4px;font-size:12px;color:rgba(0,0,0,.65);white-space:pre-wrap;}
      .af-card{margin-top:12px;border:1px solid rgba(0,0,0,.12);border-radius:12px;padding:12px;background:#fff;}
      .af-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
      .af-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:10px 14px;cursor:pointer;}
      .af-btn:disabled{opacity:.6;cursor:not-allowed;}
      .af-input{width:min(360px,100%);box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:10px 12px;font-size:14px;}
      .af-muted{font-size:12px;color:rgba(0,0,0,.65);}
      .af-status{margin-top:8px;font-size:12px;color:rgba(0,0,0,.65);white-space:pre-wrap;}
      .af-divider{height:1px;background:rgba(0,0,0,.08);margin:12px 0;}
    `,
  })
  document.head.appendChild(style)
}

function norm(s) {
  return (s ?? '').toString().trim()
}

/** ===== Auth UI ===== */
function renderLoginCard({ host, setStatus }) {
  const email = el('input', {
    class: 'af-input',
    type: 'email',
    placeholder: '输入邮箱以获取登录链接',
    autocomplete: 'email',
    name: 'email',
    id: 'login-email',
  })
  const btn = el('button', { class: 'af-btn', type: 'button', html: '发送登录邮件' })

  btn.addEventListener('click', async () => {
    const addr = norm(email.value)
    if (!addr) {
      setStatus('请输入邮箱。')
      return
    }
    btn.disabled = true
    setStatus('正在发送登录邮件…')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback.html`,
        },
      })
      if (error) throw error
      setStatus('已发送登录邮件：请打开邮箱点击链接完成登录。')
    } catch (e) {
      setStatus(`发送失败：${e?.message ?? String(e)}`)
    } finally {
      btn.disabled = false
    }
  })

  host.appendChild(
    el('div', { class: 'af-card' }, [
      el('div', { class: 'af-row' }, [email, btn]),
      el('div', { class: 'af-muted', style: 'margin-top:8px;' }, [
        document.createTextNode('提示：登录成功后会自动返回本页并显示录入与检索功能。'),
      ]),
    ])
  )
}

function renderAuthedUI({ host, user, setStatus }) {
  const btnActress = el('button', { class: 'af-btn', type: 'button', html: '录入女优' })
  const btnVideo = el('button', { class: 'af-btn', type: 'button', html: '录入影片' })
  const btnMeta = el('button', { class: 'af-btn', type: 'button', html: '录入其他信息' })

  btnActress.addEventListener('click', () => openActressCreateModal())
  btnVideo.addEventListener('click', () => openVideoCreateModal())
  btnMeta.addEventListener('click', () => openMetaCreateModal())

  const btnSignOut = el('button', { class: 'af-btn', type: 'button', html: '退出登录' })
  btnSignOut.addEventListener('click', async () => {
    btnSignOut.disabled = true
    setStatus('正在退出…')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setStatus('已退出。')
    } catch (e) {
      setStatus(`退出失败：${e?.message ?? String(e)}`)
      btnSignOut.disabled = false
    }
  })

  const header = el('div', { class: 'af-top' }, [
    el('div', {}, [
      el('div', { class: 'af-title' }, [document.createTextNode('MyJAV Editor')]),
      el('div', { class: 'af-sub' }, [
        document.createTextNode(`登录用户：${user?.email ?? '(unknown)'}\n（编辑功能将通过搜索结果详情弹窗进入）`),
      ]),
    ]),
    el('div', { class: 'af-row' }, [btnSignOut]),
  ])

  const entryCard = el('div', { class: 'af-card' }, [
    el('div', { class: 'af-row' }, [btnActress, btnVideo, btnMeta]),
    el('div', { class: 'af-muted', style: 'margin-top:8px;' }, [
      document.createTextNode('录入完成后，可在下方搜索并点击结果查看详情（后续从详情进入修改）。'),
    ]),
  ])

  // 搜索区容器：放在录入按钮下方
  const searchCard = el('div', { class: 'af-card' }, [
    el('div', { class: 'af-muted' }, [document.createTextNode('检索')]),
    el('div', { class: 'af-divider' }),
    el('div', { id: 'af-search-host' }),
  ])

  host.appendChild(header)
  host.appendChild(entryCard)
  host.appendChild(searchCard)

  // mount search（只 mount 一次；如果页面不被重建，搜索结果就不会丢）
  mountSearchEditPage({ containerId: 'af-search-host' })
}

/** ===== Main ===== */
async function main() {
  ensureStyles()

  const host = document.getElementById('app')
  if (!host) throw new Error('Missing #app')

  host.innerHTML = ''
  const page = el('div', { class: 'af-page' })
  host.appendChild(page)

  const statusEl = el('div', { class: 'af-status' })
  function setStatus(text) {
    statusEl.textContent = text || ''
  }

  // 用于判断是否需要“重建 UI”
  // 只在 user 的存在性变化（登录/退出）时重建，TOKEN_REFRESHED 不重建
  let lastHasUser = null
  let lastUserId = null

  function hardRender(session) {
    page.innerHTML = ''
    page.appendChild(statusEl)

    const user = session?.user || null
    if (!user) {
      page.insertBefore(
        el('div', { class: 'af-top' }, [
          el('div', {}, [
            el('div', { class: 'af-title' }, [document.createTextNode('MyJAV Editor')]),
            el('div', { class: 'af-sub' }, [document.createTextNode('请先登录。')]),
          ]),
        ]),
        statusEl
      )
      renderLoginCard({ host: page, setStatus })
    } else {
      renderAuthedUI({ host: page, user, setStatus })
    }

    lastHasUser = !!user
    lastUserId = user?.id ?? null
  }

  // 初始：先渲染一个“加载中”
  page.appendChild(
    el('div', { class: 'af-top' }, [
      el('div', {}, [
        el('div', { class: 'af-title' }, [document.createTextNode('MyJAV Editor')]),
        el('div', { class: 'af-sub' }, [document.createTextNode('加载登录状态…')]),
      ]),
    ])
  )
  page.appendChild(statusEl)

  // 初次 session
  const { data, error } = await supabase.auth.getSession()
  if (error) setStatus(`getSession 失败：${error.message}`)
  hardRender(data?.session ?? null)

  // 监听登录态变化：只在需要时重建；否则只更新状态栏
  supabase.auth.onAuthStateChange((event, session) => {
    const hasUser = !!session?.user
    const userId = session?.user?.id ?? null

    // 始终更新状态栏，方便你 debug
    setStatus(`Auth event: ${event}\nHas session: ${!!session}\nHas user: ${hasUser}\nUser: ${session?.user?.email ?? ''}`)

    // 只在“登录/退出/切换账号”时重建 UI
    const needHardRender =
      lastHasUser === null ||
      hasUser !== lastHasUser ||
      (hasUser && userId && userId !== lastUserId)

    if (needHardRender) {
      hardRender(session)
    }
  })
}

main().catch((e) => {
  const host = document.getElementById('app')
  if (host) host.textContent = `Fatal: ${e?.message ?? String(e)}`
})
