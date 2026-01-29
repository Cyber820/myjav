// src/auth-callback.js
import { supabase } from './supabaseClient.js'

const POST_LOGIN_PATH = '/editor.html'
const FAIL_FALLBACK_PATH = '/index.html'

function setMsg(text) {
  const el = document.getElementById('msg')
  if (el) el.textContent = text
}

async function main() {
  try {
    setMsg('Exchanging session…')

    // ✅ supabase-js v2: 用这个把 URL 里的 code/token 交换成 session，并写入本地存储
    const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href)

    if (error) {
      setMsg(`Auth failed: ${error.message}`)
      return
    }

    // 再保险：确认 session 真的存在
    const { data: s2, error: e2 } = await supabase.auth.getSession()
    if (e2 || !s2?.session) {
      setMsg(`Auth failed: session not found after exchange`)
      return
    }

    setMsg('Login OK. Redirecting…')
    window.location.replace(POST_LOGIN_PATH)
  } catch (err) {
    setMsg(`Auth failed: ${err?.message ?? String(err)}`)
    // 你也可以选择自动回退
    // window.location.replace(FAIL_FALLBACK_PATH)
  }
}

main()
