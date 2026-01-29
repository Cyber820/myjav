// src/auth-callback.js
import { supabase } from './supabaseClient.js'

const POST_LOGIN_PATH = '/editor.html'

function setMsg(text) {
  const el = document.getElementById('msg')
  if (el) el.textContent = text
}

async function main() {
  try {
    setMsg('Handling callback…')

    // implicit flow：supabase 会从 URL hash 自动解析并落地 session
    // 这里等一拍再取 session，兼容部分浏览器时序
    await new Promise(r => setTimeout(r, 50))

    const { data, error } = await supabase.auth.getSession()
    if (error) {
      setMsg(`Auth failed: ${error.message}`)
      return
    }
    if (!data?.session) {
      setMsg('Auth failed: session not found. (Did you open the link in a different browser?)')
      return
    }

    setMsg('Login OK. Redirecting…')
    window.location.replace(POST_LOGIN_PATH)
  } catch (err) {
    setMsg(`Auth failed: ${err?.message ?? String(err)}`)
  }
}

main()
