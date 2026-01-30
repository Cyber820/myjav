// src/meta-create.js
import { supabase } from './supabaseClient.js'
import { createSubmitStatus } from './ui/submit-status.js'

const META_TYPES = [
  { key: '女优类型', table: 'actress_type', col: 'actress_type_name' },
  { key: '厂商', table: 'publisher', col: 'publisher_name' },
  { key: '场景', table: 'scene', col: 'scene_name' },
  { key: '制服', table: 'costume', col: 'costume_name' },
  { key: '标签', table: 'tag', col: 'tag_name' },
]

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
  if (document.getElementById('af-meta-modal-style')) return
  const style = el('style', { id: 'af-meta-modal-style', html: `
    .af-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}
    .af-modal{width:min(680px,100%);max-height:85vh;overflow:auto;background:#fff;border:1px solid rgba(0,0,0,.20);border-radius:12px;padding:14px;box-sizing:border-box;}
    .af-modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}
    .af-modal-title{font-size:16px;font-weight:700;}
    .af-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;}
    .af-btn-primary{border-color:rgba(0,0,0,.4);font-weight:700;}
    .af-grid{display:grid;grid-template-columns:160px 1fr;gap:10px 12px;align-items:center;}
    .af-label{font-size:13px;color:rgba(0,0,0,.75);}
    .af-input, .af-select{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:8px 10px;font-size:14px;}
    .af-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:14px;}
  `})
  document.head.appendChild(style)
}

function normText(s) {
  return (s ?? '').trim()
}

function getTypeByKey(key) {
  return META_TYPES.find(t => t.key === key) || null
}

export function openMetaCreateModal() {
  ensureStyles()

  const overlay = el('div', { class: 'af-modal-overlay' })
  const modal = el('div', { class: 'af-modal', role: 'dialog', 'aria-modal': 'true' })
  overlay.appendChild(modal)

  const title = el('div', { class: 'af-modal-title', html: '录入其他信息' })
  const btnClose = el('button', { class: 'af-btn', type: 'button', html: '关闭' })
  const header = el('div', { class: 'af-modal-header' }, [title, btnClose])

  const form = el('form')

  const selectType = el('select', { class: 'af-select', name: 'meta_type' }, [
    ...META_TYPES.map((t, i) =>
      el('option', { value: t.key, selected: i === 0 ? 'true' : null }, [document.createTextNode(t.key)])
    ),
  ])

  const inputName = el('input', {
    class: 'af-input',
    name: 'meta_name',
    type: 'text',
    placeholder: '请输入名称（必填）',
    required: 'true',
  })

  const grid = el('div', { class: 'af-grid' }, [
    el('div', { class: 'af-label' }, [document.createTextNode('选择信息类型')]),
    selectType,
    el('div', { class: 'af-label' }, [document.createTextNode('名称')]),
    inputName,
  ])

  // 通用提交状态：成功后点确定 → 回到录入页面（清空输入，可继续录下一条）
  const status = createSubmitStatus({
    onConfirm: () => {
      status.hide()
      btnSubmit.style.display = ''
      btnCancel.style.display = ''
      unlockForm()
      inputName.value = ''
      inputName.focus()
    },
  })

  const btnCancel = el('button', { class: 'af-btn', type: 'button', html: '取消' })
  const btnSubmit = el('button', { class: 'af-btn af-btn-primary', type: 'submit', html: '确认' })
  const footer = el('div', { class: 'af-footer' }, [btnCancel, btnSubmit])

  form.appendChild(grid)
  form.appendChild(status.element)
  form.appendChild(footer)

  modal.appendChild(header)
  modal.appendChild(form)
  document.body.appendChild(overlay)

  function close() {
    overlay.remove()
    document.removeEventListener('keydown', onEsc)
  }
  function onEsc(e) {
    if (e.key === 'Escape') close()
  }

  function lockForm() {
    btnClose.disabled = true
    btnCancel.disabled = true
    btnSubmit.disabled = true
    selectType.disabled = true
    inputName.disabled = true
  }
  function unlockForm() {
    btnClose.disabled = false
    btnCancel.disabled = false
    btnSubmit.disabled = false
    selectType.disabled = false
    inputName.disabled = false
  }

  btnClose.addEventListener('click', close)
  btnCancel.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  document.addEventListener('keydown', onEsc)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    status.hide()

    const typeKey = selectType.value
    const name = normText(inputName.value)
    const type = getTypeByKey(typeKey)

    if (!type) {
      status.showError('未知的信息类型。')
      return
    }
    if (!name) {
      status.showError('名称必填。')
      return
    }

    status.showSubmitting('正在录入…')
    lockForm()

    const payload = { [type.col]: name }
    const { error } = await supabase.from(type.table).insert(payload)

    if (error) {
      unlockForm()
      status.showError(`录入失败：${error.message}`)
      return
    }

    // 成功：隐藏底部按钮，显示成功+确定；点确定回到录入页面
    btnSubmit.style.display = 'none'
    btnCancel.style.display = 'none'
    status.showSuccess('录入成功')
  })

  inputName.focus()
}
