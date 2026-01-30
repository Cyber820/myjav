// src/search-results.js

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
  if (document.getElementById('af-search-results-style')) return
  const style = el('style', {
    id: 'af-search-results-style',
    html: `
      .af-sr{margin-top:12px;border:1px solid rgba(0,0,0,.12);border-radius:12px;padding:12px;}
      .af-sr-head{display:flex;gap:10px;align-items:baseline;justify-content:space-between;flex-wrap:wrap;}
      .af-sr-title{font-weight:700;}
      .af-sr-meta{font-size:12px;color:rgba(0,0,0,.6);}
      .af-sr-section{margin-top:12px;}
      .af-sr-section-title{font-weight:700;margin-bottom:6px;font-size:13px;color:rgba(0,0,0,.75);}
      .af-sr-list{margin:0;padding-left:18px;}
      .af-sr-empty{color:rgba(0,0,0,.6);font-size:12px;}
      .af-sr-err{color:#7a0000;background:rgba(200,0,0,.06);border:1px solid rgba(200,0,0,.25);border-radius:10px;padding:10px;white-space:pre-wrap;}
      .af-tag{display:inline-block;font-size:11px;border:1px solid rgba(0,0,0,.20);border-radius:999px;padding:2px 8px;margin-left:8px;color:rgba(0,0,0,.65);}
    `,
  })
  document.head.appendChild(style)
}

function byLabel(matched_by) {
  if (matched_by === 'video_name') return '影片名'
  if (matched_by === 'content_id') return '番号'
  if (matched_by === 'actress_link') return '女优关联'
  return '匹配'
}

/**
 * @param {HTMLElement} mount
 * @param {Object} result
 */
export function renderSearchResults(mount, result) {
  ensureStyles()
  mount.innerHTML = ''

  const wrap = el('div', { class: 'af-sr' })

  const head = el('div', { class: 'af-sr-head' }, [
    el('div', { class: 'af-sr-title' }, [document.createTextNode('检索结果')]),
    el('div', { class: 'af-sr-meta' }, [
      document.createTextNode(
        result?.meta?.took_ms != null ? `耗时 ${result.meta.took_ms} ms` : ''
      ),
    ]),
  ])

  wrap.appendChild(head)

  if (result?.error) {
    wrap.appendChild(el('div', { class: 'af-sr-err', html: `检索失败：${result.error}` }))
    mount.appendChild(wrap)
    return
  }

  if (!result?.query) {
    wrap.appendChild(el('div', { class: 'af-sr-empty' }, [document.createTextNode('请输入关键字后检索。')]))
    mount.appendChild(wrap)
    return
  }

  const counts = result?.meta?.counts
  if (counts) {
    wrap.appendChild(el('div', { class: 'af-sr-meta', html:
      `影片名匹配 ${counts.video_name}；番号匹配 ${counts.content_id}；女优匹配 ${counts.actress}；女优关联影片 ${counts.actress_link_videos}；合并后影片 ${counts.merged_videos}`
    }))
  }

  // Actresses
  const secA = el('div', { class: 'af-sr-section' }, [
    el('div', { class: 'af-sr-section-title' }, [document.createTextNode(`女优（${(result.actresses || []).length}）`)]),
  ])

  if ((result.actresses || []).length === 0) {
    secA.appendChild(el('div', { class: 'af-sr-empty' }, [document.createTextNode('无匹配女优。')]))
  } else {
    const ul = el('ul', { class: 'af-sr-list' })
    for (const a of result.actresses) {
      ul.appendChild(el('li', {}, [document.createTextNode(a.actress_name)]))
    }
    secA.appendChild(ul)
  }
  wrap.appendChild(secA)

  // Videos
  const secV = el('div', { class: 'af-sr-section' }, [
    el('div', { class: 'af-sr-section-title' }, [document.createTextNode(`影片（${(result.videos || []).length}）`)]),
  ])

  if ((result.videos || []).length === 0) {
    secV.appendChild(el('div', { class: 'af-sr-empty' }, [document.createTextNode('无匹配影片。')]))
  } else {
    const ul = el('ul', { class: 'af-sr-list' })
    for (const v of result.videos) {
      const li = el('li', {}, [
        document.createTextNode(v.video_name),
        el('span', { class: 'af-tag' }, [document.createTextNode(byLabel(v.matched_by))]),
      ])
      ul.appendChild(li)
    }
    secV.appendChild(ul)
  }
  wrap.appendChild(secV)

  mount.appendChild(wrap)
}
