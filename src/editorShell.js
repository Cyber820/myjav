// src/editorShell.js
import { supabase } from './supabaseClient.js'

export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    // 未登录：回登录页
    window.location.href = '/index.html'
    throw new Error('No session')
  }
  return session
}

export function renderTopBar({ session }) {
  const topbar = document.createElement('div')
  topbar.style.display = 'flex'
  topbar.style.alignItems = 'center'
  topbar.style.justifyContent = 'space-between'
  topbar.style.padding = '12px'
  topbar.style.borderBottom = '1px solid rgba(0,0,0,.15)'

  const left = document.createElement('div')
  left.textContent = 'Editor'
  left.style.fontWeight = '700'

  const right = document.createElement('div')
  right.style.display = 'flex'
  right.style.gap = '10px'
  right.style.alignItems = 'center'

  const email = document.createElement('span')
  email.style.fontSize = '12px'
  email.style.color = 'rgba(0,0,0,.6)'
  email.textContent = session.user?.email ?? ''

  const btnLogout = document.createElement('button')
  btnLogout.textContent = '退出'
  btnLogout.style.padding = '8px 12px'
  btnLogout.style.borderRadius = '10px'
  btnLogout.style.border = '1px solid rgba(0,0,0,.25)'
  btnLogout.style.background = '#fff'
  btnLogout.style.cursor = 'pointer'
  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = '/index.html'
  })

  right.appendChild(email)
  right.appendChild(btnLogout)

  topbar.appendChild(left)
  topbar.appendChild(right)

  return { topbar }
}
