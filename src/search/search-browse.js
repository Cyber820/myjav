// src/search/search-browse.js
import { supabase } from '../supabaseClient.js'

/**
 * Browse Search + Filter
 * - 搜索：影片名 / 番号 / 女优名（并返回该女优出演影片）
 * - 结果：豆腐块展示，点开弹窗详情
 * - 筛选：本文件内实现（后续可拆分到 filter/ 目录）
 *
 * 筛选规则说明（可按需改）：
 * - 多选类（特点/制服/场景/标签）：命中“任意所选”即可（OR）
 *   若你想改成“必须包含全部所选”（AND），见 applyVideoFilters() 内注释。
 */

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
  if (document.getElementById('af-search-browse-style')) return
  const style = el('style', {
    id: 'af-search-browse-style',
    html: `
      .af-page{padding:12px;max-width:none;}
      .af-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;position:relative;}
      .af-input{width:min(720px,100%);box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:10px 12px;font-size:14px;}
      .af-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:10px 14px;cursor:pointer;}
      .af-btn:disabled{opacity:.6;cursor:not-allowed;}
      .af-hint{margin-top:8px;font-size:12px;color:rgba(0,0,0,.65);}

      .af-grid{margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;width:100%;}
      .af-card{border:1px solid rgba(0,0,0,.14);border-radius:12px;padding:10px;cursor:pointer;background:#fff;}
      .af-card:hover{background:rgba(0,0,0,.02);}
      .af-card-title{font-weight:700;font-size:14px;line-height:1.35;}
      .af-card-sub{margin-top:6px;font-size:12px;color:rgba(0,0,0,.65);white-space:pre-wrap;}
      .af-chip{display:inline-block;font-size:11px;border:1px solid rgba(0,0,0,.18);border-radius:999px;padding:2px 8px;margin-left:6px;color:rgba(0,0,0,.65);}
      .af-empty{margin-top:12px;font-size:12px;color:rgba(0,0,0,.6);}
      .af-err{margin-top:12px;color:#7a0000;background:rgba(200,0,0,.06);border:1px solid rgba(200,0,0,.25);border-radius:10px;padding:10px;white-space:pre-wrap;}

      .af-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}
      .af-modal{width:min(980px,100%);max-height:88vh;overflow:auto;background:#fff;border:1px solid rgba(0,0,0,.20);border-radius:12px;padding:12px;box-sizing:border-box;}
      .af-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
      .af-modal-title{font-size:15px;font-weight:800;}
      .af-kv{display:grid;grid-template-columns:180px 1fr;gap:8px 12px;align-items:start;}
      .af-k{font-size:12px;color:rgba(0,0,0,.65);padding-top:6px;}
      .af-v{font-size:13px;white-space:pre-wrap;word-break:break-word;border-bottom:1px dashed rgba(0,0,0,.10);padding:6px 0;}
      .af-modal-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:12px;}

      /* ===== Filter popover ===== */
      .af-pop{position:absolute;z-index:99998;top:52px;left:0;width:min(980px, calc(100vw - 24px));
        background:#fff;border:1px solid rgba(0,0,0,.18);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.12);
        padding:10px;display:none;
      }
      .af-pop.open{display:block;}
      .af-pop-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
      .af-pop-title{font-size:13px;font-weight:800;color:rgba(0,0,0,.8);}
      .af-pop-grid{display:grid;grid-template-columns:repeat(2, minmax(0,1fr));gap:10px;}
      @media (max-width: 860px){
        .af-pop-grid{grid-template-columns:1fr;}
      }
      .af-field{border:1px solid rgba(0,0,0,.12);border-radius:12px;padding:10px;}
      .af-field-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
      .af-field-title span{font-size:12px;font-weight:800;color:rgba(0,0,0,.75);}
      .af-xbtn{border:none;background:transparent;cursor:pointer;font-size:16px;line-height:1;opacity:.55;}
      .af-xbtn:hover{opacity:.85;}
      .af-select,.af-num,.af-ms-q{
        width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.22);border-radius:10px;padding:8px 10px;font-size:13px;background:#fff;
      }
      .af-ms-list{margin-top:8px;max-height:180px;overflow:auto;border:1px solid rgba(0,0,0,.10);border-radius:10px;padding:6px;}
      .af-ms-item{display:flex;align-items:center;gap:8px;padding:4px 2px;}
      .af-ms-item label{font-size:13px;color:rgba(0,0,0,.82);cursor:pointer;}
      .af-ms-badge{font-size:11px;color:rgba(0,0,0,.6);}
      .af-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .af-mini{font-size:11px;color:rgba(0,0,0,.6);margin-top:6px;}
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

function yearFromISODate(d) {
  if (!d || typeof d !== 'string') return null
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(d)
  if (!m) return null
  return Number(m[1])
}

function formatActressesWithAge({ actresses, publish_date }) {
  const pubYear = yearFromISODate(publish_date)
  return (actresses || []).map(a => {
    const name = a?.actress_name ?? ''
    const birthYear = yearFromISODate(a?.date_of_birth)
    if (pubYear && birthYear) {
      const age = pubYear - birthYear
      if (Number.isFinite(age) && age >= 0 && age <= 120) return `${name}（${age}）`
    }
    return name
  })
}

function clampRateOrNull(v) {
  const t = norm(v)
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n)) return NaN
  const k = Math.trunc(n)
  if (k < 0 || k > 100) return NaN
  return k
}

/* =========================
 * Search + bulk filterDoc hydration
 * ========================= */

async function runSearch(query) {
  const q = norm(query)
  if (!q) return { query: q, actresses: [], videos: [], videoMetaById: new Map(), videoFilterDocById: new Map() }

  // 这里直接把筛选需要的字段都取出来，避免筛选时额外点查
  const videoSelect = [
    'video_id',
    'video_name',
    'content_id',
    'publish_date',
    'censored',
    'publisher_id',
    'has_special',
    'length',
    'video_personal_rate',
    'personal_sex_rate',
    'overall_actress_personal_rate',
    'personal_acting_rate',
    'personal_voice_rate',
  ].join(', ')

  const p1 = supabase.from('video').select(videoSelect).ilike('video_name', `%${q}%`).limit(50)
  const p2 = supabase.from('video').select(videoSelect).ilike('content_id', `%${q}%`).limit(50)
  const p3 = supabase.from('actress').select('actress_id, actress_name').ilike('actress_name', `%${q}%`).limit(50)

  const [r1, r2, r3] = await Promise.all([p1, p2, p3])
  const err = r1.error || r2.error || r3.error
  if (err) throw new Error(err.message)

  const videosByName = (r1.data || []).map(v => ({ ...v, matched_by: 'video_name' }))
  const videosByCid = (r2.data || []).map(v => ({ ...v, matched_by: 'content_id' }))
  const actresses = (r3.data || [])

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
        .select(videoSelect)
        .in('video_id', videoIds)
        .limit(2000)
      if (e2) throw new Error(e2.message)
      videosByActressLink = (vrows || []).map(v => ({ ...v, matched_by: 'actress_link' }))
    }
  }

  const videos = uniqBy([...videosByName, ...videosByCid, ...videosByActressLink], v => `${v.video_id}`)

  // 卡片小字：女优名单（只要名字）
  const videoMetaById = await hydrateVideoCardMeta(videos.map(v => v.video_id))

  // 关键：为筛选批量生成 filterDoc（link ids + rates）
  const videoFilterDocById = await hydrateVideoFilterDocs(videos)

  return { query: q, actresses, videos, videoMetaById, videoFilterDocById }
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

async function hydrateVideoFilterDocs(videos) {
  const map = new Map()
  const ids = (videos || []).map(v => v.video_id).filter(Boolean)
  if (!ids.length) return map

  const emptyLinks = () => ({
    actress_type_ids: [],
    costume_ids: [],
    scene_ids: [],
    tag_ids: [],
  })

  // 先塞基础字段（来自 video 表）
  for (const v of videos) {
    map.set(v.video_id, {
      video_id: v.video_id,
      publish_date: v.publish_date ?? null,
      censored: v.censored ?? null,
      has_special: v.has_special ?? null,
      publisher_id: v.publisher_id ?? null,
      rates: {
        video_personal_rate: v.video_personal_rate ?? null,
        personal_sex_rate: v.personal_sex_rate ?? null,
        overall_actress_personal_rate: v.overall_actress_personal_rate ?? null,
        personal_acting_rate: v.personal_acting_rate ?? null,
        personal_voice_rate: v.personal_voice_rate ?? null,
        length: v.length ?? null,
      },
      linkIds: emptyLinks(),
    })
  }

  const loadLinkMap = async (linkTable, idCol) => {
    const { data, error } = await supabase
      .from(linkTable)
      .select(`video_id, ${idCol}`)
      .in('video_id', ids)
      .limit(10000)
    if (error) throw new Error(error.message)
    const out = new Map()
    for (const row of (data || [])) {
      const vid = row.video_id
      const tid = row[idCol]
      if (!vid || !tid) continue
      if (!out.has(vid)) out.set(vid, [])
      out.get(vid).push(tid)
    }
    // 去重
    for (const [k, arr] of out) out.set(k, uniqBy(arr, x => `${x}`))
    return out
  }

  const [mType, mCostume, mScene, mTag] = await Promise.all([
    loadLinkMap('actress_type_in_video', 'actress_type_id'),
    loadLinkMap('costume_in_video', 'costume_id'),
    loadLinkMap('video_scene', 'scene_id'),
    loadLinkMap('video_tag', 'tag_id'),
  ])

  for (const vid of ids) {
    const doc = map.get(vid)
    if (!doc) continue
    doc.linkIds.actress_type_ids = mType.get(vid) || []
    doc.linkIds.costume_ids = mCostume.get(vid) || []
    doc.linkIds.scene_ids = mScene.get(vid) || []
    doc.linkIds.tag_ids = mTag.get(vid) || []
  }

  return map
}

/* =========================
 * Detail fetching (for modal)
 * ========================= */

async function fetchVideoDetail(video_id) {
  const { data: video, error: e0 } = await supabase.from('video').select('*').eq('video_id', video_id).single()
  if (e0) throw new Error(e0.message)

  let publisherName = null
  if (video.publisher_id != null) {
    const { data: p, error: eP } = await supabase
      .from('publisher')
      .select('publisher_name')
      .eq('publisher_id', video.publisher_id)
      .single()
    if (!eP) publisherName = p?.publisher_name ?? null
  }

  const loadLinkIds = async (linkTable, idCol) => {
    const { data: links, error } = await supabase
      .from(linkTable)
      .select(idCol)
      .eq('video_id', video_id)
      .limit(5000)
    if (error) throw new Error(error.message)
    return uniqBy((links || []).map(x => x[idCol]).filter(Boolean), x => `${x}`)
  }

  const fetchNamesByIds = async (table, idCol, nameCol, ids) => {
    const list = (ids || []).filter(Boolean)
    if (!list.length) return []
    const { data: rows, error } = await supabase
      .from(table)
      .select(`${idCol}, ${nameCol}`)
      .in(idCol, list)
      .limit(5000)
    if (error) throw new Error(error.message)
    const nameById = new Map((rows || []).map(r => [r[idCol], r[nameCol]]))
    return list.map(id => nameById.get(id)).filter(Boolean)
  }

  // actresses with DOB for age calc
  const actress_ids = await loadLinkIds('actress_in_video', 'actress_id')
  let actresses = []
  if (actress_ids.length) {
    const { data: rows, error } = await supabase
      .from('actress')
      .select('actress_id, actress_name, date_of_birth')
      .in('actress_id', actress_ids)
      .limit(5000)
    if (error) throw new Error(error.message)
    const byId = new Map((rows || []).map(r => [r.actress_id, r]))
    actresses = actress_ids.map(id => byId.get(id)).filter(Boolean)
  }

  const actress_type_ids = await loadLinkIds('actress_type_in_video', 'actress_type_id')
  const costume_ids = await loadLinkIds('costume_in_video', 'costume_id')
  const scene_ids = await loadLinkIds('video_scene', 'scene_id')
  const tag_ids = await loadLinkIds('video_tag', 'tag_id')

  const [actressTypes, costumes, scenes, tags] = await Promise.all([
    fetchNamesByIds('actress_type', 'actress_type_id', 'actress_type_name', actress_type_ids),
    fetchNamesByIds('costume', 'costume_id', 'costume_name', costume_ids),
    fetchNamesByIds('scene', 'scene_id', 'scene_name', scene_ids),
    fetchNamesByIds('tag', 'tag_id', 'tag_name', tag_ids),
  ])

  // filterDoc（与列表缓存结构一致，后续你要做“详情里点筛选”也可复用）
  const filterDoc = {
    video_id: video.video_id,
    publish_date: video.publish_date ?? null,
    censored: video.censored ?? null,
    has_special: video.has_special ?? null,
    publisher_id: video.publisher_id ?? null,
    rates: {
      video_personal_rate: video.video_personal_rate ?? null,
      personal_sex_rate: video.personal_sex_rate ?? null,
      overall_actress_personal_rate: video.overall_actress_personal_rate ?? null,
      personal_acting_rate: video.personal_acting_rate ?? null,
      personal_voice_rate: video.personal_voice_rate ?? null,
      length: video.length ?? null,
    },
    linkIds: {
      actress_ids,
      actress_type_ids,
      costume_ids,
      scene_ids,
      tag_ids,
    },
  }

  return {
    kind: 'video',
    video,
    publisherName,
    actresses,       // [{ actress_id, actress_name, date_of_birth }]
    actressTypes,    // [name...]
    costumes,        // [name...]
    scenes,          // [name...]
    tags,            // [name...]
    filterDoc,
  }
}

async function fetchActressDetail(actress_id) {
  const { data: actress, error: e0 } = await supabase.from('actress').select('*').eq('actress_id', actress_id).single()
  if (e0) throw new Error(e0.message)
  return { kind: 'actress', actress }
}

function openDetailModal({ title, rows }) {
  const overlay = document.createElement('div')
  overlay.className = 'af-modal-overlay'
  const modal = document.createElement('div')
  modal.className = 'af-modal'
  overlay.appendChild(modal)

  const head = el('div', { class: 'af-modal-head' }, [
    el('div', { class: 'af-modal-title' }, [document.createTextNode(title)]),
    el('button', { class: 'af-btn', type: 'button', html: '关闭', onclick: () => close() }),
  ])

  const kv = el('div', { class: 'af-kv' })
  for (const { k, v } of rows) {
    kv.appendChild(el('div', { class: 'af-k' }, [document.createTextNode(k)]))
    kv.appendChild(el('div', { class: 'af-v' }, [document.createTextNode(v ?? '')]))
  }

  const foot = el('div', { class: 'af-modal-foot' }, [
    el('button', { class: 'af-btn', type: 'button', html: '关闭', onclick: () => close() }),
  ])

  modal.appendChild(head)
  modal.appendChild(kv)
  modal.appendChild(foot)

  function close() {
    overlay.remove()
    document.removeEventListener('keydown', onEsc)
  }
  function onEsc(e) {
    if (e.key === 'Escape') close()
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  document.addEventListener('keydown', onEsc)

  document.body.appendChild(overlay)
}

function videoDetailRows(d) {
  const v = d.video
  const actressLines = formatActressesWithAge({ actresses: d.actresses || [], publish_date: v.publish_date }).join('\n')

  return [
    { k: '影片名称', v: v.video_name ?? '' },
    { k: '番号', v: v.content_id ?? '' },
    { k: '发售日期', v: v.publish_date ?? '' },
    { k: '厂商', v: d.publisherName ?? '' },
    { k: '有码', v: v.censored === true ? '有码' : (v.censored === false ? '无码' : '') },
    { k: '长度（分钟）', v: v.length != null ? String(v.length) : '' },

    { k: '出演女优', v: actressLines },
    { k: '女优特点', v: (d.actressTypes || []).join('、') },
    { k: '制服', v: (d.costumes || []).join('、') },
    { k: '场景', v: (d.scenes || []).join('、') },
    { k: '标签', v: (d.tags || []).join('、') },

    { k: '总体评分', v: v.video_personal_rate != null ? String(v.video_personal_rate) : '' },
    { k: 'XXX评分', v: v.personal_sex_rate != null ? String(v.personal_sex_rate) : '' },
    { k: '女优评分', v: v.overall_actress_personal_rate != null ? String(v.overall_actress_personal_rate) : '' },
    { k: '演技评分', v: v.personal_acting_rate != null ? String(v.personal_acting_rate) : '' },
    { k: '声音评分', v: v.personal_voice_rate != null ? String(v.personal_voice_rate) : '' },

    { k: '情节', v: v.storyline ?? '' },
    { k: '猎奇', v: v.has_special === true ? '是' : (v.has_special === false ? '无' : '') },
    { k: '猎奇内容', v: v.special ?? '' },
    { k: '个人点评', v: v.personal_comment ?? '' },
  ]
}

function actressDetailRows(d) {
  const a = d.actress
  return [
    { k: '名称', v: a.actress_name ?? '' },
    { k: '生日', v: a.date_of_birth ?? '' },
    { k: '身高', v: a.height != null ? String(a.height) : '' },
    { k: '罩杯', v: a.cup ?? '' },
    { k: '个人评分', v: a.personal_rate != null ? String(a.personal_rate) : '' },
    { k: '个人评价', v: a.personal_comment ?? '' },
  ]
}

function labelMatchedBy(m) {
  if (m === 'video_name') return '影片名'
  if (m === 'content_id') return '番号'
  if (m === 'actress_link') return '女优关联'
  return '匹配'
}

/* =========================
 * Filter UI + state
 * ========================= */

function defaultFilterState() {
  return {
    censored: 'any',      // 'any' | 'true' | 'false'
    has_special: 'any',   // 'any' | 'true' | 'false'
    actress_type_ids: new Set(),
    costume_ids: new Set(),
    scene_ids: new Set(),
    tag_ids: new Set(),
    min_video_personal_rate: null,
    min_personal_sex_rate: null,
    min_overall_actress_personal_rate: null,
    min_personal_acting_rate: null,
    min_personal_voice_rate: null,
  }
}

async function loadMetaOptions() {
  // 只取 id + name；你的这些表结构都是 (id, name)
  const queries = await Promise.all([
    supabase.from('actress_type').select('actress_type_id, actress_type_name').order('actress_type_name', { ascending: true }),
    supabase.from('costume').select('costume_id, costume_name').order('costume_name', { ascending: true }),
    supabase.from('scene').select('scene_id, scene_name').order('scene_name', { ascending: true }),
    supabase.from('tag').select('tag_id, tag_name').order('tag_name', { ascending: true }),
  ])
  const err = queries.find(r => r.error)?.error
  if (err) throw new Error(err.message)

  const [rType, rCostume, rScene, rTag] = queries
  return {
    actress_type: (rType.data || []).map(x => ({ id: x.actress_type_id, name: x.actress_type_name })),
    costume: (rCostume.data || []).map(x => ({ id: x.costume_id, name: x.costume_name })),
    scene: (rScene.data || []).map(x => ({ id: x.scene_id, name: x.scene_name })),
    tag: (rTag.data || []).map(x => ({ id: x.tag_id, name: x.tag_name })),
  }
}

function createMultiSelectField({ title, options, selectedSet, onChange }) {
  const q = el('input', { class: 'af-ms-q', type: 'text', placeholder: '搜索…' })
  const list = el('div', { class: 'af-ms-list' })
  const badge = el('span', { class: 'af-ms-badge' }, [document.createTextNode('')])

  const btnClear = el('button', {
    type: 'button',
    class: 'af-xbtn',
    html: '×',
    onclick: () => { selectedSet.clear(); onChange(); render() },
    title: '清空已选',
  })

  const head = el('div', { class: 'af-field-title' }, [
    el('span', {}, [document.createTextNode(title), document.createTextNode(' '), badge]),
    btnClear,
  ])

  function render() {
    const kw = norm(q.value).toLowerCase()
    list.innerHTML = ''
    const filtered = (options || []).filter(o => !kw || (o.name || '').toLowerCase().includes(kw))
    for (const o of filtered) {
      const idStr = String(o.id)
      const checked = selectedSet.has(idStr)
      const cb = el('input', {
        type: 'checkbox',
        checked: checked ? 'true' : null,
        onchange: () => {
          if (cb.checked) selectedSet.add(idStr)
          else selectedSet.delete(idStr)
          onChange()
          renderBadge()
        },
      })
      const label = el('label', {}, [document.createTextNode(o.name)])
      const row = el('div', { class: 'af-ms-item' }, [cb, label])
      list.appendChild(row)
    }
    renderBadge()
  }

  function renderBadge() {
    const n = selectedSet.size
    badge.textContent = n ? `（已选 ${n}）` : '（全部）'
  }

  q.addEventListener('input', render)

  const wrap = el('div', { class: 'af-field' }, [head, q, list])
  render()

  return { element: wrap, render }
}

function applyVideoFilters({ videos, videoFilterDocById, filter }) {
  const out = []

  const parseBoolMode = (mode) => {
    if (mode === 'true') return true
    if (mode === 'false') return false
    return null // any
  }

  const censoredMode = parseBoolMode(filter.censored)
  const specialMode = parseBoolMode(filter.has_special)

  const minVideo = filter.min_video_personal_rate
  const minSex = filter.min_personal_sex_rate
  const minActress = filter.min_overall_actress_personal_rate
  const minActing = filter.min_personal_acting_rate
  const minVoice = filter.min_personal_voice_rate

  const anyHit = (needSet, haveIds) => {
    // “命中任意所选即可（OR）”
    if (!needSet || needSet.size === 0) return true
    if (!haveIds || haveIds.length === 0) return false
    for (const id of haveIds) if (needSet.has(String(id))) return true
    return false

    // 若你想改为“必须包含全部所选（AND）”，用下面这段替换：
    // for (const need of needSet) if (!haveIds.map(String).includes(String(need))) return false
    // return true
  }

  const minOk = (val, min) => {
    if (min === null || min === undefined) return true
    if (val === null || val === undefined) return false
    const n = Number(val)
    return Number.isFinite(n) && n >= min
  }

  for (const v of (videos || [])) {
    const doc = videoFilterDocById?.get(v.video_id)
    if (!doc) continue

    if (censoredMode !== null) {
      if (doc.censored !== censoredMode) continue
    }
    if (specialMode !== null) {
      if (doc.has_special !== specialMode) continue
    }

    // 多选类
    if (!anyHit(filter.actress_type_ids, doc.linkIds?.actress_type_ids)) continue
    if (!anyHit(filter.costume_ids, doc.linkIds?.costume_ids)) continue
    if (!anyHit(filter.scene_ids, doc.linkIds?.scene_ids)) continue
    if (!anyHit(filter.tag_ids, doc.linkIds?.tag_ids)) continue

    // 最低评分
    if (!minOk(doc.rates?.video_personal_rate, minVideo)) continue
    if (!minOk(doc.rates?.personal_sex_rate, minSex)) continue
    if (!minOk(doc.rates?.overall_actress_personal_rate, minActress)) continue
    if (!minOk(doc.rates?.personal_acting_rate, minActing)) continue
    if (!minOk(doc.rates?.personal_voice_rate, minVoice)) continue

    out.push(v)
  }

  return out
}

/* =========================
 * Render results
 * ========================= */

function renderResults(mount, state, filteredVideos) {
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

  // 女优结果（不参与筛选）
  for (const a of state.actresses || []) {
    const card = el('div', { class: 'af-card' })
    card.appendChild(el('div', { class: 'af-card-title' }, [document.createTextNode(a.actress_name)]))
    card.appendChild(el('div', { class: 'af-card-sub' }, [document.createTextNode('女优')]))
    card.addEventListener('click', async () => {
      try {
        const d = await fetchActressDetail(a.actress_id)
        openDetailModal({ title: `女优：${a.actress_name}`, rows: actressDetailRows(d) })
      } catch (e) {
        alert(`加载详情失败：${e?.message ?? String(e)}`)
      }
    })
    grid.appendChild(card)
  }

  // 影片结果（参与筛选）
  for (const v of filteredVideos || []) {
    const meta = state.videoMetaById?.get(v.video_id) || { actresses: [] }
    const actressesText = (meta.actresses || []).slice(0, 8).join('、')
    const sub = [
      v.content_id ? `番号：${v.content_id}` : '番号：',
      actressesText ? `女优：${actressesText}` : '女优：',
    ].join('\n')

    const card = el('div', { class: 'af-card' })
    card.appendChild(el('div', { class: 'af-card-title' }, [
      document.createTextNode(v.video_name),
      el('span', { class: 'af-chip' }, [document.createTextNode(labelMatchedBy(v.matched_by))]),
    ]))
    card.appendChild(el('div', { class: 'af-card-sub' }, [document.createTextNode(sub)]))
    card.addEventListener('click', async () => {
      try {
        const d = await fetchVideoDetail(v.video_id)
        openDetailModal({ title: `影片：${v.video_name}`, rows: videoDetailRows(d) })
      } catch (e) {
        alert(`加载详情失败：${e?.message ?? String(e)}`)
      }
    })
    grid.appendChild(card)
  }

  if (grid.children.length === 0) {
    mount.appendChild(el('div', { class: 'af-empty' }, [document.createTextNode('没有匹配结果。')]))
    return
  }

  mount.appendChild(grid)
}

/* =========================
 * Mount page
 * ========================= */

export function mountSearchBrowsePage({ containerId = 'app' } = {}) {
  ensureStyles()
  const host = document.getElementById(containerId)
  if (!host) throw new Error(`Missing #${containerId}`)

  host.innerHTML = ''
  const page = el('div', { class: 'af-page' })

  // search controls
  const btnFilter = el('button', { class: 'af-btn', type: 'button', html: '筛选' })
  const input = el('input', { class: 'af-input', type: 'text', placeholder: '输入影片名 / 番号 / 女优名…', autocomplete: 'off' })
  const btnSearch = el('button', { class: 'af-btn', type: 'button', html: '检索' })

  const hint = el('div', { class: 'af-hint' }, [
    document.createTextNode('检索：影片名、番号、女优名（并返回该女优出演影片）。筛选只作用于影片结果。'),
  ])
  const resultMount = el('div')

  const bar = el('div', { class: 'af-bar' }, [btnFilter, input, btnSearch])

  // filter popover
  const pop = el('div', { class: 'af-pop', id: 'af-filter-pop' })
  bar.appendChild(pop)

  page.appendChild(bar)
  page.appendChild(hint)
  page.appendChild(resultMount)
  host.appendChild(page)

  // state
  let meta = null
  let metaLoading = false
  let metaError = null

  const filter = defaultFilterState()

  let lastState = {
    query: '',
    actresses: [],
    videos: [],
    videoMetaById: new Map(),
    videoFilterDocById: new Map(),
    error: null,
  }

  function computeFilteredVideos() {
    return applyVideoFilters({
      videos: lastState.videos || [],
      videoFilterDocById: lastState.videoFilterDocById || new Map(),
      filter,
    })
  }

  function rerender() {
    const filteredVideos = computeFilteredVideos()
    renderResults(resultMount, lastState, filteredVideos)
  }

  // open/close filter pop
  function closePop() {
    pop.classList.remove('open')
  }
  function openPop() {
    pop.classList.add('open')
  }
  function togglePop() {
    if (pop.classList.contains('open')) closePop()
    else openPop()
  }

  btnFilter.addEventListener('click', async () => {
    togglePop()
    if (!pop.classList.contains('open')) return

    if (!meta && !metaLoading && !metaError) {
      metaLoading = true
      try {
        meta = await loadMetaOptions()
      } catch (e) {
        metaError = e?.message ?? String(e)
      } finally {
        metaLoading = false
      }
    }
    renderFilterUI()
  })

  document.addEventListener('click', (e) => {
    if (!pop.classList.contains('open')) return
    if (bar.contains(e.target)) return
    closePop()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePop()
  })

  // Build filter UI
  let uiMounted = false
  let msType, msCostume, msScene, msTag

  function renderFilterUI() {
    pop.innerHTML = ''

    const head = el('div', { class: 'af-pop-head' }, [
      el('div', { class: 'af-pop-title' }, [document.createTextNode('筛选')]),
      el('button', { class: 'af-btn', type: 'button', html: '关闭', onclick: () => closePop() }),
    ])
    pop.appendChild(head)

    if (metaError) {
      pop.appendChild(el('div', { class: 'af-err', html: `筛选数据加载失败：${metaError}` }))
      return
    }
    if (!meta) {
      pop.appendChild(el('div', { class: 'af-empty' }, [document.createTextNode('正在加载筛选选项…')]))
      return
    }

    const grid = el('div', { class: 'af-pop-grid' })

    // A. 是否有码
    const selCensored = el('select', { class: 'af-select' }, [
      el('option', { value: 'any' }, [document.createTextNode('皆可（默认）')]),
      el('option', { value: 'true' }, [document.createTextNode('有')]),
      el('option', { value: 'false' }, [document.createTextNode('无')]),
    ])
    selCensored.value = filter.censored
    selCensored.addEventListener('change', () => { filter.censored = selCensored.value; rerender() })

    const fieldCensored = el('div', { class: 'af-field' }, [
      el('div', { class: 'af-field-title' }, [
        el('span', {}, [document.createTextNode('是否有码')]),
        el('button', {
          type: 'button',
          class: 'af-xbtn',
          html: '×',
          title: '恢复默认（皆可）',
          onclick: () => { filter.censored = 'any'; selCensored.value = 'any'; rerender() },
        }),
      ]),
      selCensored,
    ])
    grid.appendChild(fieldCensored)

    // K. 是否猎奇
    const selSpecial = el('select', { class: 'af-select' }, [
      el('option', { value: 'any' }, [document.createTextNode('皆可（默认）')]),
      el('option', { value: 'true' }, [document.createTextNode('有')]),
      el('option', { value: 'false' }, [document.createTextNode('无')]),
    ])
    selSpecial.value = filter.has_special
    selSpecial.addEventListener('change', () => { filter.has_special = selSpecial.value; rerender() })

    const fieldSpecial = el('div', { class: 'af-field' }, [
      el('div', { class: 'af-field-title' }, [
        el('span', {}, [document.createTextNode('是否猎奇')]),
        el('button', {
          type: 'button',
          class: 'af-xbtn',
          html: '×',
          title: '恢复默认（皆可）',
          onclick: () => { filter.has_special = 'any'; selSpecial.value = 'any'; rerender() },
        }),
      ]),
      selSpecial,
    ])
    grid.appendChild(fieldSpecial)

    // B/C/D/E 多选
    msType = createMultiSelectField({
      title: '女优特点',
      options: meta.actress_type,
      selectedSet: filter.actress_type_ids,
      onChange: () => rerender(),
    })
    msCostume = createMultiSelectField({
      title: '制服',
      options: meta.costume,
      selectedSet: filter.costume_ids,
      onChange: () => rerender(),
    })
    msScene = createMultiSelectField({
      title: '场景',
      options: meta.scene,
      selectedSet: filter.scene_ids,
      onChange: () => rerender(),
    })
    msTag = createMultiSelectField({
      title: '标签',
      options: meta.tag,
      selectedSet: filter.tag_ids,
      onChange: () => rerender(),
    })

    grid.appendChild(msType.element)
    grid.appendChild(msCostume.element)
    grid.appendChild(msScene.element)
    grid.appendChild(msTag.element)

    // F～J 最低评分
    const makeMinRateField = (title, key) => {
      const input = el('input', { class: 'af-num', type: 'number', min: '0', max: '100', step: '1', placeholder: '不填写则不筛选' })
      input.value = filter[key] == null ? '' : String(filter[key])
      input.addEventListener('input', () => {
        const v = clampRateOrNull(input.value)
        if (Number.isNaN(v)) return
        filter[key] = v
        rerender()
      })
      const clear = el('button', {
        type: 'button',
        class: 'af-xbtn',
        html: '×',
        title: '清空',
        onclick: () => { filter[key] = null; input.value = ''; rerender() },
      })
      return el('div', { class: 'af-field' }, [
        el('div', { class: 'af-field-title' }, [el('span', {}, [document.createTextNode(title)]), clear]),
        input,
        el('div', { class: 'af-mini' }, [document.createTextNode('范围：0-100；空=不筛')]),
      ])
    }

    grid.appendChild(makeMinRateField('最低总体评分', 'min_video_personal_rate'))
    grid.appendChild(makeMinRateField('最低XXX评分', 'min_personal_sex_rate'))
    grid.appendChild(makeMinRateField('最低女优评分', 'min_overall_actress_personal_rate'))
    grid.appendChild(makeMinRateField('最低演技评分', 'min_personal_acting_rate'))
    grid.appendChild(makeMinRateField('最低声音评分', 'min_personal_voice_rate'))

    pop.appendChild(grid)

    // footer ops
    const btnReset = el('button', {
      class: 'af-btn',
      type: 'button',
      html: '重置全部筛选',
      onclick: () => {
        const d = defaultFilterState()
        filter.censored = d.censored
        filter.has_special = d.has_special
        filter.actress_type_ids.clear()
        filter.costume_ids.clear()
        filter.scene_ids.clear()
        filter.tag_ids.clear()
        filter.min_video_personal_rate = null
        filter.min_personal_sex_rate = null
        filter.min_overall_actress_personal_rate = null
        filter.min_personal_acting_rate = null
        filter.min_personal_voice_rate = null

        // 重新渲染整个 pop（让控件同步回默认值）
        renderFilterUI()
        rerender()
      },
    })

    const btnApply = el('button', {
      class: 'af-btn',
      type: 'button',
      html: '应用筛选',
      onclick: () => { rerender(); closePop() },
    })

    pop.appendChild(el('div', { class: 'af-modal-foot' }, [btnReset, btnApply]))
    uiMounted = true
  }

  // initial render (empty)
  rerender()

  async function run() {
    const q = norm(input.value)
    btnSearch.disabled = true
    try {
      const data = await runSearch(q)
      lastState = { ...data, error: null }
      rerender()
    } catch (e) {
      lastState = {
        query: q,
        actresses: [],
        videos: [],
        videoMetaById: new Map(),
        videoFilterDocById: new Map(),
        error: e?.message ?? String(e),
      }
      rerender()
    } finally {
      btnSearch.disabled = false
    }
  }

  btnSearch.addEventListener('click', run)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      run()
    }
  })
}
