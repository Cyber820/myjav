export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else if (k === 'style') node.setAttribute('style', v)
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v)
    else node.setAttribute(k, v)
  }
  for (const child of children) {
    if (child == null) continue
    if (typeof child === 'string') node.appendChild(document.createTextNode(child))
    else node.appendChild(child)
  }
  return node
}

export function mount($root, ...nodes) {
  $root.innerHTML = ''
  for (const n of nodes) $root.appendChild(n)
}

export function cssBase() {
  const style = document.createElement('style')
  style.textContent = `
    :root { color-scheme: light dark; }
    body { margin: 0; font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji"; }
    a { color: inherit; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 24px; }
    .card { border: 1px solid rgba(127,127,127,0.35); border-radius: 12px; padding: 16px; background: rgba(255,255,255,0.02); }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .row > * { flex: 0 0 auto; }
    .grow { flex: 1 1 auto; min-width: 240px; }
    input, button { font-size: 14px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(127,127,127,0.35); background: transparent; }
    button { cursor: pointer; }
    button.primary { border-color: rgba(0, 170, 255, 0.55); }
    .muted { opacity: 0.75; }
    .ok { color: #34d399; }
    .bad { color: #fb7185; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .sp { height: 12px; }
  `
  document.head.appendChild(style)
}
