<script setup>
import { computed, ref, watch } from 'vue'
import BillForm from '../components/BillForm.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { store, updateBill, deleteBill, showToast } from '../store'
import { formatMoney, yuanToFen } from '../utils'

const editingBill = ref(null) // 正在编辑的账单（弹窗）
const deletingBill = ref(null) // 待确认删除的账单

// ============ 搜索与筛选 ============
const keyword = ref('')
const typeFilter = ref('all') // all | expense | income
const catFilter = ref('') // 一级分类名
const dateFrom = ref('')
const dateTo = ref('')
const amountMin = ref('') // 元（字符串，输入框原始值）
const amountMax = ref('')

const hasFilter = computed(
  () =>
    !!keyword.value ||
    typeFilter.value !== 'all' ||
    !!catFilter.value ||
    !!dateFrom.value ||
    !!dateTo.value ||
    !!amountMin.value ||
    !!amountMax.value
)

function resetFilters() {
  keyword.value = ''
  typeFilter.value = 'all'
  catFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  amountMin.value = ''
  amountMax.value = ''
}

// 类型切换后，若已选分类不属于该类型则清空，避免「怎么查都没有」
watch(typeFilter, () => {
  if (!catFilter.value) return
  const cat = store.categories.find((c) => c.name === catFilter.value)
  if (cat && cat.type !== typeFilter.value) catFilter.value = ''
})

// 金额输入转「分」；留空或非法输入时不设边界
// 注意：v-model 会把数字输入框的内容转成数字类型，先统一转成字符串再处理
function parseFenBound(s) {
  if (s === '' || s == null) return null
  const fen = yuanToFen(String(s))
  return Number.isFinite(fen) ? fen : null
}

const filteredBills = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const minFen = parseFenBound(amountMin.value)
  const maxFen = parseFenBound(amountMax.value)
  return store.bills.filter((b) => {
    if (typeFilter.value !== 'all' && b.type !== typeFilter.value) return false
    if (catFilter.value && b.category1 !== catFilter.value) return false
    if (dateFrom.value && b.date < dateFrom.value) return false
    if (dateTo.value && b.date > dateTo.value) return false
    if (minFen != null && b.amount < minFen) return false
    if (maxFen != null && b.amount > maxFen) return false
    if (kw && !`${b.note || ''} ${b.category1} ${b.category2}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const expenseRoots = computed(() => store.categories.filter((c) => c.type === 'expense'))
const incomeRoots = computed(() => store.categories.filter((c) => c.type === 'income'))

// 按月份倒序分组，每月内按日期倒序
const months = computed(() => {
  const map = new Map()
  for (const b of filteredBills.value) {
    const key = b.date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(b)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, bills]) => ({
      month,
      bills: [...bills].sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt)
    }))
})

function monthLabel(month) {
  const [y, m] = month.split('-')
  return `${y}年${Number(m)}月`
}

function monthSummary(bills) {
  const expense = bills.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
  const income = bills.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0)
  return { expense, income, balance: income - expense }
}

const totalExpense = computed(() =>
  filteredBills.value.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
)
const totalIncome = computed(() =>
  filteredBills.value.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0)
)

// 某笔账单的分类图标（二级优先，取不到用一级）
function billIcon(bill) {
  const root = store.categories.find((c) => c.type === bill.type && c.name === bill.category1)
  const sub = root?.children.find((s) => s.name === bill.category2)
  return sub?.icon || root?.icon || '💵'
}

async function handleUpdated(p) {
  await updateBill(editingBill.value.id, p)
  editingBill.value = null
  showToast('已保存修改')
}

async function handleDelete() {
  await deleteBill(deletingBill.value.id)
  deletingBill.value = null
  showToast('已删除这笔账单')
}
</script>

<template>
  <section>
    <h1 class="page-title">账单明细</h1>

    <!-- 搜索与筛选 -->
    <div class="card filter-bar">
      <div class="filter-row">
        <input
          v-model="keyword"
          class="input filter-search"
          type="search"
          placeholder="搜索备注、分类名称…"
        />
        <select v-model="typeFilter" class="input filter-select">
          <option value="all">全部类型</option>
          <option value="expense">支出</option>
          <option value="income">收入</option>
        </select>
        <select v-model="catFilter" class="input filter-select">
          <option value="">全部分类</option>
          <optgroup label="支出分类">
            <option v-for="c in expenseRoots" :key="c.id" :value="c.name">{{ c.icon }} {{ c.name }}</option>
          </optgroup>
          <optgroup label="收入分类">
            <option v-for="c in incomeRoots" :key="c.id" :value="c.name">{{ c.icon }} {{ c.name }}</option>
          </optgroup>
        </select>
      </div>
      <div class="filter-row">
        <span class="filter-label">日期</span>
        <input v-model="dateFrom" type="date" class="input filter-date" />
        <span class="filter-sep">至</span>
        <input v-model="dateTo" type="date" class="input filter-date" />
        <span class="filter-label">金额（元）</span>
        <input v-model="amountMin" type="number" class="input filter-amount" placeholder="最小" min="0" step="0.01" />
        <span class="filter-sep">—</span>
        <input v-model="amountMax" type="number" class="input filter-amount" placeholder="最大" min="0" step="0.01" />
        <button class="btn btn-ghost" :disabled="!hasFilter" @click="resetFilters">重置筛选</button>
      </div>
    </div>

    <!-- 顶部小汇总（随筛选联动） -->
    <div v-if="filteredBills.length" class="card summary-row">
      <div class="summary-item">共 <b>{{ filteredBills.length }}</b> 笔</div>
      <div class="summary-item">总支出 <b class="amount-expense">¥{{ formatMoney(totalExpense) }}</b></div>
      <div class="summary-item">总收入 <b class="amount-income">¥{{ formatMoney(totalIncome) }}</b></div>
    </div>

    <!-- 空状态 -->
    <div v-if="!store.bills.length" class="empty-state">
      <div class="empty-icon">🐴</div>
      <p>还没有账单，去「记账」页记下第一笔吧～</p>
    </div>
    <div v-else-if="!filteredBills.length" class="empty-state">
      <div class="empty-icon">🔍</div>
      <p>没有找到符合条件的账单</p>
      <button class="btn btn-ghost empty-action" @click="resetFilters">清除筛选条件</button>
    </div>

    <!-- 按月分组的流水列表 -->
    <div v-for="g in months" :key="g.month" class="month-block">
      <div class="month-header">
        <span class="month-title">{{ monthLabel(g.month) }}</span>
        <span class="month-summary">
          支出 <b class="amount-expense">¥{{ formatMoney(monthSummary(g.bills).expense) }}</b>
          · 收入 <b class="amount-income">¥{{ formatMoney(monthSummary(g.bills).income) }}</b>
          · 结余 <b :class="monthSummary(g.bills).balance >= 0 ? 'amount-income' : 'amount-expense'">
            ¥{{ formatMoney(Math.abs(monthSummary(g.bills).balance)) }}</b>
        </span>
      </div>
      <div class="bill-list">
        <div v-for="b in g.bills" :key="b.id" class="bill-row" @click="editingBill = b">
          <div class="bill-icon">{{ billIcon(b) }}</div>
          <div class="bill-info">
            <div class="bill-cat">{{ b.category1 }} · {{ b.category2 }}</div>
            <div v-if="b.note" class="bill-note">{{ b.note }}</div>
          </div>
          <div class="bill-date">{{ b.date.slice(5).replace('-', '月') }}日</div>
          <div class="bill-amount" :class="b.type">
            {{ b.type === 'expense' ? '-' : '+' }}¥{{ formatMoney(b.amount) }}
          </div>
          <button class="bill-del" title="删除" @click.stop="deletingBill = b">✕</button>
        </div>
      </div>
    </div>

    <!-- 修改账单弹窗 -->
    <div v-if="editingBill" class="modal-overlay" @click.self="editingBill = null">
      <div class="modal-card">
        <div class="modal-header">
          <h3>修改账单</h3>
          <button class="icon-btn" @click="editingBill = null">✕</button>
        </div>
        <BillForm :initial="editingBill" @saved="handleUpdated" />
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <ConfirmDialog
      v-if="deletingBill"
      title="删除账单"
      :message="`确定删除这笔「${deletingBill.category1} · ${deletingBill.category2}」的账单吗？删除后无法恢复。`"
      @confirm="handleDelete"
      @cancel="deletingBill = null"
    />
  </section>
</template>
