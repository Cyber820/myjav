// src/ui/lookup-select.js
import { supabase } from '../supabaseClient.js'

/**
 * Lookup 下拉选择（支持搜索 + 单/多选）
 *
 * ✅ UI（按你的要求）
 * - 默认收起：标题 + 已选摘要 + 下拉箭头（▾）+ 清空（×）
 * - 点击箭头：弹出上层窗口（overlay modal）
 * - 在弹窗里搜索/选择 → 点“确定”提交；点“取消”丢弃草稿
 * - “×”一键清空当前属性已选
 */

const _cache = new Map()

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
  if (document.getElementById('af-lookup-select-style')) return
  const style = el('style', {
    id: 'af-lookup-select-style',
    html: `
      .af-lu{border:1px solid rgba(0,0,0,.20);border-radius:12px;padding:10px;box-sizing:border-box;min-width:260px;flex:1;}
      .af-lu-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .af-lu-title{font-size:13px;font-weight:700;}
      .af-lu-actions{display:flex;gap:8px;align-items:center;}
      .af-lu-iconbtn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:999px;width:30px;height:30px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:14px;line-height:1;}
      .af-lu-iconbtn:disabled{opacity:.6;cursor:not-allowed;}
      .af-lu-summary{margin-top:8px;font-size:12px;color:rgba(0,0,0,.70);white-space:pre-wrap;}

      /* overlay modal */
      .af-lu-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}
      .af-lu-modal{width:min(860px,100%);max-height:85vh;overflow:auto;background:#fff;border:1px solid rgba(0,0,0,.20);border-radius:12px;padding:12px;box-sizing:border-box;}
      .af-lu-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}
      .af-lu-modal-title{font-size:15px;font-weight:700;}
      .af-lu-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:13px;}
      .af-lu-btn-primary{border-color:rgba(0,0,0,.45);font-weight:700;}

      .af-lu-input{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:8px 10px;font-size:14px;}
      .af-lu-hint{margin-top:6px;font-size:12px;color:rgba(0,0,0,.6);}

      .af-lu-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
      .af-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid rgba(0,0,0,.20);border-radius:999px;padding:4px 10px;font-size:12px;background:rgba(0,0,0,.03);}
      .af-chip-x{border:none;background:transparent;cursor:pointer;font-size:14px;line-height:1;}

      .af-lu-list{margin-top:10px;border:1px solid rgba(0,0,0,.15);border-radius:10px;overflow:hidden;max-height:320px;overflow:auto;}
      .af-lu-item{padding:8px 10px;display:flex;justify-content:space-between;gap:10px;cursor:pointer;font-size:13px;}
      .af-lu-item:hover{background:rgba(0,0,0,.04);}
      .af-lu-item small{color:rgba(0,0,0,.55);}
      .af-lu-empty{padding:10px;color:rgba(0,0,0,.6);font-size:12px;}

      .af-lu-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:12px;}
      .af-lu-status{margin-top:8px;font-size:12px;color:rgba(0,0,0,.6);white-space:pre-wrap;}
    `,
  })
  document.head.appendChild(style)
}

async function fetchLookup({ table, idCol, nameCol, orderAsc = true }) {
  const cacheKey = `${table}|${idCol}|${nameCol}|${orderAsc ? 'asc' : 'desc'}`
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)

  const q = supabase.from(table).select(`${idCol}, ${nameCol}`)
  const { data, error } = await (orderAsc ? q.order(nameCol, { ascending: true }) : q.order(nameCol, { ascending: false }))
  if (error) throw new Error(`${table} lookup failed: ${error.message}`)

  const rows = (data || []).map(r => ({ id: r[idCol], name: r[nameCol] }))
  _cache.set(cacheKey, rows)
  return rows
}

function norm(s) {
  return (s ?? '').toString().trim()
}

function contains(hay, needle) {
  return hay.toLowerCase().includes(needle.toLowerCase())
}

function cloneMap(m) {
  const x = new Map()
  for (const [k, v] of m.entries()) x.set(k, v)
  return x
}

export function createLookupSelect(opts) {
  ensureStyles()

  const {
    title,
    table,
    idCol,
    nameCol,
    mode = 'multi', // 'single' | 'multi'
    placeholder = '输入关键字搜索…',
    hint,
  } = opts

  const root = el('div', { class: 'af-lu' })

  const titleEl = el('div', { class: 'af-lu-title' }, [document.createTextNode(title ?? '选择')])

  // 刷新（可选保留）
  const btnRefresh = el('button', { class: 'af-lu-iconbtn', type: 'button', html: '⟳', title: '刷新' })
  // 清空：×
  const btnClear = el('button', { class: 'af-lu-iconbtn', type: 'button', html: '×', title: '清空' })
  // 下拉箭头：▾
  const btnArrow = el('button', { class: 'af-lu-iconbtn', type: 'button', html: '▾', title: '展开选择' })

  const headActions = el('div', { class: 'af-lu-actions' }, [btnRefresh, btnClear, btnArrow])
  const head = el('div', { class: 'af-lu-head' }, [titleEl, headActions])

  const summary = el('div', { class: 'af-lu-summary', html: '未选择' })

  root.appendChild(head)
  root.appendChild(summary)

  /** @type {{id:any, name:string}[]} */
  let all = []

  /** committed */
  const selected = new Map()
  /** draft (modal open) */
  let draft = new Map()

  function setSummary() {
    if (selected.size === 0) {
      summary.textContent = '未选择'
      return
    }
    if (mode === 'single') {
      const one = Array.from(selected.values())[0]
      summary.textContent = one?.name ? `已选：${one.name}` : '已选择 1 项'
      return
    }
    const names = Array.from(selected.values()).map(x => x.name)
    summary.textContent = `已选：${names.join('、')}`
  }

  function getSelected() {
    return Array.from(selected.values())
  }

  function clear() {
    selected.clear()
    draft.clear()
    setSummary()
  }

  function setSelectedByIds(ids) {
    selected.clear()
    const set = new Set((ids || []).map(x => `${x}`))
    for (const item of all) {
      if (set.has(`${item.id}`)) selected.set(item.id, item)
    }
    setSummary()
  }

  function setSelectedByNames(names) {
    selected.clear()
    const set = new Set((names || []).map(x => norm(x)))
    for (const item of all) {
      if (set.has(norm(item.name))) selected.set(item.id, item)
    }
    setSummary()
  }

  async function refresh() {
    btnRefresh.disabled = true
    try {
      all = await fetchLookup({ table, idCol, nameCol, orderAsc: true })

      // 保留原选择（按 id 对齐）
      const keep = new Map()
      for (const item of all) {
        if (selected.has(item.id)) keep.set(item.id, item)
      }
      selected.clear()
      for (const [k, v] of keep.entries()) selected.set(k, v)

      setSummary()
    } finally {
      btnRefresh.disabled = false
    }
  }

  // ====== Modal UI ======
  let overlay = null

  function openModal() {
    // 初始化草稿为当前已选
    draft = cloneMap(selected)

    overlay = el('div', { class: 'af-lu-overlay' })
    const modal = el('div', { class: 'af-lu-modal', role: 'dialog', 'aria-modal': 'true' })
    overlay.appendChild(modal)

    const modalTitle = el('div', { class: 'af-lu-modal-title' }, [
      document.createTextNode(title ?? '选择'),
    ])
    const btnClose = el('button', { class: 'af-lu-btn', type: 'button', html: '关闭' })
    const modalHead = el('div', { class: 'af-lu-modal-head' }, [modalTitle, btnClose])

    const input = el('input', { class: 'af-lu-input', type: 'text', placeholder })
    const hintEl = el('div', { class: 'af-lu-hint' }, [
      document.createTextNode(
        hint || (mode === 'multi'
          ? '输入搜索；点击条目勾选/取消；点“确定”提交本次选择。'
          : '输入搜索；点击条目选择一个；点“确定”提交本次选择。'
        )
      ),
    ])

    const chips = el('div', { class: 'af-lu-chips' })
    const list = el('div', { class: 'af-lu-list' })
    const status = el('div', { class: 'af-lu-status' })

    const btnCancel = el('button', { class: 'af-lu-btn', type: 'button', html: '取消' })
    const btnConfirm = el('button', { class: 'af-lu-btn af-lu-btn-primary', type: 'button', html: '确定' })
    const foot = el('div', { class: 'af-lu-foot' }, [btnCancel, btnConfirm])

    modal.appendChild(modalHead)
    modal.appendChild(input)
    modal.appendChild(hintEl)
    modal.appendChild(list)
    modal.appendChild(chips)
    modal.appendChild(foot)
    modal.appendChild(status)

    document.body.appendChild(overlay)

    btnArrow.innerHTML = '▴'
    btnArrow.title = '收起'
    btnArrow.disabled = true // modal 打开期间避免重复打开

    function setStatus(text) {
      status.textContent = text || ''
    }

    function renderChips() {
      chips.innerHTML = ''
      if (draft.size === 0) return
      for (const item of draft.values()) {
        const x = el('button', { class: 'af-chip-x', type: 'button', html: '×', title: '移除' })
        x.addEventListener('click', () => {
          draft.delete(item.id)
          renderChips()
          renderList()
        })
        chips.appendChild(el('span', { class: 'af-chip' }, [document.createTextNode(item.name), x]))
      }
    }

    function renderList() {
      const q = norm(input.value)
      const shown = q ? all.filter(r => contains(r.name, q)) : all

      list.innerHTML = ''
      if (shown.length === 0) {
        list.appendChild(el('div', { class: 'af-lu-empty', html: '没有匹配项' }))
        return
      }

      for (const item of shown) {
        const picked = draft.has(item.id)
        const right = el('small', {}, [document.createTextNode(picked ? '已选' : '')])
        const row = el('div', { class: 'af-lu-item' }, [
          document.createTextNode(item.name),
          right,
        ])

        row.addEventListener('click', () => {
          if (mode === 'single') {
            draft.clear()
            draft.set(item.id, item)
          } else {
            if (draft.has(item.id)) draft.delete(item.id)
            else draft.set(item.id, item)
          }
          renderChips()
          renderList()
        })

        list.appendChild(row)
      }
    }

    function closeModal({ commit = false } = {}) {
      if (!overlay) return
      if (commit) {
        selected.clear()
        for (const [k, v] of draft.entries()) selected.set(k, v)
        setSummary()
      }
      overlay.remove()
      overlay = null
      draft = new Map()

      btnArrow.disabled = false
      btnArrow.innerHTML = '▾'
      btnArrow.title = '展开选择'
      document.removeEventListener('keydown', onEsc)
    }

    function onEsc(e) {
      if (e.key === 'Escape') closeModal({ commit: false })
    }

    // events
    input.addEventListener('input', renderList)
    btnClose.addEventListener('click', () => closeModal({ commit: false }))
    btnCancel.addEventListener('click', () => closeModal({ commit: false }))
    btnConfirm.addEventListener('click', () => closeModal({ commit: true }))
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal({ commit: false }) })
    document.addEventListener('keydown', onEsc)

    // init content
    setStatus(`候选：${all.length} 条`)
    renderList()
    renderChips()
    input.focus()
  }

  // ===== events on compact view =====
  btnArrow.addEventListener('click', () => {
    // modal 打开时 btnArrow 会 disabled，这里只处理打开
    openModal()
  })

  btnClear.addEventListener('click', () => {
    clear()
  })

  btnRefresh.addEventListener('click', async () => {
    try {
      // 给一个轻量反馈：不额外加 status bar，避免撑高
      btnRefresh.disabled = true
      await refresh()
    } finally {
      btnRefresh.disabled = false
    }
  })

  // init
  refresh().then(() => setSummary())

  return {
    element: root,
    refresh,
    clear,
    getSelected,
    setSelectedByIds,
    setSelectedByNames,
  }
}

export const LOOKUP_PRESETS = {
  actress: {
    title: '女优',
    table: 'actress',
    idCol: 'actress_id',
    nameCol: 'actress_name',
    mode: 'multi',
  },
  publisher: {
    title: '厂商',
    table: 'publisher',
    idCol: 'publisher_id',
    nameCol: 'publisher_name',
    mode: 'single',
  },
  scene: {
    title: '场景',
    table: 'scene',
    idCol: 'scene_id',
    nameCol: 'scene_name',
    mode: 'multi',
  },
  costume: {
    title: '制服',
    table: 'costume',
    idCol: 'costume_id',
    nameCol: 'costume_name',
    mode: 'multi',
  },
  actress_type: {
    title: '女优特点',
    table: 'actress_type',
    idCol: 'actress_type_id',
    nameCol: 'actress_type_name',
    mode: 'multi',
  },
  tag: {
    title: '标签',
    table: 'tag',
    idCol: 'tag_id',
    nameCol: 'tag_name',
    mode: 'multi',
  },
}
