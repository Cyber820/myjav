import { supabase } from './supabaseClient'
import { el, mount, cssBase } from './ui'

/**
 * 这个 starter 只实现：
 * - Supabase 邮箱 Magic Link 登录
 * - 登录后跳转 editor.html
 * - editor.html 显示“已登录”状态 + 退出按钮
 *
 * 后续你要做“日本小电影数据库”的表结构、表单、列表、筛选等，
 * 都可以从 editor.js 开始继续扩展。
 */

const AUTH_CALLBACK_PATH = '/auth-callback.html'
const POST_LOGIN_PATH = '/editor.html'

cssBase()

const $app = document.getElementById('app')

function origin() {
  // 支持 GitHub Pages / Railway 等不同 base
  return window.location.origin
}

function absUrl(path) {
  return `${origin()}${path}`
}

async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data?.user ?? null
}

function LoginUI({ statusText = '' } = {}) {
  const $email = el('input', {
    class: 'grow',
    type: 'email',
    placeholder: '邮箱（用于接收登录链接）',
    autocomplete: 'email',
  })

  const $status = el('div', { class: 'muted' }, [statusText])

  const $send = el('button', {
    class: 'primary',
    onclick: async () => {
      const email = ($email.value || '').trim()
      if (!email) {
        $status.textContent = '请输入邮箱。'
        return
      }
      $send.disabled = true
      $status.textContent = '正在发送 Magic Link…'
      try {
        const redirectTo = absUrl(AUTH_CALLBACK_PATH)
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        })
        if (error) throw error
        $status.textContent = '已发送！请去邮箱点击链接完成登录。'
      } catch (e) {
        $status.textContent = `发送失败：${e?.message ?? String(e)}`
      } finally {
        $send.disabled = false
      }
    },
  }, ['发送登录链接'])

  const $hint = el('div', { class: 'muted' }, [
    '说明：这是自用项目，建议在 Supabase 控制台的 Authentication 中开启 Email（Magic Link）。',
  ])

  return el('div', { class: 'wrap' }, [
    el('h1', {}, ['JP Movie DB']),
    el('div', { class: 'card' }, [
      el('div', { class: 'row' }, [$email, $send]),
      el('div', { class: 'sp' }),
      $status,
      el('div', { class: 'sp' }),
      $hint,
    ]),
  ])
}

function AuthedUI(user) {
  const $go = el('a', { href: POST_LOGIN_PATH }, ['进入编辑页（editor.html）'])
  const $signout = el('button', {
    onclick: async () => {
      await supabase.auth.signOut()
      render()
    },
  }, ['退出登录'])

  return el('div', { class: 'wrap' }, [
    el('h1', {}, ['JP Movie DB']),
    el('div', { class: 'card' }, [
      el('div', {}, ['已登录：', el('span', { class: 'mono' }, [user.email ?? user.id])]),
      el('div', { class: 'sp' }),
      el('div', { class: 'row' }, [$go, $signout]),
    ]),
  ])
}

async function render() {
  const user = await getUser()
  if (!user) mount($app, LoginUI())
  else mount($app, AuthedUI(user))
}

// 监听登录态变化（比如在另一个 tab 退出/登录）
supabase.auth.onAuthStateChange(() => render())

render()
