import { supabase } from './supabaseClient'
import { cssBase } from './ui'

cssBase()

const $app = document.getElementById('app')

function setText(t) {
  $app.textContent = t
}

function hasParam(name) {
  const u = new URL(window.location.href)
  return u.searchParams.has(name)
}

async function handle() {
  try {
    setText('Signing in…')

    // 兼容两种回调：
    // 1) PKCE: ?code=xxxx
    // 2) Implicit: #access_token=...&refresh_token=...
    const url = window.location.href

    if (hasParam('code')) {
      const { error } = await supabase.auth.exchangeCodeForSession(url)
      if (error) throw error
    } else if (window.location.hash && window.location.hash.includes('access_token=')) {
      const { error } = await supabase.auth.getSessionFromUrl({ storeSession: true })
      if (error) throw error
    }

    // 确认 session 已就绪
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error

    if (!data?.session) {
      setText('No session found. Please go back and try again.')
      return
    }

    setText('Signed in. Redirecting…')
    window.location.replace('/editor.html')
  } catch (e) {
    setText(`Auth failed: ${e?.message ?? String(e)}`)
  }
}

handle()
