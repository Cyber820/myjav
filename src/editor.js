import { supabase } from './supabaseClient'
import { el, mount, cssBase } from './ui'

cssBase()

const $app = document.getElementById('app')

async function requireUser() {
  const { data } = await supabase.auth.getUser()
  return data?.user ?? null
}

function EditorUI(user) {
  const $signout = el('button', {
    onclick: async () => {
      await supabase.auth.signOut()
      window.location.replace('/')
    },
  }, ['退出登录'])

  return el('div', { class: 'wrap' }, [
    el('div', { class: 'row' }, [
      el('h1', { style: 'margin: 0;' }, ['Editor']),
      el('div', { class: 'grow' }),
      $signout,
    ]),
    el('div', { class: 'sp' }),
    el('div', { class: 'card' }, [
      el('div', {}, ['当前用户：', el('span', { class: 'mono' }, [user.email ?? user.id])]),
      el('div', { class: 'sp' }),
      el('div', { class: 'muted' }, [
        '这里是编辑入口。下一步你可以在此页加入：',
      ]),
      el('ul', {}, [
        el('li', {}, ['影片条目表单（标题/女优/番号/标签/评分/观看日期/存储路径…）']),
        el('li', {}, ['列表 + 搜索/筛选（标签、多字段模糊搜索）']),
        el('li', {}, ['图片/封面链接（Supabase Storage 或其他 S3）']),
      ]),
    ]),
  ])
}

async function render() {
  const user = await requireUser()
  if (!user) {
    mount($app, el('div', { class: 'wrap' }, [
      el('h1', {}, ['Editor']),
      el('div', { class: 'card' }, [
        el('div', { class: 'bad' }, ['未登录。']),
        el('div', { class: 'sp' }),
        el('a', { href: '/' }, ['返回登录页']),
      ]),
    ]))
    return
  }
  mount($app, EditorUI(user))
}

supabase.auth.onAuthStateChange(() => render())
render()
