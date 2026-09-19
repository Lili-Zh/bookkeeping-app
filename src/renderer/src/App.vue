<script setup>
import { ref, computed, onMounted } from 'vue'
import JizhangPage from './pages/JizhangPage.vue'
import BillsPage from './pages/BillsPage.vue'
import StatsPage from './pages/StatsPage.vue'
import BudgetPage from './pages/BudgetPage.vue'
import CategoriesPage from './pages/CategoriesPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import { initStore, store, toast, showToast } from './store'
import { formatMoney, todayStr } from './utils'

const navItems = [
  { key: 'jizhang', label: '记账', icon: '✏️', component: JizhangPage },
  { key: 'bills', label: '账单明细', icon: '📋', component: BillsPage },
  { key: 'stats', label: '图表统计', icon: '📊', component: StatsPage },
  { key: 'budget', label: '预算', icon: '🎯', component: BudgetPage },
  { key: 'categories', label: '分类管理', icon: '🗂️', component: CategoriesPage },
  { key: 'settings', label: '设置', icon: '⚙️', component: SettingsPage }
]

const activeKey = ref('jizhang')
const currentPage = computed(
  () => navItems.find((item) => item.key === activeKey.value).component
)

// 本月支出、占预算比例（供启动提醒与导航小圆点共用）
const monthExpense = computed(() => {
  const month = todayStr().slice(0, 7)
  return store.bills
    .filter((b) => b.type === 'expense' && b.date.startsWith(month))
    .reduce((s, b) => s + b.amount, 0)
})
const budgetRatio = computed(() => (store.budget.total ? monthExpense.value / store.budget.total : 0))
const budgetWarning = computed(() => budgetRatio.value >= 0.8)

// 启动时从本地文件加载账单与分类数据，随后检查预算提醒
onMounted(async () => {
  try {
    await initStore()
    if (budgetRatio.value >= 1) {
      showToast(`本月已超预算！已支出 ¥${formatMoney(monthExpense.value)}`, 'error')
    } else if (budgetRatio.value >= 0.8) {
      showToast(`本月预算已用 ${Math.round(budgetRatio.value * 100)}%，注意控制开支`, 'warn')
    }
  } catch (err) {
    console.error('加载数据失败：', err)
  }
})
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-icon">🐴</span>
        <span class="logo-text">黑马记账</span>
      </div>
      <nav class="nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: activeKey === item.key }"
          @click="activeKey = item.key"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.key === 'budget' && budgetWarning" class="nav-badge" title="本月预算已用 80% 以上"></span>
        </button>
      </nav>
      <div class="sidebar-footer">v1.0 正式版</div>
    </aside>
    <main class="content">
      <!-- KeepAlive：切换页面时保留各页状态（如分类管理的页签选择） -->
      <KeepAlive>
        <component :is="currentPage" />
      </KeepAlive>
    </main>
    <!-- 全局轻提示 -->
    <transition name="toast-fade">
      <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.text }}</div>
    </transition>
  </div>
</template>
