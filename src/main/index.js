import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import { loadData, saveData, backupOnStartup, dataPath, backupDir } from './store'

// 固定 App 名称，数据文件位置为 AppData\Roaming\黑马记账（与 CLAUDE.md 第 7 章一致）
app.setName('黑马记账')

// 数据读写接口：界面层通过 window.api 调用，不直接接触文件系统
ipcMain.handle('store:load', () => loadData())
ipcMain.handle('store:save', (_event, data) => saveData(data))

// ============ 导出 Excel（v0.4） ============
ipcMain.handle('export:excel', async () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const defaultName = `黑马记账账单-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.xlsx`
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出账单 Excel',
    defaultPath: defaultName,
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  const data = await loadData()
  const rows = [...data.bills]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((b) => ({
      日期: b.date,
      类型: b.type === 'expense' ? '支出' : '收入',
      一级分类: b.category1,
      二级分类: b.category2,
      '金额（元）': b.amount / 100,
      备注: b.note || ''
    }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 32 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '账单明细')
  // 注意：不直接用 XLSX.writeFile —— 打包后 xlsx 内部的 fs 检测会被优化掉导致写不了文件；
  // 改为自己生成二进制数据 + 显式写文件
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  await fs.writeFile(filePath, buf)
  return { ok: true, path: filePath }
})

// ============ 手动备份 / 恢复（v0.4） ============
const BACKUP_NAME = /^(data|manual)-\d{8}-\d{6}\.json$/

ipcMain.handle('backup:create', async () => {
  await fs.access(dataPath()) // 还没有数据文件时直接报错
  await fs.mkdir(backupDir(), { recursive: true })
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const target = join(backupDir(), `manual-${stamp}.json`)
  await fs.copyFile(dataPath(), target)
  return { ok: true, name: `manual-${stamp}.json` }
})

ipcMain.handle('backup:list', async () => {
  try {
    const files = await fs.readdir(backupDir())
    const items = files
      .filter((f) => BACKUP_NAME.test(f))
      .sort()
      .reverse()
      .slice(0, 50)
      .map((f) => {
        const m = f.match(/-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/)
        return {
          name: f,
          label: m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : f,
          isManual: f.startsWith('manual-')
        }
      })
    return { ok: true, items }
  } catch {
    return { ok: true, items: [] }
  }
})

ipcMain.handle('backup:restore', async (_event, name) => {
  // 只允许恢复备份目录内合法命名的文件，防止任意路径覆盖
  if (typeof name !== 'string' || !BACKUP_NAME.test(name)) throw new Error('无效的备份文件')
  const src = join(backupDir(), name)
  const raw = await fs.readFile(src, 'utf-8')
  JSON.parse(raw) // 内容必须是合法 JSON，否则不让恢复
  await fs.copyFile(src, dataPath())
  return { ok: true }
})

// ============ 应用信息（关于页） ============
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  dataPath: dataPath(),
  backupDir: backupDir()
}))

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: '黑马记账',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 开发时加载热更新地址（electron-vite 提供），打包后加载本地页面
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await backupOnStartup() // 每次启动自动备份一份数据副本
  Menu.setApplicationMenu(null) // 去掉默认菜单：避免误按 Ctrl+R 刷新等快捷键
  createWindow()

  // macOS 下点击 Dock 图标时若无窗口则重新创建（Windows 无此行为，保留以兼容）
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
