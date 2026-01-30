// src/search/search-edit.js
import { supabase } from '../supabaseClient.js'

/**
 * Search + View + Inline Edit (in modal)
 * - 搜索：video_name / content_id / actress_name（并返回该女优出演影片）
 * - 结果：豆腐块 + 全宽
 * - video 卡片小字：番号 + 关联女优
 * - 点击卡片：详情弹窗
 * - 详情弹窗右上角：编辑 → 同弹窗内编辑（预填）
 * - 保存策略：
 *   - actress：update actress
 *   - video：update video + delete all link rows by video_id + insert new link rows
 *
 * ✅ 本版新增：
 * - video.personal_sex_rate（UI 名称：XXX评分）展示/编辑/保存
 */

/* =========================
 * Utils
 * ========================= */
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
  if (document.getElementById('af-search-edit-style')) return
  const style = el('style', {
    id: 'af-search-edit-style',
    html: `
      .af-page{padding:12px;max-width:none;}
      .af-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
      .af-input{width:min(720px,100%);box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:10px 12px;font-size:14px;}
      .af-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:10px 14px;cursor:pointer;font-size:13px;}
      .af-btn:disabled{opacity:.6;cursor:not-allowed;}
      .af-hint{margin-top:8px;font-size:12px;color:rgba(0,0,0,.65);}

      .af-grid{margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;width:100%;}
      .af-card{border:1px solid rgba(0,0,0,.14);border-radius:12px;padding:10px;cursor:pointer;background:#fff;}
      .af-card:hover{background:rgba(0,0,0,.02);}
      .af-card-title{font-weight:800;font-size:14px;line-height:1.35;}
      .af-card-sub{margin-top:6px;font-size:12px;color:rgba(0,0,0,.65);white-space:pre-wrap;}
      .af-empty{margin-top:12px;font-size:12px;color:rgba(0,0,0,.6);}
      .af-err{margin-top:12px;color:#7a0000;background:rgba(200,0,0,.06);border:1px solid rgba(200,0,0,.25);border-radius:10px;padding:10px;white-space:pre-wrap;}

      /* modal */
      .af-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}
      .af-modal{width:min(980px,100%);max-height:88vh;overflow:auto;background:#fff;border:1px solid rgba(0,0,0,.20);border-radius:12px;padding:12px;box-sizing:border-box;}
      .af-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
      .af-modal-title{font-size:15px;font-weight:900;}
      .af-modal-actions{display:flex;gap:10px;align-items:center;}
      .af-status{margin-top:8px;font-size:12px;color:rgba(0,0,0,.65);white-space:pre-wrap;}
      .af-kv{display:grid;grid-template-columns:180px 1fr;gap:8px 12px;align-items:start;}
      .af-k{font-size:12px;color:rgba(0,0,0,.65);padding-top:6px;}
      .af-v{font-size:13px;white-space:pre-wrap;word-break:break-word;border-bottom:1px dashed rgba(0,0,0,.10);padding:6px 0;}

      /* edit form */
      .af-form{display:flex;flex-direction:column;gap:10px;}
      .af-field{display:flex;flex-direction:column;gap:6px;}
      .af-label{font-size:12px;color:rgba(0,0,0,.70);font-weight:700;}
      .af-text{box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:9px 10px;font-size:14px;width:100%;}
      .af-textarea{min-height:92px;resize:vertical;}
      .af-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      @media (max-width: 720px){ .af-row2{grid-template-columns:1fr;} }
      .af-note{font-size:12px;color:rgba(0,0,0,.60);}
      .af-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:10px;}
      .af-divider{height:1px;background:rgba(0,0,0,.08);margin:8px 0;}

      /* lookup select (popup) */
      .af-pick{display:flex;gap:8px;align-items:center;}
      .af-pick-btn{
        flex:1;
        display:flex;align-items:center;justify-content:space-between;gap:10px;
        border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;
        padding:9px 10px;cursor:pointer;font-size:13px;
      }
      .af-pick-btn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
      .af-pick-clear{
        border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;
        width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;
      }
      .af-pop-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;}
      .af-pop{
        width:min(720px,100%);
        max-height:80vh;overflow:auto;background:#fff;border:1px solid rgba(0,0,0,.20);
        border-radius:12px;padding:12px;box-sizing:border-box;
      }
      .af-pop-head{display:flex;gap:10px;align-items:center;justify-content:space-between;}
      .af-pop-title{font-weight:900;font-size:14px;}
      .af-pop-body{margin-top:10px;}
      .af-pop-search{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:9px 10px;font-size:14px;}
      .af-pop-list{margin-top:10px;border:1px solid rgba(0,0,0,.12);border-radius:12px;overflow:hidden;}
      .af-pop-item{display:flex;gap:10px;align-items:center;padding:10px 12px;border-top:1px solid rgba(0,0,0,.08);cursor:pointer;}
      .af-pop-item:first-child{border-top:none;}
      .af-pop-item:hover{background:rgba(0,0,0,.02);}
      .af-pop-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:10px;}
      .af-mini{font-size:12px;color:rgba(0,0,0,.65);}
      .af-arrow{font-size:14px;color:rgba(0,0,0,.60);}
    `,
  })
  document.head.appendChild(style)
}

function norm(s) {
  return (s ?? '').toString().trim()
}

function uniqBy(arr, keyFn) {
  const seen = new Set()
  const out = []
  for (const x of arr) {
    const k = keyFn(x)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

function toNumOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/* =========================
 * Option cache + query
 * ========================= */
const OPTION_CACHE = new Map()
// key: `${table}:${idCol}:${nameCol}` => { ts, items: [{id,name}] }
async function loadOptions({ table, idCol, nameCol, force = false }) {
  const key = `${table}:${idCol}:${nameCol}`
  const cached = OPTION_CACHE.get(key)
  if (!force && cached && Date.now() - cached.ts < 60_000) return cached.items

  const { data, error } = await supabase.from(table).select(`${idCol}, ${nameCol}`).order(nameCol, { ascending: true }).limit(5000)
  if (error) throw new Error(error.message)
  const items = (data || []).map(r => ({ id: r[idCol], name: r[nameCol] }))
  OPTION_CACHE.set(key, { ts: Date.now(), items })
  return items
}

function makePicker({ title, multi, table, idCol, nameCol }) {
  let selectedIds = new Set()
  let lastOptions = [] // [{id,name}]
  let labelText = '请选择'

  const btn = el('button', { class: 'af-pick-btn', type: 'button' }, [
    el('span', {}, [document.createTextNode(labelText)]),
    el('span', { class: 'af-arrow' }, [document.createTextNode('▾')]),
  ])
  const btnClear = el('button', { class: 'af-pick-clear', type: 'button', title: '清空' }, [document.createTextNode('×')])
  const wrap = el('div', { class: 'af-pick' }, [btn, btnClear])

  function refreshLabel() {
    const names = lastOptions.filter(o => selectedIds.has(o.id)).map(o => o.name)
    if (!names.length) labelText = '请选择'
    else if (!multi) labelText = names[0]
    else labelText = names.join('、')

    const firstSpan = btn.querySelector('span')
    if (firstSpan) firstSpan.textContent = labelText
  }

  async function openPopup() {
    const options = await loadOptions({ table, idCol, nameCol })
    lastOptions = options

    const overlay = el('div', { class: 'af-pop-overlay' })
    const pop = el('div', { class: 'af-pop' })
    overlay.appendChild(pop)

    const hTitle = el('div', { class: 'af-pop-title' }, [document.createTextNode(title)])
    const btnClose = el('button', { class: 'af-btn', type: 'button', html: '关闭' })
    const head = el('div', { class: 'af-pop-head' }, [hTitle, btnClose])

    const search = el('input', { class: 'af-pop-search', type: 'text', placeholder: '输入关键词筛选…', autocomplete: 'off' })
    const list = el('div', { class: 'af-pop-list' })
    const info = el('div', { class: 'af-mini' }, [document.createTextNode(multi ? '多选：勾选后点“确定”保存选择。' : '单选：选中后点“确定”。')])

    const btnCancel = el('button', { class: 'af-btn', type: 'button', html: '取消' })
    const btnOk = el('button', { class: 'af-btn', type: 'button', html: '确定' })
    const foot = el('div', { class: 'af-pop-foot' }, [btnCancel, btnOk])

    let temp = new Set(selectedIds)

    function renderList(filterText) {
      list.innerHTML = ''
      const q = norm(filterText).toLowerCase()
      const filtered = q ? options.filter(o => (o.name || '').toLowerCase().includes(q)) : options
      if (!filtered.length) {
        list.appendChild(el('div', { class: 'af-pop-item' }, [document.createTextNode('无匹配项')]))
        return
      }

      for (const o of filtered) {
        const input = el('input', { type: multi ? 'checkbox' : 'radio' })
        input.checked = temp.has(o.id)

        const row = el('div', { class: 'af-pop-item' }, [
          input,
          el('div', {}, [document.createTextNode(o.name)]),
        ])

        row.addEventListener('click', () => {
          if (multi) {
            if (temp.has(o.id)) temp.delete(o.id)
            else temp.add(o.id)
          } else {
            temp = new Set([o.id])
          }
          renderList(search.value)
        })

        list.appendChild(row)
      }
    }

    function close() {
      overlay.remove()
      document.removeEventListener('keydown', onEsc)
    }
    function onEsc(e) { if (e.key === 'Escape') close() }

    btnClose.addEventListener('click', close)
    btnCancel.addEventListener('click', close)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
    document.addEventListener('keydown', onEsc)

    btnOk.addEventListener('click', () => {
      selectedIds = new Set(temp)
      refreshLabel()
      close()
    })

    search.addEventListener('input', () => renderList(search.value))

    pop.appendChild(head)
    pop.appendChild(info)
    pop.appendChild(el('div', { class: 'af-pop-body' }, [search, list, foot]))
    document.body.appendChild(overlay)

    renderList('')
    search.focus()
  }

  btn.addEventListener('click', () => { openPopup().catch(e => alert(e?.message ?? String(e))) })
  btnClear.addEventListener('click', () => {
    selectedIds = new Set()
    refreshLabel()
  })

  return {
    element: wrap,
    async preload() {
      lastOptions = await loadOptions({ table, idCol, nameCol })
      refreshLabel()
    },
    setSelectedIds(ids) {
      selectedIds = new Set((ids || []).filter(x => x !== null && x !== undefined))
      refreshLabel()
    },
    getSelectedIds() {
      return Array.from(selectedIds)
    },
  }
}

/* =========================
 * Search core
 * ========================= */
async function runSearch(query) {
  const q = norm(query)
  if (!q) return { query: q, actresses: [], videos: [], videoMetaById: new Map() }

  const p1 = supabase.from('video').select('video_id, video_name, content_id').ilike('video_name', `%${q}%`).limit(50)
  const p2 = supabase.from('video').select('video_id, video_name, content_id').ilike('content_id', `%${q}%`).limit(50)
  const p3 = supabase.from('actress').select('actress_id, actress_name').ilike('actress_name', `%${q}%`).limit(50)

  const [r1, r2, r3] = await Promise.all([p1, p2, p3])
  const err = r1.error || r2.error || r3.error
  if (err) throw new Error(err.message)

  const videosByName = (r1.data || [])
  const videosByCid = (r2.data || [])
  const actresses = (r3.data || [])

  // actress -> actress_in_video -> video
  let videosByActressLink = []
  if (actresses.length) {
    const actressIds = actresses.map(a => a.actress_id)
    const { data: links, error: e1 } = await supabase
      .from('actress_in_video')
      .select('video_id, actress_id')
      .in('actress_id', actressIds)
      .limit(2000)
    if (e1) throw new Error(e1.message)

    const videoIds = uniqBy((links || []).map(x => x.video_id), x => `${x}`)
    if (videoIds.length) {
      const { data: vrows, error: e2 } = await supabase
        .from('video')
        .select('video_id, video_name, content_id')
        .in('video_id', videoIds)
        .limit(2000)
      if (e2) throw new Error(e2.message)
      videosByActressLink = (vrows || [])
    }
  }

  const videos = uniqBy([...videosByName, ...videosByCid, ...videosByActressLink], v => `${v.video_id}`)
  const videoMetaById = await hydrateVideoCardMeta(videos.map(v => v.video_id))

  return { query: q, actresses, videos, videoMetaById }
}

async function hydrateVideoCardMeta(videoIds) {
  const map = new Map()
  const ids = (videoIds || []).filter(Boolean)
  if (!ids.length) return map

  const { data: links, error: e1 } = await supabase
    .from('actress_in_video')
    .select('video_id, actress_id')
    .in('video_id', ids)
    .limit(5000)
  if (e1) throw new Error(e1.message)

  const actressIds = uniqBy((links || []).map(x => x.actress_id), x => `${x}`)
  let actressNameById = new Map()
  if (actressIds.length) {
    const { data: arows, error: e2 } = await supabase
      .from('actress')
      .select('actress_id, actress_name')
      .in('actress_id', actressIds)
      .limit(5000)
    if (e2) throw new Error(e2.message)
    actressNameById = new Map((arows || []).map(a => [a.actress_id, a.actress_name]))
  }

  for (const vid of ids) {
    const aNames = (links || [])
      .filter(x => x.video_id === vid)
      .map(x => actressNameById.get(x.actress_id))
      .filter(Boolean)
    map.set(vid, { actresses: aNames })
  }

  return map
}

/* =========================
 * Detail fetch (+关联 id 列表)
 * ========================= */
async function fetchActressDetail(actress_id) {
  const { data: actress, error } = await supabase.from('actress').select('*').eq('actress_id', actress_id).single()
  if (error) throw new Error(error.message)
  return { kind: 'actress', actress }
}

async function fetchVideoDetail(video_id) {
  const { data: video, error: e0 } = await supabase.from('video').select('*').eq('video_id', video_id).single()
  if (e0) throw new Error(e0.message)

  // publisher name
  let publisherName = null
  if (video.publisher_id != null) {
    const { data: p, error: eP } = await supabase.from('publisher').select('publisher_name').eq('publisher_id', video.publisher_id).single()
    if (!eP) publisherName = p?.publisher_name ?? null
  }

  // load ids from link tables (for prefill)
  const loadIds = async (linkTable, idCol) => {
    const { data, error } = await supabase.from(linkTable).select(idCol).eq('video_id', video_id).limit(5000)
    if (error) throw new Error(error.message)
    return uniqBy((data || []).map(r => r[idCol]), x => `${x}`)
  }

  const [actress_ids, actress_type_ids, costume_ids, scene_ids, tag_ids] = await Promise.all([
    loadIds('actress_in_video', 'actress_id'),
    loadIds('actress_type_in_video', 'actress_type_id'),
    loadIds('costume_in_video', 'costume_id'),
    loadIds('video_scene', 'scene_id'),
    loadIds('video_tag', 'tag_id'),
  ])

  // names for view mode
  const loadNames = async (table, idCol, nameCol, ids) => {
    if (!ids.length) return []
    const { data, error } = await supabase.from(table).select(`${idCol}, ${nameCol}`).in(idCol, ids).limit(5000)
    if (error) throw new Error(error.message)
    const map = new Map((data || []).map(r => [r[idCol], r[nameCol]]))
    return ids.map(id => map.get(id)).filter(Boolean)
  }

  const [actresses, actressTypes, costumes, scenes, tags] = await Promise.all([
    loadNames('actress', 'actress_id', 'actress_name', actress_ids),
    loadNames('actress_type', 'actress_type_id', 'actress_type_name', actress_type_ids),
    loadNames('costume', 'costume_id', 'costume_name', costume_ids),
    loadNames('scene', 'scene_id', 'scene_name', scene_ids),
    loadNames('tag', 'tag_id', 'tag_name', tag_ids),
  ])

  return {
    kind: 'video',
    video,
    publisherName,
    actresses,
    actressTypes,
    costumes,
    scenes,
    tags,
    link_ids: { actress_ids, actress_type_ids, costume_ids, scene_ids, tag_ids },
  }
}

/* =========================
 * Update helpers
 * ========================= */
async function updateActress(actress_id, payload) {
  const { error } = await supabase.from('actress').update(payload).eq('actress_id', actress_id)
  if (error) throw new Error(error.message)
}

async function replaceVideoLinks(video_id, linkTable, idCol, ids) {
  const { error: dErr } = await supabase.from(linkTable).delete().eq('video_id', video_id)
  if (dErr) throw new Error(dErr.message)

  const cleanIds = (ids || []).filter(x => x !== null && x !== undefined)
  if (!cleanIds.length) return

  const rows = cleanIds.map(id => ({ video_id, [idCol]: id }))
  const { error: iErr } = await supabase.from(linkTable).insert(rows)
  if (iErr) throw new Error(iErr.message)
}

async function updateVideoAndLinks(video_id, videoPayload, linkPayloads) {
  const { error: uErr } = await supabase.from('video').update(videoPayload).eq('video_id', video_id)
  if (uErr) throw new Error(uErr.message)

  await replaceVideoLinks(video_id, 'actress_in_video', 'actress_id', linkPayloads.actress_ids)
  await replaceVideoLinks(video_id, 'actress_type_in_video', 'actress_type_id', linkPayloads.actress_type_ids)
  await replaceVideoLinks(video_id, 'costume_in_video', 'costume_id', linkPayloads.costume_ids)
  await replaceVideoLinks(video_id, 'video_scene', 'scene_id', linkPayloads.scene_ids)
  await replaceVideoLinks(video_id, 'video_tag', 'tag_id', linkPayloads.tag_ids)
}

/* =========================
 * Modal (view/edit)
 * ========================= */
function openEntityModal({ kind, title, initialDetail, onAfterSaved }) {
  const overlay = el('div', { class: 'af-modal-overlay' })
  const modal = el('div', { class: 'af-modal', role: 'dialog', 'aria-modal': 'true' })
  overlay.appendChild(modal)

  const statusEl = el('div', { class: 'af-status' })
  const setStatus = (t) => (statusEl.textContent = t || '')

  let detail = initialDetail

  const titleEl = el('div', { class: 'af-modal-title' }, [document.createTextNode(title)])
  const btnEdit = el('button', { class: 'af-btn', type: 'button', html: '编辑' })
  const btnClose = el('button', { class: 'af-btn', type: 'button', html: '关闭' })
  const head = el('div', { class: 'af-modal-head' }, [
    titleEl,
    el('div', { class: 'af-modal-actions' }, [btnEdit, btnClose]),
  ])
  const body = el('div')

  function close() {
    overlay.remove()
    document.removeEventListener('keydown', onEsc)
  }
  function onEsc(e) { if (e.key === 'Escape') close() }

  btnClose.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  document.addEventListener('keydown', onEsc)

  async function renderView() {
    setStatus('')
    btnEdit.disabled = false
    body.innerHTML = ''
    const kv = el('div', { class: 'af-kv' })

    if (kind === 'actress') {
      const a = detail.actress
      const rows = [
        { k: '名称', v: a.actress_name ?? '' },
        { k: '生日', v: a.date_of_birth ?? '' },
        { k: '身高', v: a.height != null ? String(a.height) : '' },
        { k: '罩杯', v: a.cup ?? '' },
        { k: '个人评分', v: a.personal_rate != null ? String(a.personal_rate) : '' },
        { k: '个人评价', v: a.personal_comment ?? '' },
      ]
      for (const r of rows) {
        kv.appendChild(el('div', { class: 'af-k' }, [document.createTextNode(r.k)]))
        kv.appendChild(el('div', { class: 'af-v' }, [document.createTextNode(r.v)]))
      }
    } else {
      const v = detail.video
      const rows = [
        { k: '影片名称', v: v.video_name ?? '' },
        { k: '番号', v: v.content_id ?? '' },
        { k: '发售日期', v: v.publish_date ?? '' },
        { k: '厂商', v: detail.publisherName ?? '' },
        { k: '有码', v: v.censored === true ? '有码' : (v.censored === false ? '无码' : '') },
        { k: '长度（分钟）', v: v.length != null ? String(v.length) : '' },
        { k: '出演女优', v: (detail.actresses || []).join('、') },
        { k: '女优特点', v: (detail.actressTypes || []).join('、') },
        { k: '制服', v: (detail.costumes || []).join('、') },
        { k: '场景', v: (detail.scenes || []).join('、') },
        { k: '标签', v: (detail.tags || []).join('、') },
        { k: '总体评分', v: v.video_personal_rate != null ? String(v.video_personal_rate) : '' },

        // ✅ 新增展示：XXX评分（personal_sex_rate）
        { k: 'XXX评分', v: v.personal_sex_rate != null ? String(v.personal_sex_rate) : '' },

        { k: '女优评分', v: v.overall_actress_personal_rate != null ? String(v.overall_actress_personal_rate) : '' },
        { k: '演技评分', v: v.personal_acting_rate != null ? String(v.personal_acting_rate) : '' },
        { k: '声音评分', v: v.personal_voice_rate != null ? String(v.personal_voice_rate) : '' },
        { k: '情节', v: v.storyline ?? '' },
        { k: '猎奇', v: v.has_special === true ? '是' : (v.has_special === false ? '无' : '') },
        { k: '猎奇内容', v: v.special ?? '' },
        { k: '个人点评', v: v.personal_comment ?? '' },
      ]
      for (const r of rows) {
        kv.appendChild(el('div', { class: 'af-k' }, [document.createTextNode(r.k)]))
        kv.appendChild(el('div', { class: 'af-v' }, [document.createTextNode(r.v)]))
      }
    }

    body.appendChild(kv)
  }

  async function renderEdit() {
    setStatus('')
    btnEdit.disabled = true
    body.innerHTML = ''

    const form = el('div', { class: 'af-form' })
    const foot = el('div', { class: 'af-foot' })
    const btnCancel = el('button', { class: 'af-btn', type: 'button', html: '取消' })
    const btnSave = el('button', { class: 'af-btn', type: 'button', html: '保存' })
    foot.appendChild(btnCancel)
    foot.appendChild(btnSave)

    btnCancel.addEventListener('click', async () => {
      await renderView()
      btnEdit.disabled = false
    })

    if (kind === 'actress') {
      const a = detail.actress

      const fName = el('input', { class: 'af-text', type: 'text', value: a.actress_name ?? '' })
      const fDob = el('input', { class: 'af-text', type: 'date', value: a.date_of_birth ?? '' })
      const fHeight = el('input', { class: 'af-text', type: 'number', value: a.height ?? '', min: '130', max: '200' })

      const cupSel = el('select', { class: 'af-text' })
      cupSel.appendChild(el('option', { value: '' }, [document.createTextNode('（不填）')]))
      for (const ch of 'ABCDEFGHIJK') cupSel.appendChild(el('option', { value: ch }, [document.createTextNode(ch)]))
      cupSel.value = a.cup ?? ''

      const fRate = el('input', { class: 'af-text', type: 'number', value: a.personal_rate ?? '', min: '0', max: '100' })
      const fComment = el('textarea', { class: 'af-text af-textarea' }, [document.createTextNode(a.personal_comment ?? '')])

      form.appendChild(el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('名称（必填）')]), fName]))
      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('生日')]), fDob]),
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('身高（130-200）')]), fHeight]),
      ]))
      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('罩杯（A-K）')]), cupSel]),
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('个人评分（0-100）')]), fRate]),
      ]))
      form.appendChild(el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('个人评价')]), fComment]))
      form.appendChild(foot)

      btnSave.addEventListener('click', async () => {
        const actress_name = norm(fName.value)
        const date_of_birth = fDob.value || null
        const height = toNumOrNull(fHeight.value)
        const cup = cupSel.value || null
        const personal_rate = toNumOrNull(fRate.value)
        const personal_comment = norm(fComment.value) || null

        if (!actress_name) return setStatus('名称为必填。')
        if (height != null && (height < 130 || height > 200)) return setStatus('身高需要在 130-200。')
        if (personal_rate != null && (personal_rate < 0 || personal_rate > 100)) return setStatus('个人评分需要在 0-100。')

        btnSave.disabled = true
        btnCancel.disabled = true
        setStatus('正在保存…')

        try {
          await updateActress(a.actress_id, { actress_name, date_of_birth, height, cup, personal_rate, personal_comment })
          detail = await fetchActressDetail(a.actress_id)
          titleEl.textContent = `女优：${detail.actress.actress_name}`
          await onAfterSaved?.()
          setStatus('保存成功。')
          await renderView()
        } catch (e) {
          setStatus(`保存失败：${e?.message ?? String(e)}`)
        } finally {
          btnSave.disabled = false
          btnCancel.disabled = false
          btnEdit.disabled = false
        }
      })
    } else {
      const v = detail.video

      const fVideoName = el('input', { class: 'af-text', type: 'text', value: v.video_name ?? '' })
      const fCid = el('input', { class: 'af-text', type: 'text', value: v.content_id ?? '' })
      const fDate = el('input', { class: 'af-text', type: 'date', value: v.publish_date ?? '' })

      const censSel = el('select', { class: 'af-text' })
      censSel.appendChild(el('option', { value: '' }, [document.createTextNode('请选择（必选）')]))
      censSel.appendChild(el('option', { value: 'true' }, [document.createTextNode('有码')]))
      censSel.appendChild(el('option', { value: 'false' }, [document.createTextNode('无码')]))
      censSel.value = (v.censored === true) ? 'true' : (v.censored === false ? 'false' : '')

      const fLen = el('input', { class: 'af-text', type: 'number', value: v.length ?? '', min: '0' })

      const fRateAll = el('input', { class: 'af-text', type: 'number', value: v.video_personal_rate ?? '', min: '0', max: '100' })

      // ✅ 新增：XXX评分（personal_sex_rate）
      const fRateSex = el('input', { class: 'af-text', type: 'number', value: v.personal_sex_rate ?? '', min: '0', max: '100' })

      const fRateAct = el('input', { class: 'af-text', type: 'number', value: v.overall_actress_personal_rate ?? '', min: '0', max: '100' })
      const fRateActing = el('input', { class: 'af-text', type: 'number', value: v.personal_acting_rate ?? '', min: '0', max: '100' })
      const fRateVoice = el('input', { class: 'af-text', type: 'number', value: v.personal_voice_rate ?? '', min: '0', max: '100' })

      const fStory = el('textarea', { class: 'af-text af-textarea' }, [document.createTextNode(v.storyline ?? '')])

      const hasSel = el('select', { class: 'af-text' })
      hasSel.appendChild(el('option', { value: '' }, [document.createTextNode('（不填）')]))
      hasSel.appendChild(el('option', { value: 'true' }, [document.createTextNode('是')]))
      hasSel.appendChild(el('option', { value: 'false' }, [document.createTextNode('无')]))
      hasSel.value = (v.has_special === true) ? 'true' : (v.has_special === false ? 'false' : '')

      const fSpecial = el('textarea', { class: 'af-text af-textarea' }, [document.createTextNode(v.special ?? '')])
      const specialWrap = el('div', { class: 'af-field' }, [
        el('div', { class: 'af-label' }, [document.createTextNode('猎奇内容')]),
        fSpecial,
      ])
      const syncSpecialVisibility = () => {
        const on = hasSel.value === 'true'
        specialWrap.style.display = on ? '' : 'none'
      }
      hasSel.addEventListener('change', syncSpecialVisibility)
      syncSpecialVisibility()

      const fComment = el('textarea', { class: 'af-text af-textarea' }, [document.createTextNode(v.personal_comment ?? '')])

      // Pickers（可搜索，单/多选）
      const pPublisher = makePicker({ title: '选择厂商', multi: false, table: 'publisher', idCol: 'publisher_id', nameCol: 'publisher_name' })
      const pActress = makePicker({ title: '选择出演女优', multi: true, table: 'actress', idCol: 'actress_id', nameCol: 'actress_name' })
      const pActressType = makePicker({ title: '选择女优特点', multi: true, table: 'actress_type', idCol: 'actress_type_id', nameCol: 'actress_type_name' })
      const pCostume = makePicker({ title: '选择制服', multi: true, table: 'costume', idCol: 'costume_id', nameCol: 'costume_name' })
      const pScene = makePicker({ title: '选择场景', multi: true, table: 'scene', idCol: 'scene_id', nameCol: 'scene_name' })
      const pTag = makePicker({ title: '选择标签', multi: true, table: 'tag', idCol: 'tag_id', nameCol: 'tag_name' })

      // 预加载选项 + 预填（用 link_ids 预填关联）
      await Promise.all([pPublisher.preload(), pActress.preload(), pActressType.preload(), pCostume.preload(), pScene.preload(), pTag.preload()])
      if (v.publisher_id != null) pPublisher.setSelectedIds([v.publisher_id])
      pActress.setSelectedIds(detail.link_ids?.actress_ids || [])
      pActressType.setSelectedIds(detail.link_ids?.actress_type_ids || [])
      pCostume.setSelectedIds(detail.link_ids?.costume_ids || [])
      pScene.setSelectedIds(detail.link_ids?.scene_ids || [])
      pTag.setSelectedIds(detail.link_ids?.tag_ids || [])

      // layout
      form.appendChild(el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('影片名称（必填）')]), fVideoName]))
      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('番号')]), fCid]),
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('发售日期')]), fDate]),
      ]))
      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('厂商（必选）')]), pPublisher.element]),
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('有码/无码（必选）')]), censSel]),
      ]))
      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('长度（分钟）')]), fLen]),
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('猎奇')]), hasSel]),
      ]))
      form.appendChild(specialWrap)

      form.appendChild(el('div', { class: 'af-divider' }))

      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('出演女优')]), pActress.element]),
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('女优特点')]), pActressType.element]),
      ]))
      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('制服')]), pCostume.element]),
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('场景')]), pScene.element]),
      ]))
      form.appendChild(el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('标签')]), pTag.element]))

      form.appendChild(el('div', { class: 'af-divider' }))

      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('总体评分（0-100）')]), fRateAll]),
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('XXX评分（0-100）')]), fRateSex]),
      ]))
      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('女优评分（0-100）')]), fRateAct]),
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('演技评分（0-100）')]), fRateActing]),
      ]))
      form.appendChild(el('div', { class: 'af-row2' }, [
        el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('声音评分（0-100）')]), fRateVoice]),
      ]))
      form.appendChild(el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('情节')]), fStory]))
      form.appendChild(el('div', { class: 'af-field' }, [el('div', { class: 'af-label' }, [document.createTextNode('个人点评')]), fComment]))
      form.appendChild(el('div', { class: 'af-note' }, [document.createTextNode('保存策略：先 UPDATE video，再删除该 video_id 的所有关联表记录，然后按当前选择重新 INSERT。')]))
      form.appendChild(foot)

      btnSave.addEventListener('click', async () => {
        const video_name = norm(fVideoName.value)
        if (!video_name) return setStatus('影片名称为必填。')

        const publisher_ids = pPublisher.getSelectedIds()
        if (!publisher_ids.length) return setStatus('厂商为必选。')
        const publisher_id = publisher_ids[0]

        if (censSel.value !== 'true' && censSel.value !== 'false') return setStatus('有码/无码为必选。')
        const censored = censSel.value === 'true'

        const content_id = norm(fCid.value) || null
        const publish_date = fDate.value || null
        const length = toNumOrNull(fLen.value)

        const video_personal_rate = toNumOrNull(fRateAll.value)
        const personal_sex_rate = toNumOrNull(fRateSex.value)
        const overall_actress_personal_rate = toNumOrNull(fRateAct.value)
        const personal_acting_rate = toNumOrNull(fRateActing.value)
        const personal_voice_rate = toNumOrNull(fRateVoice.value)

        for (const [label, val] of [
          ['总体评分', video_personal_rate],
          ['XXX评分', personal_sex_rate],
          ['女优评分', overall_actress_personal_rate],
          ['演技评分', personal_acting_rate],
          ['声音评分', personal_voice_rate],
        ]) {
          if (val != null && (val < 0 || val > 100)) return setStatus(`${label} 需要在 0-100。`)
        }

        const storyline = norm(fStory.value) || null
        const has_special = (hasSel.value === '') ? null : (hasSel.value === 'true')
        let special = norm(fSpecial.value) || null
        if (has_special !== true) special = null
        const personal_comment = norm(fComment.value) || null

        const link_ids = {
          actress_ids: pActress.getSelectedIds(),
          actress_type_ids: pActressType.getSelectedIds(),
          costume_ids: pCostume.getSelectedIds(),
          scene_ids: pScene.getSelectedIds(),
          tag_ids: pTag.getSelectedIds(),
        }

        const videoPayload = {
          video_name,
          content_id,
          publish_date,
          publisher_id,
          censored,
          length,
          video_personal_rate,

          // ✅ 新增写入
          personal_sex_rate,

          overall_actress_personal_rate,
          personal_acting_rate,
          personal_voice_rate,
          storyline,
          has_special,
          special,
          personal_comment,
        }

        btnSave.disabled = true
        btnCancel.disabled = true
        setStatus('正在保存…')

        try {
          await updateVideoAndLinks(v.video_id, videoPayload, link_ids)
          detail = await fetchVideoDetail(v.video_id)
          titleEl.textContent = `影片：${detail.video.video_name}`
          await onAfterSaved?.()
          setStatus('保存成功。')
          await renderView()
        } catch (e) {
          setStatus(`保存失败：${e?.message ?? String(e)}`)
        } finally {
          btnSave.disabled = false
          btnCancel.disabled = false
          btnEdit.disabled = false
        }
      })
    }

    body.appendChild(form)
  }

  btnEdit.addEventListener('click', async () => {
    btnEdit.disabled = true
    btnClose.disabled = true
    try {
      await renderEdit()
    } finally {
      btnClose.disabled = false
    }
  })

  modal.appendChild(head)
  modal.appendChild(body)
  modal.appendChild(statusEl)
  document.body.appendChild(overlay)

  renderView()
}

/* =========================
 * Results grid
 * ========================= */
function renderResults(mount, state, openModalFor) {
  mount.innerHTML = ''

  if (state.error) {
    mount.appendChild(el('div', { class: 'af-err', html: `检索失败：${state.error}` }))
    return
  }

  if (!state.query) {
    mount.appendChild(el('div', { class: 'af-empty' }, [document.createTextNode('请输入关键字后检索。')]))
    return
  }

  const grid = el('div', { class: 'af-grid' })

  for (const a of state.actresses || []) {
    const card = el('div', { class: 'af-card' })
    card.appendChild(el('div', { class: 'af-card-title' }, [document.createTextNode(a.actress_name)]))
    card.appendChild(el('div', { class: 'af-card-sub' }, [document.createTextNode('')]))
    card.addEventListener('click', async () => openModalFor('actress', a))
    grid.appendChild(card)
  }

  for (const v of state.videos || []) {
    const meta = state.videoMetaById?.get(v.video_id) || { actresses: [] }
    const actressesText = (meta.actresses || []).slice(0, 10).join('、')
    const sub = [
      v.content_id ? `番号：${v.content_id}` : '番号：',
      actressesText ? `女优：${actressesText}` : '女优：',
    ].join('\n')

    const card = el('div', { class: 'af-card' })
    card.appendChild(el('div', { class: 'af-card-title' }, [document.createTextNode(v.video_name)]))
    card.appendChild(el('div', { class: 'af-card-sub' }, [document.createTextNode(sub)]))
    card.addEventListener('click', async () => openModalFor('video', v))
    grid.appendChild(card)
  }

  if (grid.children.length === 0) {
    mount.appendChild(el('div', { class: 'af-empty' }, [document.createTextNode('没有匹配结果。')]))
    return
  }

  mount.appendChild(grid)
}

/* =========================
 * Public mount
 * ========================= */
export function mountSearchEditPage({ containerId = 'app' } = {}) {
  ensureStyles()
  const host = document.getElementById(containerId)
  if (!host) throw new Error(`Missing #${containerId}`)

  host.innerHTML = ''
  const page = el('div', { class: 'af-page' })

  const input = el('input', {
    class: 'af-input',
    type: 'text',
    placeholder: '输入影片名 / 番号 / 女优名…',
    autocomplete: 'off',
    id: `${containerId}-q`,
    name: `${containerId}-q`,
  })
  const btn = el('button', { class: 'af-btn', type: 'button', html: '检索' })
  const hint = el('div', { class: 'af-hint' }, [
    document.createTextNode('检索：影片名、番号、女优名（并返回该女优出演影片）。点击结果查看详情；详情右上角可编辑并保存。'),
  ])
  const resultMount = el('div')

  page.appendChild(el('div', { class: 'af-bar' }, [input, btn]))
  page.appendChild(hint)
  page.appendChild(resultMount)
  host.appendChild(page)

  let lastQuery = ''
  let lastState = { query: '', actresses: [], videos: [], videoMetaById: new Map(), error: null }

  async function refresh() {
    btn.disabled = true
    try {
      const data = await runSearch(lastQuery)
      lastState = { ...data, error: null }
      renderResults(resultMount, lastState, openModalFor)
    } catch (e) {
      lastState = { query: lastQuery, actresses: [], videos: [], videoMetaById: new Map(), error: e?.message ?? String(e) }
      renderResults(resultMount, lastState, openModalFor)
    } finally {
      btn.disabled = false
    }
  }

  async function run() {
    lastQuery = norm(input.value)
    await refresh()
  }

  async function openModalFor(kind, row) {
    try {
      if (kind === 'actress') {
        const detail = await fetchActressDetail(row.actress_id)
        openEntityModal({
          kind: 'actress',
          title: `女优：${detail.actress.actress_name}`,
          initialDetail: detail,
          onAfterSaved: refresh,
        })
      } else {
        const detail = await fetchVideoDetail(row.video_id)
        openEntityModal({
          kind: 'video',
          title: `影片：${detail.video.video_name}`,
          initialDetail: detail,
          onAfterSaved: refresh,
        })
      }
    } catch (e) {
      alert(`加载详情失败：${e?.message ?? String(e)}`)
    }
  }

  btn.addEventListener('click', run)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      run()
    }
  })

  renderResults(resultMount, lastState, openModalFor)
}
