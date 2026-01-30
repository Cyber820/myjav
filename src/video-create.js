// src/video-create.js
import { supabase } from './supabaseClient.js'
import { createSubmitStatus } from './ui/submit-status.js'
import { createLookupSelect, LOOKUP_PRESETS } from './ui/lookup-select.js'

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
  if (document.getElementById('af-video-modal-style')) return
  const style = el('style', { id: 'af-video-modal-style', html: `
    .af-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}
    .af-modal{width:min(980px,100%);max-height:88vh;overflow:auto;background:#fff;border:1px solid rgba(0,0,0,.20);border-radius:12px;padding:12px;box-sizing:border-box;}
    .af-modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}
    .af-modal-title{font-size:16px;font-weight:700;}
    .af-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;}
    .af-btn-primary{border-color:rgba(0,0,0,.4);font-weight:700;}
    .af-section{margin-top:12px;border:1px solid rgba(0,0,0,.12);border-radius:12px;padding:10px;}
    .af-section-title{font-size:13px;font-weight:700;margin-bottom:10px;color:rgba(0,0,0,.75);}
    .af-grid{display:grid;grid-template-columns:180px 1fr;gap:10px 12px;align-items:center;}
    .af-label{font-size:13px;color:rgba(0,0,0,.75);}
    .af-input, .af-textarea, .af-select{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:8px 10px;font-size:14px;}
    .af-textarea{min-height:92px;resize:vertical;}
    .af-textarea.big{min-height:130px;}
    .af-hint{font-size:12px;color:rgba(0,0,0,.6);margin-top:6px;}
    .af-row{display:flex;gap:10px;flex-wrap:wrap;}
    .af-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:14px;}
  `})
  document.head.appendChild(style)
}

function norm(s) {
  return (s ?? '').toString().trim()
}

function toIntOrNull(v) {
  const t = norm(v)
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n)) return NaN
  return Math.trunc(n)
}

function validateRate(name, v, errors) {
  const n = toIntOrNull(v)
  if (Number.isNaN(n)) {
    errors.push(`${name} 必须是数字。`)
    return null
  }
  if (n === null) return null
  if (n < 0 || n > 100) errors.push(`${name} 范围应为 0-100。`)
  return n
}

function validate(form, { publisherSel, actressSel, actressTypeSel, costumeSel, sceneSel, tagSel }) {
  const errors = []

  const video_name = norm(form.video_name.value)
  if (!video_name) errors.push('影片名称（video_name）必填。')

  const content_id = norm(form.content_id.value) || null

  const publish_date = norm(form.publish_date.value) || null
  if (publish_date && !/^\d{4}-\d{2}-\d{2}$/.test(publish_date)) {
    errors.push('发售日期格式不正确，应为 YYYY-MM-DD。')
  }

  // publisher 单选
const publisherPicked = publisherSel.getSelected()[0] || null
const publisher_id = publisherPicked ? publisherPicked.id : null
if (!publisher_id) errors.push('厂商（publisher）必选。')


  // censored boolean：有/无
const censoredVal = norm(form.censored.value)
let censored = null
if (censoredVal === 'true') censored = true
else if (censoredVal === 'false') censored = false
else errors.push('有码（censored）必选：请选择“有码”或“无码”。')


  const length = toIntOrNull(form.length.value)
  if (Number.isNaN(length)) errors.push('长度（分钟）必须是数字。')
  if (length !== null && length < 0) errors.push('长度（分钟）不能为负数。')

  const video_personal_rate = validateRate('总体评分', form.video_personal_rate.value, errors)
  const overall_actress_personal_rate = validateRate('女优评分', form.overall_actress_personal_rate.value, errors)
  const personal_acting_rate = validateRate('演技评分', form.personal_acting_rate.value, errors)
  const personal_voice_rate = validateRate('声音评分', form.personal_voice_rate.value, errors)

  const storyline = norm(form.storyline.value) || null

  const hasSpecialVal = norm(form.has_special.value)
  let has_special = null
  if (hasSpecialVal === 'true') has_special = true
  else if (hasSpecialVal === 'false') has_special = false
  else has_special = null

  const special = has_special === true ? (norm(form.special.value) || null) : null
  const personal_comment = norm(form.personal_comment.value) || null

  // 多选关联 ids
  const actressIds = actressSel.getSelected().map(x => x.id)
  const actressTypeIds = actressTypeSel.getSelected().map(x => x.id)
  const costumeIds = costumeSel.getSelected().map(x => x.id)
  const sceneIds = sceneSel.getSelected().map(x => x.id)
  const tagIds = tagSel.getSelected().map(x => x.id)

  // 如果你希望“出演女优必选”，可打开
  // if (actressIds.length === 0) errors.push('出演女优至少选择 1 个。')

  return {
    ok: errors.length === 0,
    errors,
    payload: {
      video: {
        video_name,
        content_id,
        publish_date,
        publisher_id,
        censored,
        length,
        video_personal_rate,
        overall_actress_personal_rate,
        personal_acting_rate,
        personal_voice_rate,
        storyline,
        has_special,
        special,
        personal_comment,
      },
      links: {
        actressIds,
        actressTypeIds,
        costumeIds,
        sceneIds,
        tagIds,
      },
    },
  }
}

async function insertLinks({ video_id, links }) {
  const tasks = []

  if (links.actressIds?.length) {
    tasks.push(
      supabase.from('actress_in_video').insert(
        links.actressIds.map(actress_id => ({ video_id, actress_id }))
      )
    )
  }
  if (links.actressTypeIds?.length) {
    tasks.push(
      supabase.from('actress_type_in_video').insert(
        links.actressTypeIds.map(actress_type_id => ({ video_id, actress_type_id }))
      )
    )
  }
  if (links.costumeIds?.length) {
    tasks.push(
      supabase.from('costume_in_video').insert(
        links.costumeIds.map(costume_id => ({ video_id, costume_id }))
      )
    )
  }
  if (links.sceneIds?.length) {
    tasks.push(
      supabase.from('video_scene').insert(
        links.sceneIds.map(scene_id => ({ video_id, scene_id }))
      )
    )
  }
  if (links.tagIds?.length) {
    tasks.push(
      supabase.from('video_tag').insert(
        links.tagIds.map(tag_id => ({ video_id, tag_id }))
      )
    )
  }

  const results = await Promise.all(tasks)
  const err = results.find(r => r.error)?.error
  if (err) throw err
}

export function openVideoCreateModal({ onCreated } = {}) {
  ensureStyles()

  // === Lookup selectors (可搜索下拉) ===
  const publisherSel = createLookupSelect(LOOKUP_PRESETS.publisher)
  const actressSel = createLookupSelect(LOOKUP_PRESETS.actress)
  const actressTypeSel = createLookupSelect(LOOKUP_PRESETS.actress_type)
  const costumeSel = createLookupSelect(LOOKUP_PRESETS.costume)
  const sceneSel = createLookupSelect(LOOKUP_PRESETS.scene)
  const tagSel = createLookupSelect(LOOKUP_PRESETS.tag)

  const overlay = el('div', { class: 'af-modal-overlay' })
  const modal = el('div', { class: 'af-modal', role: 'dialog', 'aria-modal': 'true' })
  overlay.appendChild(modal)

  const title = el('div', { class: 'af-modal-title', html: '录入影片' })
  const btnClose = el('button', { class: 'af-btn', type: 'button', html: '关闭' })
  const header = el('div', { class: 'af-modal-header' }, [title, btnClose])

  const form = el('form')

  // === 基础字段 ===
  const censoredSel = el('select', { class: 'af-select', name: 'censored' }, [
    el('option', { value: '' }, [document.createTextNode('（可选）')]),
    el('option', { value: 'true' }, [document.createTextNode('有码（true）')]),
    el('option', { value: 'false' }, [document.createTextNode('无码（false）')]),
  ])

  const hasSpecialSel = el('select', { class: 'af-select', name: 'has_special' }, [
    el('option', { value: '' }, [document.createTextNode('（可选）')]),
    el('option', { value: 'true' }, [document.createTextNode('是（true）')]),
    el('option', { value: 'false' }, [document.createTextNode('无（false）')]),
  ])

  const specialArea = el('textarea', { class: 'af-textarea big', name: 'special', placeholder: '仅当“猎奇=是”时填写' })
  const specialWrap = el('div', { style: 'display:none;' }, [
    specialArea,
    el('div', { class: 'af-hint' }, [document.createTextNode('提示：选择“猎奇=是”后才会显示并写入 special。')]),
  ])

  function syncSpecialVisibility() {
    const v = norm(hasSpecialSel.value)
    const show = v === 'true'
    specialWrap.style.display = show ? '' : 'none'
    if (!show) specialArea.value = ''
  }

  hasSpecialSel.addEventListener('change', syncSpecialVisibility)

  const secBase = el('div', { class: 'af-section' }, [
    el('div', { class: 'af-section-title' }, [document.createTextNode('基础信息')]),
    el('div', { class: 'af-grid' }, [
      el('div', { class: 'af-label' }, [document.createTextNode('影片名称（必填）')]),
      el('input', { class: 'af-input', name: 'video_name', type: 'text', required: 'true', placeholder: '例如 …' }),

      el('div', { class: 'af-label' }, [document.createTextNode('番号（content_id）')]),
      el('input', { class: 'af-input', name: 'content_id', type: 'text', placeholder: '例如 ABCD-123（可选）' }),

      el('div', { class: 'af-label' }, [document.createTextNode('发售日期（publish_date）')]),
      el('div', {}, [
        el('input', { class: 'af-input', name: 'publish_date', type: 'date' }),
        el('div', { class: 'af-hint' }, [document.createTextNode('将以 YYYY-MM-DD 写入数据库')]),
      ]),

      el('div', { class: 'af-label' }, [document.createTextNode('有码（censored）')]),
      censoredSel,

      el('div', { class: 'af-label' }, [document.createTextNode('长度（分钟）')]),
      el('input', { class: 'af-input', name: 'length', type: 'number', min: '0', step: '1', placeholder: '例如 120（可选）' }),
    ]),
  ])

  const secPublisher = el('div', { class: 'af-section' }, [
    el('div', { class: 'af-section-title' }, [document.createTextNode('厂商')]),
    publisherSel.element,
  ])

  // === 关联（多选） ===
  const secLinks = el('div', { class: 'af-section' }, [
    el('div', { class: 'af-section-title' }, [document.createTextNode('关联信息（可搜索/多选）')]),
    el('div', { class: 'af-row' }, [
      actressSel.element,
      actressTypeSel.element,
      costumeSel.element,
      sceneSel.element,
      tagSel.element,
    ]),
  ])

  // === 评分与文本 ===
  const secRates = el('div', { class: 'af-section' }, [
    el('div', { class: 'af-section-title' }, [document.createTextNode('评分与文本')]),
    el('div', { class: 'af-grid' }, [
      el('div', { class: 'af-label' }, [document.createTextNode('总体评分（0-100）')]),
      el('input', { class: 'af-input', name: 'video_personal_rate', type: 'number', min: '0', max: '100', step: '1', placeholder: '可选' }),

      el('div', { class: 'af-label' }, [document.createTextNode('女优评分（0-100）')]),
      el('input', { class: 'af-input', name: 'overall_actress_personal_rate', type: 'number', min: '0', max: '100', step: '1', placeholder: '可选' }),

      el('div', { class: 'af-label' }, [document.createTextNode('演技评分（0-100）')]),
      el('input', { class: 'af-input', name: 'personal_acting_rate', type: 'number', min: '0', max: '100', step: '1', placeholder: '可选' }),

      el('div', { class: 'af-label' }, [document.createTextNode('声音评分（0-100）')]),
      el('input', { class: 'af-input', name: 'personal_voice_rate', type: 'number', min: '0', max: '100', step: '1', placeholder: '可选' }),

      el('div', { class: 'af-label' }, [document.createTextNode('情节（storyline）')]),
      el('textarea', { class: 'af-textarea big', name: 'storyline', placeholder: '可选' }),

      el('div', { class: 'af-label' }, [document.createTextNode('猎奇（has_special）')]),
      hasSpecialSel,

      el('div', { class: 'af-label' }, [document.createTextNode('猎奇内容（special）')]),
      specialWrap,

      el('div', { class: 'af-label' }, [document.createTextNode('个人点评（personal_comment）')]),
      el('textarea', { class: 'af-textarea big', name: 'personal_comment', placeholder: '可选' }),
    ]),
  ])

  // === 状态与 footer ===
  let btnCancel, btnSubmit
  const status = createSubmitStatus({
    onConfirm: () => {
      // 回到录入页面：清空所有输入 + 清空所有 selector
      status.hide()
      btnSubmit.style.display = ''
      btnCancel.style.display = ''
      unlockForm()

      form.reset()
      publisherSel.clear()
      actressSel.clear()
      actressTypeSel.clear()
      costumeSel.clear()
      sceneSel.clear()
      tagSel.clear()

      syncSpecialVisibility()
      form.video_name.focus()
    },
  })

  btnCancel = el('button', { class: 'af-btn', type: 'button', html: '取消' })
  btnSubmit = el('button', { class: 'af-btn af-btn-primary', type: 'submit', html: '确认' })
  const footer = el('div', { class: 'af-footer' }, [btnCancel, btnSubmit])

  form.appendChild(secBase)
  form.appendChild(secPublisher)
  form.appendChild(secLinks)
  form.appendChild(secRates)
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

    // disable all form fields
    Array.from(form.querySelectorAll('input,textarea,select,button')).forEach(x => {
      // 保留状态组件的“确定”按钮由组件控制；这里只锁 form 内的 inputs
      if (x === btnCancel || x === btnSubmit) return
      if (x === btnClose) return
      // lookup-select 内部的按钮/输入也会被锁住：避免提交时改动
      x.disabled = true
    })
  }

  function unlockForm() {
    btnClose.disabled = false
    btnCancel.disabled = false
    btnSubmit.disabled = false
    Array.from(form.querySelectorAll('input,textarea,select,button')).forEach(x => {
      if (x === btnCancel || x === btnSubmit) return
      if (x === btnClose) return
      x.disabled = false
    })
  }

  btnClose.addEventListener('click', close)
  btnCancel.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  document.addEventListener('keydown', onEsc)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    status.hide()

    const { ok, errors, payload } = validate(form, { publisherSel, actressSel, actressTypeSel, costumeSel, sceneSel, tagSel })
    if (!ok) {
      status.showError(errors.join('\n'))
      return
    }

    status.showSubmitting('正在录入…')
    lockForm()

    try {
      // 1) 插入 video 主表，取回 video_id
      const { data: videoRow, error: vErr } = await supabase
        .from('video')
        .insert(payload.video)
        .select()
        .single()

      if (vErr) throw vErr
      const video_id = videoRow.video_id

      // 2) 插入关联表
      await insertLinks({ video_id, links: payload.links })

      if (typeof onCreated === 'function') onCreated(videoRow)

      // 成功：隐藏底部按钮，显示成功+确定
      btnSubmit.style.display = 'none'
      btnCancel.style.display = 'none'
      status.showSuccess('录入成功')
    } catch (err) {
      unlockForm()
      status.showError(`写入失败：${err?.message ?? String(err)}`)
      return
    }
  })

  // 初始 UI
  syncSpecialVisibility()
  form.video_name.focus()
}
