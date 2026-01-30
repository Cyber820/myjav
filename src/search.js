// src/search.js
import { supabase } from './supabaseClient.js'
import { renderSearchResults } from './search-results.js'

/**
 * 简易检索（不含过滤）
 * 输入 query 后执行：
 * 1) video.video_name ilike %q% -> 返回 video_name (+ video_id)
 * 2) video.content_id ilike %q% -> 返回 video_name (+ video_id)
 * 3) actress.actress_name ilike %q% -> 返回 actress_name (+ actress_id)
 *    并且根据 actress_in_video 找到相关 video_id，再回查 video_name 返回
 *
 * 输出结构（给渲染层）：
 * {
 *   query: string,
 *   videos: [{ video_id, video_name, matched_by: 'video_name'|'content_id'|'actress_link' }],
 *   actresses: [{ actress_id, actress_name }],
 *   meta: { took_ms, counts... },
 *   error?: string
 * }
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
  if (document.getElementById('af-search-style')) return
  const style = el('style', {
    id: 'af-search-style',
    html: `
      .af-search-wrap{padding:12px;}
      .af-search-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
      .af-search-input{width:min(560px,100%);box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:8px 10px;font-size:14px;}
      .af-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;}
      .af-btn:disabled{opacity:.6;cursor:not-allowed;}
      .af-search-hint{margin-top:8px;font-size:12px;color:rgba(0,0,0,.65);}
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

async function searchCore(query) {
  const t0 = performance.now()
  const q = norm(query)
  if (!q) {
    return {
      query: q,
      videos: [],
      actresses: [],
      meta: { took_ms: Math.round(performance.now() - t0), empty: true },
    }
  }

  // 1) video_name match
  const pVideoName = supabase
    .from('video')
    .select('video_id, video_name')
    .ilike('video_name', `%${q}%`)
    .limit(50)

  // 2) content_id match
  const pContentId = supabase
    .from('video')
    .select('video_id, video_name')
    .ilike('content_id', `%${q}%`)
    .limit(50)

  // 3) actress_name match
  const pActress = supabase
    .from('actress')
    .select('actress_id, actress_name')
    .ilike('actress_name', `%${q}%`)
    .limit(50)

  const [r1, r2, r3] = await Promise.all([pVideoName, pContentId, pActress])

  // 统一错误处理
  const err = r1.error || r2.error || r3.error
  if (err) {
    return {
      query: q,
      videos: [],
      actresses: [],
      meta: { took_ms: Math.round(performance.now() - t0) },
      error: err.message,
    }
  }

  const videosByName = (r1.data || []).map(v => ({ ...v, matched_by: 'video_name' }))
  const videosByCid = (r2.data || []).map(v => ({ ...v, matched_by: 'content_id' }))
  const actresses = (r3.data || [])

  // 3-b) actress -> actress_in_video -> video -> video_name
  let videosByActressLink = []
  if (actresses.length > 0) {
    const actressIds = actresses.map(a => a.actress_id)

    const { data: links, error: linkErr } = await supabase
      .from('actress_in_video')
      .select('video_id, actress_id')
      .in('actress_id', actressIds)
      .limit(2000)

    if (linkErr) {
      return {
        query: q,
        videos: [],
        actresses,
        meta: { took_ms: Math.round(performance.now() - t0) },
        error: linkErr.message,
      }
    }

    const videoIds = uniqBy((links || []).map(x => x.video_id), x => `${x}`)
    if (videoIds.length > 0) {
      const { data: vrows, error: vErr } = await supabase
        .from('video')
        .select('video_id, video_name')
        .in('video_id', videoIds)
        .limit(2000)

      if (vErr) {
        return {
          query: q,
          videos: [],
          actresses,
          meta: { took_ms: Math.round(performance.now() - t0) },
          error: vErr.message,
        }
      }

      videosByActressLink = (vrows || []).map(v => ({ ...v, matched_by: 'actress_link' }))
    }
  }

  // 合并视频结果：按 video_id 去重（同一个 video 可能同时匹配 name+cid+actress_link）
  const mergedVideos = uniqBy(
    [...videosByName, ...videosByCid, ...videosByActressLink],
    (v) => `${v.video_id}`
  )

  return {
    query: q,
    videos: mergedVideos,
    actresses,
    meta: {
      took_ms: Math.round(performance.now() - t0),
      counts: {
        video_name: videosByName.length,
        content_id: videosByCid.length,
        actress: actresses.length,
        actress_link_videos: videosByActressLink.length,
        merged_videos: mergedVideos.length,
      },
    },
  }
}

export function mountSearchPage({ containerId = 'app' } = {}) {
  ensureStyles()
  const host = document.getElementById(containerId)
  if (!host) throw new Error(`Missing #${containerId}`)

  host.innerHTML = ''
  const wrap = el('div', { class: 'af-search-wrap' })
  const bar = el('div', { class: 'af-search-bar' })

  const input = el('input', {
    class: 'af-search-input',
    type: 'text',
    placeholder: '输入影片名 / 番号 / 女优名…',
    autocomplete: 'off',
  })

  const btn = el('button', { class: 'af-btn', type: 'button', html: '检索' })
  const hint = el('div', { class: 'af-search-hint' }, [
    document.createTextNode('当前：同时检索 影片名、番号、女优名（并找出该女优出演的影片）。'),
  ])

  const resultMount = el('div', { id: 'af-search-results-mount' })

  bar.appendChild(input)
  bar.appendChild(btn)

  wrap.appendChild(bar)
  wrap.appendChild(hint)
  wrap.appendChild(resultMount)
  host.appendChild(wrap)

  async function run() {
    const q = norm(input.value)
    btn.disabled = true
    try {
      const res = await searchCore(q)
      renderSearchResults(resultMount, res)
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

  // 初始空渲染
  renderSearchResults(resultMount, { query: '', videos: [], actresses: [], meta: { empty: true } })
}
