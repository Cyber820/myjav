// src/search/search-browse.js
import { supabase } from '../supabaseClient.js'

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
      .af-title{font-size:18px;font-weight:900;margin:0 0 10px 0;}
      .af-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
      .af-input{
        width:min(720px,100%);
        box-sizing:border-box;
        border:1px solid rgba(0,0,0,.25);
        border-radius:10px;
        padding:10px 12px;
        font-size:14px;
      }
      .af-btn{
        border:1px solid rgba(0,0,0,.25);
        background:#fff;
        border-radius:10px;
        padding:10px 14px;
        cursor:pointer;
        font-size:13px;
      }
      .af-btn:disabled{opacity:.6;cursor:not-allowed;}
      .af-hint{margin-top:8px;font-size:12px;color:rgba(0,0,0,.65);}

      .af-grid{
        margin-top:12px;
        display:grid;
        grid-template-columns:repeat(auto-fill,minmax(240px,1fr));
        gap:10px;
        width:100%;
      }
      .af-card{
        border:1px solid rgba(0,0,0,.14);
        border-radius:12px;
        padding:10px;
        background:#fff;
      }
      .af-card-title{font-weight:800;font-size:14px;line-height:1.35;}
      .af-card-sub{
        margin-top:6px;
        font-size:12px;
        color:rgba(0,0,0,.65);
        white-space:pre-wrap;
      }
      .af-empty{margin-top:12px;font-size:12px;color:rgba(0,0,0,.6);}
      .af-err{
        margin-top:12px;
        color:#7a0000;
        background:rgba(200,0,0,.06);
        border:1px solid rgba(200,0,0,.25);
        border-radius:10px;
        padding:10px;
        white-space:pre-wrap;
      }
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

async function hydrateVideoCardMeta(videoIds) {
  const ids = (videoIds || []).filter(Boolean)
  const map = new Map()
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

async function runSearch(query) {
  const q = norm(query)
  if (!q) return { query: q, actresses: [], videos: [], videoMetaById: new Map() }

  const p1 = supabase.from('video').select('video_id, video_name, content_id').ilike('video_name', `%${q}%`).limit(50)
  const p2 = supabase.from('video').select('video_id, video_name, content_id').ilike('content_id', `%${q}%`).limit(50)
  const p3 = supabase.from('actress').select('actress_id, actress_name').ilike('actress_name', `%${q}%`).limit(50)

  const [r1, r2, r3] = await Promise.all([p1, p2, p3])
  const err = r1.error || r2.error || r3.error
  if (err) throw new Error(err.message)

  const videosByName = r1.data || []
  const videosByCid = r2.data || []
  const actresses = r3.data || []

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
      videosByActressLink = vrows || []
    }
  }

  const videos = uniqBy([...videosByName, ...videosByCid, ...videosByActressLink], v => `${v.video_id}`)
  const videoMetaById = await hydrateVideoCardMeta(videos.map(v => v.video_id))

  return { query: q, actresses, videos, videoMetaById }
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

  // 女优结果：只显示名字
  for (const a of state.actresses || []) {
    const card = el('div', { class: 'af-card' })
    card.appendChild(el('div', { class: 'af-card-title' }, [document.createTextNode(a.actress_name)]))
    grid.appendChild(card)
  }

  // 影片结果：显示片名 + 小字（番号 / 女优）
  for (const v of state.videos || []) {
    const meta = state.videoMetaById?.get(v.video_id) || { actresses: [] }
    const actressesText = (meta.actresses || []).slice(0, 10).join('、')
    const sub = [
      `番号：${v.content_id ?? ''}`,
      `女优：${actressesText ?? ''}`,
    ].join('\n')

    const card = el('div', { class: 'af-card' })
    card.appendChild(el('div', { class: 'af-card-title' }, [document.createTextNode(v.video_name)]))
    card.appendChild(el('div', { class: 'af-card-sub' }, [document.createTextNode(sub)]))
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

  const title = el('h1', { class: 'af-title' }, [document.createTextNode('MyJAV Browse')])

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
    document.createTextNode('检索：影片名、番号、女优名（并返回该女优出演影片）。'),
  ])

  const resultMount = el('div')

  page.appendChild(title)
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
      renderResults(resultMount, lastState)
    } catch (e) {
      lastState = { query: lastQuery, actresses: [], videos: [], videoMetaById: new Map(), error: e?.message ?? String(e) }
      renderResults(resultMount, lastState)
    } finally {
      btn.disabled = false
    }
  }

  async function run() {
    lastQuery = norm(input.value)
    await refresh()
  }

  btn.addEventListener('click', run)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      run()
    }
  })

  renderResults(resultMount, lastState)
}
