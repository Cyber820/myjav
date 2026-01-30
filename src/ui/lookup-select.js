// src/ui/lookup-select.js
import { supabase } from '../supabaseClient.js'

/**
 * 可复用：Lookup 下拉选择（支持搜索 + 单/多选）
 *
 * 用途：
 * - video-create / video-edit 用来选择 actress/publisher/scene/costume/actress_type/tag
 * - edit 模式可用 setSelectedByIds() 预填
 *
 * 返回对象：
 * {
 *   element,           // DOM 根节点
 *   refresh(),         // 重新拉取
 *   getSelected(),     // [{id,name}, ...]
 *   setSelectedByIds(ids),
 *   setSelectedByNames(names),
 *   clear(),
 * }
 */

/** 内存缓存：同一页面多次创建不会反复请求 */
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
    .af-lu{border:1px solid rgba(0,0,0,.20);border-radius:12px;padding:10px;box-sizing:border-box;}
    .af-lu-top{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:8px;}
    .af-lu-title{font-size:13px;font-weight:700;}
    .af-lu-actions{display:flex;gap:8px;align-items:center;}
    .af-lu-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:12px;}
    .af-lu-btn:disabled{opacity:.6;cursor:not-allowed;}

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

  const topTitle = el('div', { class: 'af-lu-title' }, [document.createTextNode(title ?? table)])
  const btnRefresh = el('button', { class: 'af-lu-btn', type: 'button', html: '刷新' })
  const btnClear = el('button', { class: 'af-lu-btn', type: 'button', html: '清空' })
  const actions = el('div', { class: 'af-lu-actions' }, [btnRefresh, btnClear])
  const top = el('div', { class: 'af-lu-top' }, [topTitle, actions])

  const input = el('input', { class: 'af-lu-input', type: 'text', placeholder })
  const hintEl = el('div', { class: 'af-lu-hint' }, [document.createTextNode(hint || (mode === 'multi' ? '点击列表项添加；已选项显示在下方。' : '点击列表项选择一个。'))])

  const list = el('div', { class: 'af-lu-list' })
  const chips = el('div', { class: 'af-lu-chips' })
  const status = el('div', { class: 'af-lu-status' })

  root.appendChild(top)
  root.appendChild(input)
  root.appendChild(hintEl)
  root.appendChild(list)
  root.appendChild(chips)
  root.appendChild(status)

  /** @type {{id:number|string, name:string}[]} */
  let all = []
  /** @type {Map<any, {id:any, name:string}>} */
  const selected = new Map()

  function setStatus(text) {
    status.textContent = text || ''
  }

  function renderChips() {
    chips.innerHTML = ''
    if (selected.size === 0) return

    for (const item of selected.values()) {
      const x = el('button', { class: 'af-chip-x', type: 'button', html: '×' })
      x.addEventListener('click', () => {
        selected.delete(item.id)
        renderChips()
        renderList()
      })
      const chip = el('span', { class: 'af-chip' }, [
        document.createTextNode(item.name),
        x,
      ])
      chips.appendChild(chip)
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
      const picked = selected.has(item.id)
      const right = el('small', {}, [document.createTextNode(picked ? '已选' : '')])
      const row = el('div', { class: 'af-lu-item' }, [
        document.createTextNode(item.name),
        right,
      ])

      row.addEventListener('click', () => {
        if (mode === 'single') {
          selected.clear()
          selected.set(item.id, item)
          renderChips()
          renderList()
          // 单选：选中后把输入框清空更利于下一步
          input.value = ''
          input.blur()
          return
        }

        // multi：已选则取消，否则添加
        if (selected.has(item.id)) selected.delete(item.id)
        else selected.set(item.id, item)

        renderChips()
        renderList()
      })

      list.appendChild(row)
    }
  }

  async function refresh() {
    btnRefresh.disabled = true
    setStatus('正在加载…')
    try {
      all = await fetchLookup({ table, idCol, nameCol, orderAsc: true })
      setStatus(`已加载：${all.length} 条`)
      renderList()
    } catch (e) {
      setStatus(`加载失败：${e?.message ?? String(e)}`)
    } finally {
      btnRefresh.disabled = false
    }
  }

  function clear() {
    selected.clear()
    input.value = ''
    renderChips()
    renderList()
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
    renderChips()
    renderList()
  }

  function setSelectedByNames(names) {
    selected.clear()
    const set = new Set((names || []).map(x => norm(x)))
    for (const item of all) {
      if (set.has(norm(item.name))) selected.set(item.id, item)
    }
    renderChips()
    renderList()
  }

  // events
  input.addEventListener('input', renderList)
  btnRefresh.addEventListener('click', refresh)
  btnClear.addEventListener('click', clear)

  // 初次加载
  refresh()

  return {
    element: root,
    refresh,
    clear,
    getSelected,
    setSelectedByIds,
    setSelectedByNames,
  }
}

/**
 * 你项目用的“标准 6 类 lookup”配置（按你当前 schema）
 * 说明：
 * - actress / publisher / scene / costume / actress_type / tag
 * - actress 为多选（影片可关联多位女优）
 * - publisher 单选
 */
export const LOOKUP_PRESETS = {
  actress:      { title: '女优', table: 'actress',      idCol: 'actress_id',      nameCol: 'actress_name',      mode: 'multi' },
  publisher:    { title: '厂商', table: 'publisher',    idCol: 'publisher_id',    nameCol: 'publisher_name',    mode: 'single' },
  scene:        { title: '场景', table: 'scene',        idCol: 'scene_id',        nameCol: 'scene_name',        mode: 'multi' },
  costume:      { title: '制服', table: 'costume',      idCol: 'costume_id',      nameCol: 'costume_name',      mode: 'multi' },
  actress_type: { title: '女优特点', table: 'actress_type', idCol: 'actress_type_id', nameCol: 'actress_type_name', mode: 'multi' },
  tag:          { title: '标签', table: 'tag',          idCol: 'tag_id',          nameCol: 'tag_name',          mode: 'multi' },
}
