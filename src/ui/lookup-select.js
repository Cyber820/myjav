// src/ui/lookup-select.js
import { supabase } from '../supabaseClient.js'

/**
 * 复用组件：Lookup 下拉选择（支持搜索 + 单/多选）
 *
 * ✅ 新交互（按你的要求）：
 * - 默认收起：只显示标题 + 已选摘要 + “展开”
 * - 点击“展开”后：出现搜索框 + 候选列表 + 临时已选 chips
 * - 选择完必须点“确定”才提交到已选；点“取消”则丢弃本次临时选择
 *
 * API：
 * {
 *   element,
 *   refresh(),
 *   clear(),
 *   getSelected(),              // 提交后的已选 [{id,name},...]
 *   setSelectedByIds(ids),      // 直接设置“已选”（编辑预填）
 *   setSelectedByNames(names),
 * }
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
  const style = el('style', { id: 'af-lookup-select-style', html: `
    .af-lu{border:1px solid rgba(0,0,0,.20);border-radius:12px;padding:10px;box-sizing:border-box;min-width:280px;flex:1;}
    .af-lu-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}
    .af-lu-title{font-size:13px;font-weight:700;}
    .af-lu-actions{display:flex;gap:8px;align-items:center;}
    .af-lu-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:12px;}
    .af-lu-btn:disabled{opacity:.6;cursor:not-allowed;}

    .af-lu-summary{margin-top:8px;font-size:12px;color:rgba(0,0,0,.70);white-space:pre-wrap;}
    .af-lu-panel{margin-top:10px;border-top:1px dashed rgba(0,0,0,.18);padding-top:10px;display:none;}
    .af-lu-input{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:8px 10px;font-size:14px;}
    .af-lu-hint{margin-top:6px;font-size:12px;color:rgba(0,0,0,.6);}

    .af-lu-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
    .af-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid rgba(0,0,0,.20);border-radius:999px;padding:4px 10px;font-size:12px;background:rgba(0,0,0,.03);}
    .af-chip-x{border:none;background:transparent;cursor:pointer;font-size:14px;line-height:1;}

    .af-lu-list{margin-top:10px;border:1px solid rgba(0,0,0,.15);border-radius:10px;overflow:hidden;max-height:220px;overflow:auto;}
    .af-lu-item{padding:8px 10px;display:flex;justify-content:space-between;gap:10px;cursor:pointer;font-size:13px;}
    .af-lu-item:hover{background:rgba(0,0,0,.04);}
    .af-lu-item small{color:rgba(0,0,0,.55);}
    .af-lu-empty{padding:10px;color:rgba(0,0,0,.6);font-size:12px;}

    .af-lu-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;}
    .af-lu-status{margin-top:8px;font-size:12px;color:rgba(0,0,0,.6);white-space:pre-wrap;}
  `})
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
  const btnRefresh = el('button', { class: 'af-lu-btn', type: 'button', html: '刷新' })
  const btnToggle = el('button', { class: 'af-lu-btn', type: 'button', html: '展开' })
  const headActions = el('div', { class: 'af-lu-actions' }, [btnRefresh, btnToggle])
  const head = el('div', { class: 'af-lu-head' }, [titleEl, headActions])

  const summary = el('div', { class: 'af-lu-summary', html: '未选择' })

  // panel（展开后出现）
  const panel = el('div', { class: 'af-lu-panel' })
  const input = el('input', { class: 'af-lu-input', type: 'text', placeholder })
  const hintEl = el('div', { class: 'af-lu-hint' }, [
    document.createTextNode(
      hint || (mode === 'multi'
        ? '展开后可搜索；点击条目可勾选/取消；点“确定”提交本次选择。'
        : '展开后可搜索；点击条目选择一个；点“确定”提交本次选择。'
      )
    ),
  ])
  const list = el('div', { class: 'af-lu-list' })
  const chips = el('div', { class: 'af-lu-chips' })
  const status = el('div', { class: 'af-lu-status' })

  const btnCancel = el('button', { class: 'af-lu-btn', type: 'button', html: '取消' })
  const btnConfirm = el('button', { class: 'af-lu-btn', type: 'button', html: '确定' })
  const foot = el('div', { class: 'af-lu-foot' }, [btnCancel, btnConfirm])

  panel.appendChild(input)
  panel.appendChild(hintEl)
  panel.appendChild(list)
  panel.appendChild(chips)
  panel.appendChild(foot)
  panel.appendChild(status)

  root.appendChild(head)
  root.appendChild(summary)
  root.appendChild(panel)

  /** @type {{id:any, name:string}[]} */
  let all = []

  /** committed: 提交后的已选 */
  const selected = new Map()
  /** draft: 展开期间临时已选（点确定才提交到 selected） */
  let draft = new Map()

  function setStatus(text) {
    status.textContent = text || ''
  }

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

  function renderChips() {
    chips.innerHTML = ''
    if (draft.size === 0) return
    for (const item of draft.values()) {
      const x = el('button', { class: 'af-chip-x', type: 'button', html: '×' })
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

  function openPanel() {
    panel.style.display = 'block'
    btnToggle.textContent = '收起'
    // 打开时：draft = 当前已选（拷贝），避免“取消”影响 committed
    draft = cloneMap(selected)
    input.value = ''
    renderChips()
    renderList()
    input.focus()
  }

  function closePanel() {
    panel.style.display = 'none'
    btnToggle.textContent = '展开'
    input.value = ''
    setStatus('')
  }

  function togglePanel() {
    if (panel.style.display === 'block') closePanel()
    else openPanel()
  }

  async function refresh() {
    btnRefresh.disabled = true
    setStatus('正在加载…')
    try {
      all = await fetchLookup({ table, idCol, nameCol, orderAsc: true })
      setStatus(`已加载：${all.length} 条`)
      // 重新加载后，重建 selected/draft 映射（避免旧引用）
      // selected 保留原 id，只要 id 仍存在就恢复 name
      const keep = new Map()
      for (const item of all) {
        if (selected.has(item.id)) keep.set(item.id, item)
      }
      selected.clear()
      for (const [k, v] of keep.entries()) selected.set(k, v)

      setSummary()
      // 若 panel 打开，则刷新可见列表/草稿
      if (panel.style.display === 'block') {
        draft = cloneMap(selected)
        renderChips()
        renderList()
      }
    } catch (e) {
      setStatus(`加载失败：${e?.message ?? String(e)}`)
    } finally {
      btnRefresh.disabled = false
    }
  }

  function clear() {
    selected.clear()
    draft.clear()
    setSummary()
    if (panel.style.display === 'block') {
      renderChips()
      renderList()
    }
  }

  function getSelected() {
    return Array.from(selected.values())
  }

  function setSelectedByIds(ids) {
    selected.clear()
    const set = new Set((ids || []).map(x => `${x}`))
    for (const item of all) {
      if (set.has(`${item.id}`)) selected.set(item.id, item)
    }
    setSummary()
    if (panel.style.display === 'block') {
      draft = cloneMap(selected)
      renderChips()
      renderList()
    }
  }

  function setSelectedByNames(names) {
    selected.clear()
    const set = new Set((names || []).map(x => norm(x)))
    for (const item of all) {
      if (set.has(norm(item.name))) selected.set(item.id, item)
    }
    setSummary()
    if (panel.style.display === 'block') {
      draft = cloneMap(selected)
      renderChips()
      renderList()
    }
  }

  // events
  btnToggle.addEventListener('click', togglePanel)
  btnRefresh.addEventListener('click', refresh)
  input.addEventListener('input', renderList)

  btnCancel.addEventListener('click', () => {
    // 丢弃草稿，收起
    draft = new Map()
    closePanel()
  })

  btnConfirm.addEventListener('click', () => {
    // 提交草稿到 selected
    selected.clear()
    for (const [k, v] of draft.entries()) selected.set(k, v)
    setSummary()
    closePanel()
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
