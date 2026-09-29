import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const root = join(process.cwd(), 'prototypes', 'figma-pages')
const sharedPath = join(root, 'shared.css')
const sharedCss = existsSync(sharedPath) ? readFileSync(sharedPath, 'utf8') : ''

function dataUrl(relativeAssetPath) {
  const absolutePath = join(root, relativeAssetPath.replaceAll('/', '\\'))
  const extension = extname(absolutePath).toLowerCase()
  const mime = extension === '.png' ? 'image/png' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'
  return `data:${mime};base64,${readFileSync(absolutePath).toString('base64')}`
}

for (const filename of readdirSync(root).filter((name) => /^\d{2}-.+\.html$/.test(name))) {
  const path = join(root, filename)
  let html = readFileSync(path, 'utf8')
  if (html.includes('<link rel="stylesheet" href="shared.css">')) {
    html = html.replace('<link rel="stylesheet" href="shared.css">', `<style>${sharedCss}</style>`)
  }
  html = html.replace(/\.\.\/\.\.\/src\/assets\/(clsu-logo\.png|clsu-seal-watermark\.png|cobra-assistant\.png)/g, (match) => dataUrl(match))
  if (/^(04|05|06|07|08|09|10)-/.test(filename) && !html.includes('prototype-sigmai')) {
    const cobra = dataUrl('../../src/assets/cobra-assistant.png')
    html = html.replace('</head>', `<style>.prototype-sigmai{position:fixed;right:24px;bottom:24px;z-index:80;width:70px;height:70px;border:3px solid #fff;border-radius:50%;padding:0;background:#0b6b2e;box-shadow:0 10px 28px #123a1d55;cursor:pointer;overflow:visible}.prototype-sigmai img{width:100%;height:100%;border-radius:50%;object-fit:cover}.prototype-sigmai-label{position:absolute;right:58px;top:50%;transform:translateY(-50%);padding:7px 11px;border-radius:10px;background:#fff;color:#0b2e13;font:700 12px Inter,Arial,sans-serif;box-shadow:0 5px 16px #0002;white-space:nowrap}.prototype-sigmai-sparkle{position:absolute;right:-2px;top:-6px;color:#57c93a;font-size:18px}</style></head>`)
    html = html.replace('</body>', `<button class="prototype-sigmai" type="button" aria-label="Open SIGMAI virtual assistant"><span class="prototype-sigmai-label">Ask SIGMAI</span><img src="${cobra}" alt="SIGMAI Cobra mascot"><span class="prototype-sigmai-sparkle" aria-hidden="true">✦</span></button></body>`)
  }
  writeFileSync(path, html)
}

for (const removable of ['shared.css', 'index.html']) {
  const path = join(root, removable)
  if (existsSync(path)) unlinkSync(path)
}

console.log('Inlined CSS and image assets into every standalone prototype page.')
