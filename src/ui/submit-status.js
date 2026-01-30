// src/ui/submit-status.js
/**
 * 通用“提交状态”组件
 * - showSubmitting(): 显示“正在录入…”，并可配合外部 lockForm()
 * - showSuccess(): 显示“录入成功”，并展示“确定”按钮；点击确定触发 onConfirm（通常用于回到录入页面）
 * - showError(): 显示错误信息（不强制展示确定按钮）
 * - hide(): 隐藏状态区
 *
 * 约定：组件只负责状态显示与“确定”按钮交互，不直接锁表单。
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
  if (document.getElementById('af-submit-status-style')) return
  const style = el('style', {
    id: 'af-submit-status-style',
    html: `
      .af-status-wrap{margin-top:12px;display:none;}
      .af-status{border-radius:10px;padding:10px;font-size:13px;white-space:pre-wrap;}
      .af-status.info{border:1px solid rgba(0,0,0,.20);background:rgba(0,0,0,.03);color:rgba(0,0,0,.75);}
      .af-status.ok{border:1px solid rgba(0,140,0,.25);background:rgba(0,140,0,.06);color:#075c07;}
      .af-status.err{border:1px solid rgba(200,0,0,.25);background:rgba(200,0,0,.06);color:#7a0000;}
      .af-status-actions{margin-top:10px;display:flex;justify-content:flex-end;}
      .af-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;}
    `,
  })
  document.head.appendChild(style)
}

/**
 * @param {Object} opts
 * @param {() => void} [opts.onConfirm] 成功后点击“确定”的回调（一般用于回到录入页面）
 */
export function createSubmitStatus(opts = {}) {
  ensureStyles()
  const { onConfirm } = opts

  const wrap = el('div', { class: 'af-status-wrap' })
  const box = el('div', { class: 'af-status info' })
  const actions = el('div', { class: 'af-status-actions' })
  const btnOk = el('button', { class: 'af-btn', type: 'button', html: '确定', style: 'display:none;' })

  btnOk.addEventListener('click', () => {
    if (typeof onConfirm === 'function') onConfirm()
  })

  actions.appendChild(btnOk)
  wrap.appendChild(box)
  wrap.appendChild(actions)

  function show(kind, text, { showConfirm = false } = {}) {
    wrap.style.display = 'block'
    box.className = `af-status ${kind}`
    box.textContent = text ?? ''
    btnOk.style.display = showConfirm ? '' : 'none'
    if (showConfirm) btnOk.focus()
  }

  return {
    element: wrap,
    hide() {
      wrap.style.display = 'none'
      box.textContent = ''
      btnOk.style.display = 'none'
    },
    showSubmitting(text = '正在录入…') {
      show('info', text, { showConfirm: false })
    },
    showSuccess(text = '录入成功') {
      show('ok', text, { showConfirm: true })
    },
    showError(text = '录入失败') {
      show('err', text, { showConfirm: false })
    },
  }
}
