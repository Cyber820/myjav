// src/actress-create.js
import { supabase } from './supabaseClient.js'
import { createSubmitStatus } from './ui/submit-status.js'

const CUP_OPTIONS = ['A','B','C','D','E','F','G','H','I','J','K']

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
  if (document.getElementById('af-actress-modal-style')) return
  const style = el('style', { id: 'af-actress-modal-style', html: `
    .af-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}
    .af-modal{width:min(900px,100%);max-height:85vh;overflow:auto;background:#fff;border:1px solid rgba(0,0,0,.20);border-radius:12px;padding:12px;box-sizing:border-box;}
    .af-modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}
    .af-modal-title{font-size:16px;font-weight:700;}
    .af-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;}
    .af-btn-primary{border-color:rgba(0,0,0,.4);font-weight:700;}
    .af-grid{display:grid;grid-template-columns:160px 1fr;gap:10px 12px;align-items:center;}
    .af-label{font-size:13px;color:rgba(0,0,0,.75);}
    .af-input, .af-textarea, .af-select{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:8px 10px;font-size:14px;}
    .af-textarea{min-height:88px;resize:vertical;}
    .af-hint{font-size:12px;color:rgba(0,0,0,.6);margin-top:6px;}
    .af-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:14px;}
  `})
  document.head.appendChild(style)
}

function validate(form) {
  const errors = []

  const actress_name = form.actress_name.value.trim()
  if (!actress_name) errors.push('名称（actress_name）必填。')

  const date_of_birth = form.date_of_birth.value.trim()
  if (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
    errors.push('生日格式不正确，应为 YYYY-MM-DD。')
  }

  const heightRaw = form.height.value.trim()
  let height = null
  if (heightRaw !== '') {
    height = Number(heightRaw)
    if (!Number.isFinite(height) || !Number.isInteger(height)) errors.push('身高必须是整数。')
    else if (height < 130 || height > 200) errors.push('身高范围应为 130-200。')
  }

  const cup = form.cup.value.trim()
  if (cup && !CUP_OPTIONS.includes(cup)) errors.push('罩杯范围应为 A-K。')

  const rateRaw = form.personal_rate.value.trim()
  let personal_rate = null
  if (rateRaw !== '') {
    personal_rate = Number(rateRaw)
    if (!Number.isFinite(personal_rate)) errors.push('个人评分必须是数字。')
    else if (personal_rate < 0 || personal_rate > 100) errors.push('个人评分范围应为 0-100。')
  }

  const personal_comment = form.personal_comment.value

  return {
    ok: errors.length === 0,
    errors,
    payload: {
      actress_name,
      date_of_birth: date_of_birth || null,
      height,
      cup: cup || null,
      personal_rate,
      personal_comment: personal_comment?.trim() || null,
    },
  }
}

export function openActressCreateModal({ onCreated } = {}) {
  ensureStyles()

  const overlay = el('div', { class: 'af-modal-overlay' })
  const modal = el('div', { class: 'af-modal', role: 'dialog', 'aria-modal': 'true' })
  overlay.appendChild(modal)

  const title = el('div', { class: 'af-modal-title', html: '录入女优' })
  const btnClose = el('button', { class: 'af-btn', type: 'button', html: '关闭' })
  const header = el('div', { class: 'af-modal-header' }, [title, btnClose])

  const form = el('form')

  const cupSelect = el('select', { class: 'af-select', name: 'cup' }, [
    el('option', { value: '' }, [document.createTextNode('（可选）')]),
    ...CUP_OPTIONS.map(c => el('option', { value: c }, [document.createTextNode(c)])),
  ])

  const grid = el('div', { class: 'af-grid' }, [
    el('div', { class: 'af-label' }, [document.createTextNode('名称（必填）')]),
    el('input', { class: 'af-input', name: 'actress_name', type: 'text', required: 'true', placeholder: '请输入名称' }),

    el('div', { class: 'af-label' }, [document.createTextNode('生日')]),
    el('div', {}, [
      el('input', { class: 'af-input', name: 'date_of_birth', type: 'date' }),
      el('div', { class: 'af-hint' }, [document.createTextNode('将以 YYYY-MM-DD 写入数据库')]),
    ]),

    el('div', { class: 'af-label' }, [document.createTextNode('身高（130-200）')]),
    el('input', { class: 'af-input', name: 'height', type: 'number', min: '130', max: '200', step: '1', placeholder: '例如 162' }),

    el('div', { class: 'af-label' }, [document.createTextNode('罩杯（A-K）')]),
    cupSelect,

    el('div', { class: 'af-label' }, [document.createTextNode('个人评分（0-100）')]),
    el('input', { class: 'af-input', name: 'personal_rate', type: 'number', min: '0', max: '100', step: '1', placeholder: '例如 85' }),

    el('div', { class: 'af-label' }, [document.createTextNode('个人评价')]),
    el('textarea', { class: 'af-textarea', name: 'personal_comment', placeholder: '可选' }),
  ])

  const btnCancel = el('button', { class: 'af-btn', type: 'button', html: '取消' })
  const btnSubmit = el('button', { class: 'af-btn af-btn-primary', type: 'submit', html: '确认' })
  const footer = el('div', { class: 'af-footer' }, [btnCancel, btnSubmit])

  // 通用提交状态：成功后点确定 → 回到录入页面（清空输入可继续录）
  const status = createSubmitStatus({
    onConfirm: () => {
      status.hide()
      btnSubmit.style.display = ''
      btnCancel.style.display = ''
      unlockForm()
      form.reset()
      // reset 会把 date/cup 等重置；重新聚焦到名称
      form.actress_name.focus()
    },
  })

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
    form.actress_name.disabled = true
    form.date_of_birth.disabled = true
    form.height.disabled = true
    form.cup.disabled = true
    form.personal_rate.disabled = true
    form.personal_comment.disabled = true
  }
  function unlockForm() {
    btnClose.disabled = false
    btnCancel.disabled = false
    btnSubmit.disabled = false
    form.actress_name.disabled = false
    form.date_of_birth.disabled = false
    form.height.disabled = false
    form.cup.disabled = false
    form.personal_rate.disabled = false
    form.personal_comment.disabled = false
  }

  btnClose.addEventListener('click', close)
  btnCancel.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  document.addEventListener('keydown', onEsc)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    status.hide()

    const { ok, errors, payload } = validate(form)
    if (!ok) {
      status.showError(errors.join('\n'))
      return
    }

    status.showSubmitting('正在录入…')
    lockForm()

    const { data, error } = await supabase
      .from('actress')
      .insert(payload)
      .select()
      .single()

    if (error) {
      unlockForm()
      status.showError(`写入失败：${error.message}`)
      return
    }

    if (typeof onCreated === 'function') onCreated(data)

    // 成功：隐藏底部按钮，显示成功+确定；点确定回到录入页面
    btnSubmit.style.display = 'none'
    btnCancel.style.display = 'none'
    status.showSuccess('录入成功')
  })

  form.actress_name.focus()
}
