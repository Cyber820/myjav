// src/search/search-browse.js
import { supabase } from '../supabaseClient.js'

/**
 * Search (Browse/Filter route)
 * - 满足当前：搜索 + 豆腐块结果 + 点击弹窗详情
 * - 不提供编辑入口
 * - 为后续 filter 做准备：video detail 返回 filterDoc（结构化字段）
 *
 * 本版更新：
 * 1) 详情弹窗加入 XXX评分（video.personal_sex_rate）
 * 2) 详情弹窗“出演女优”一行一个名字；若有生日(date_of_birth)+发售日期(publish_date)，显示发售时年龄（发售年-出生年）
 * 3) fetchVideoDetail 返回 filterDoc：包含可过滤字段与关联 ids
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
      .af-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
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
  // actresses: [{ actress_id, actress_name, date_of_birth }]
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

async function runSearch(query) {
  const q = norm(query)
  if (!q) return { query: q, actresses: [], videos: [], videoMetaById: new Map() }

  const p1 = supabase
    .from('video')
    .select('video_id, video_name, content_id, publish_date, censored, publisher_id')
    .ilike('video_name', `%${q}%`)
    .limit(50)

  const p2 = supabase
    .from('video')
    .select('video_id, video_name, content_id, publish_date, censored, publisher_id')
    .ilike('content_id', `%${q}%`)
    .limit(50)

  const p3 = supabase
    .from('actress')
    .select('actress_id, actress_name')
    .ilike('actress_name', `%${q}%`)
    .limit(50)

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
        .select('video_id, video_name, content_id, publish_date, censored, publisher_id')
        .in('video_id', videoIds)
        .limit(2000)
      if (e2) throw new Error(e2.message)
      videosByActressLink = (vrows || []).map(v => ({ ...v, matched_by: 'actress_link' }))
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

async function fetchVideoDetail(video_id) {
  const { data: video, error: e0 } = await supabase.from('video').select('*').eq('video_id', video_id).single()
  if (e0) throw new Error(e0.message)

  // publisher name（展示用）
  let publisherName = null
  if (video.publisher_id != null) {
    const { data: p, error: eP } = await supabase
      .from('publisher')
      .select('publisher_name')
      .eq('publisher_id', video.publisher_id)
      .single()
    if (!eP) publisherName = p?.publisher_name ?? null
  }

  // 统一：从 link 表取 ids（过滤用）
  const loadLinkIds = async (linkTable, idCol) => {
    const { data: links, error } = await supabase
      .from(linkTable)
      .select(idCol)
      .eq('video_id', video_id)
      .limit(5000)
    if (error) throw new Error(error.message)
    return uniqBy((links || []).map(x => x[idCol]).filter(Boolean), x => `${x}`)
  }

  // 从目标表按 ids 取 name（展示用）
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

  // actresses：展示需要 date_of_birth（用于年龄）
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

  // other link ids（过滤用）
  const actress_type_ids = await loadLinkIds('actress_type_in_video', 'actress_type_id')
  const costume_ids = await loadLinkIds('costume_in_video', 'costume_id')
  const scene_ids = await loadLinkIds('video_scene', 'scene_id')
  const tag_ids = await loadLinkIds('video_tag', 'tag_id')

  // other names（展示用）
  const [actressTypes, costumes, scenes, tags] = await Promise.all([
    fetchNamesByIds('actress_type', 'actress_type_id', 'actress_type_name', actress_type_ids),
    fetchNamesByIds('costume', 'costume_id', 'costume_name', costume_ids),
    fetchNamesByIds('scene', 'scene_id', 'scene_name', scene_ids),
    fetchNamesByIds('tag', 'tag_id', 'tag_name', tag_ids),
  ])

  // ✅ 结构化 filterDoc：后续 filter-engine 直接吃这个
  const filterDoc = {
    video_id: video.video_id,
    publish_date: video.publish_date ?? null,
    censored: video.censored ?? null,
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
    filterDoc,       // ✅
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

function renderResults(mount, state) {
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

  for (const v of state.videos || []) {
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

export function mountSearchBrowsePage({ containerId = 'app' } = {}) {
  ensureStyles()
  const host = document.getElementById(containerId)
  if (!host) throw new Error(`Missing #${containerId}`)

  host.innerHTML = ''
  const page = el('div', { class: 'af-page' })

  const input = el('input', { class: 'af-input', type: 'text', placeholder: '输入影片名 / 番号 / 女优名…', autocomplete: 'off' })
  const btn = el('button', { class: 'af-btn', type: 'button', html: '检索' })
  const hint = el('div', { class: 'af-hint' }, [
    document.createTextNode('检索：影片名、番号、女优名（并返回该女优出演影片）。后续可在此分支加入过滤功能。'),
  ])
  const resultMount = el('div')

  page.appendChild(el('div', { class: 'af-bar' }, [input, btn]))
  page.appendChild(hint)
  page.appendChild(resultMount)
  host.appendChild(page)

  let lastState = { query: '', actresses: [], videos: [], videoMetaById: new Map(), error: null }
  renderResults(resultMount, lastState)

  async function run() {
    const q = norm(input.value)
    btn.disabled = true
    try {
      const data = await runSearch(q)
      lastState = { ...data, error: null }
      renderResults(resultMount, lastState)
    } catch (e) {
      lastState = { query: q, actresses: [], videos: [], videoMetaById: new Map(), error: e?.message ?? String(e) }
      renderResults(resultMount, lastState)
    } finally {
      btn.disabled = false
    }
  }

  btn.addEventListener('click', run)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      run()
    }
  })
}
