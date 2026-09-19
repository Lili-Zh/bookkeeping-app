<script setup>
import { onMounted, ref } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { initStore, showToast } from '../store'

const info = ref(null)
const backups = ref([])
const exporting = ref(false)
const restoreTarget = ref(null) // 待确认恢复的备份

onMounted(async () => {
  try {
    info.value = await window.api.appInfo()
  } catch {
    /* 拿不到信息不阻塞页面 */
  }
  refreshBackups()
})

async function refreshBackups() {
  try {
    const r = await window.api.listBackups()
    backups.value = r.items
  } catch {
    backups.value = []
  }
}

async function handleExport() {
  exporting.value = true
  try {
    const r = await window.api.exportExcel()
    if (r.ok) showToast('已导出到：' + r.path)
    // 用户点了「取消」则不提示
  } catch (err) {
    showToast('导出失败：' + err.message, 'error')
  } finally {
    exporting.value = false
  }
}

async function handleCreateBackup() {
  try {
    await window.api.createBackup()
    await refreshBackups()
    showToast('已手动备份一份数据')
  } catch (err) {
    showToast('备份失败：' + err.message, 'error')
  }
}

async function handleRestore() {
  const name = restoreTarget.value.name
  restoreTarget.value = null
  try {
    await window.api.restoreBackup(name)
    await initStore() // 重新加载恢复后的数据，全 App 立即生效
    showToast('已恢复该备份')
  } catch (err) {
    showToast('恢复失败：' + err.message, 'error')
  }
}
</script>

<template>
  <section>
    <h1 class="page-title">设置</h1>

    <!-- 导出 Excel -->
    <div class="card settings-card">
      <div class="settings-head">
        <div>
          <div class="settings-title">📤 导出 Excel</div>
          <div class="settings-desc">
            把全部账单导出成 Excel 文件（.xlsx），可以用 Excel 打开做进一步分析、打印。导出后可在本页或文件夹中找到该文件。
          </div>
        </div>
        <button class="btn btn-primary" :disabled="exporting" @click="handleExport">导出 Excel</button>
      </div>
    </div>

    <!-- 数据备份 -->
    <div class="card settings-card">
      <div class="settings-head">
        <div>
          <div class="settings-title">💾 数据备份</div>
          <div class="settings-desc">
            数据保存在电脑本地。App 每次启动会自动备份一份；点「立即备份」手动存一份，需要时从下面列表恢复。
          </div>
        </div>
        <button class="btn btn-primary" @click="handleCreateBackup">立即备份</button>
      </div>
      <div v-if="backups.length" class="backup-list">
        <div v-for="b in backups" :key="b.name" class="backup-row">
          <span class="backup-tag" :class="b.isManual ? 'manual' : 'auto'">{{ b.isManual ? '手动' : '自动' }}</span>
          <span class="backup-time">{{ b.label }}</span>
          <button class="btn btn-ghost backup-restore" @click="restoreTarget = b">恢复</button>
        </div>
      </div>
      <div v-else class="backup-empty">还没有备份记录（每次启动 App 会自动生成）</div>
    </div>

    <!-- 关于 -->
    <div class="card settings-card">
      <div class="settings-title">ℹ️ 关于</div>
      <div class="about-row"><span>软件名称</span><b>黑马记账</b></div>
      <div class="about-row"><span>版本</span><b>v{{ info?.version || '-' }}</b></div>
      <div class="about-row"><span>数据保存位置</span><b class="path-value">{{ info?.dataPath || '-' }}</b></div>
      <div class="about-row"><span>备份保存位置</span><b class="path-value">{{ info?.backupDir || '-' }}</b></div>
    </div>

    <!-- 恢复确认弹窗 -->
    <ConfirmDialog
      v-if="restoreTarget"
      title="恢复数据"
      :message="`确定用「${restoreTarget.label}」的备份覆盖当前数据吗？恢复后当前数据会被替换（App 本次启动的自动备份仍在，可再恢复回来）。`"
      @confirm="handleRestore"
      @cancel="restoreTarget = null"
    />
  </section>
</template>
