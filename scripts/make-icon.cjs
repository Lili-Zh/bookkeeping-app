// 生成桌面图标 build/icon.png：绿色圆角底 + 🐴（512×512）
// 用法：npm run icon（内部用 Electron 离屏窗口画图导出 PNG）
const { app, BrowserWindow } = require('electron')
const { promises: fs } = require('fs')
const { join } = require('path')

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      show: false,
      width: 512,
      height: 512,
      webPreferences: { offscreen: true }
    })
    await win.loadURL(
      'data:text/html,<html><body style="margin:0"><canvas id="c" width="512" height="512"></canvas></body></html>'
    )
    const dataUrl = await win.webContents.executeJavaScript(`(() => {
      const c = document.getElementById('c')
      const ctx = c.getContext('2d')
      const w = 512, r = 112
      // 绿色圆角方块（品牌主色）
      ctx.beginPath()
      ctx.moveTo(r, 0)
      ctx.lineTo(w - r, 0)
      ctx.arcTo(w, 0, w, r, r)
      ctx.lineTo(w, w - r)
      ctx.arcTo(w, w, w - r, w, r)
      ctx.lineTo(r, w)
      ctx.arcTo(0, w, 0, w - r, r)
      ctx.lineTo(0, r)
      ctx.arcTo(0, 0, r, 0, r)
      ctx.closePath()
      ctx.fillStyle = '#07c160'
      ctx.fill()
      // 中间放 🐴（彩色 emoji 字形）
      ctx.font = '300px "Segoe UI Emoji"'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.fillText('🐴', 256, 268)
      return c.toDataURL('image/png')
    })()`)
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
    await fs.mkdir(join(__dirname, '..', 'build'), { recursive: true })
    await fs.writeFile(join(__dirname, '..', 'build', 'icon.png'), buf)
    console.log('图标已生成: build/icon.png（' + buf.length + ' 字节）')
    app.quit()
  } catch (err) {
    console.error('生成图标失败:', err)
    process.exit(1)
  }
})
