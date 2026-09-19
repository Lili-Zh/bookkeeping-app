import { contextBridge, ipcRenderer } from 'electron'

// 安全桥梁：界面层只能通过这些接口读写本地数据/文件，不直接接触文件系统
contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('store:load'),
  saveData: (data) => ipcRenderer.invoke('store:save', data),
  exportExcel: () => ipcRenderer.invoke('export:excel'),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (name) => ipcRenderer.invoke('backup:restore', name),
  appInfo: () => ipcRenderer.invoke('app:info')
})
