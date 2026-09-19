<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { store } from '../store'
import { formatMoney } from '../utils'

// ============ 月份切换 ============
const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const selectedMonth = ref(currentMonth)

function monthLabel(month) {
  const [y, m] = month.split('-')
  return `${y}年${Number(m)}月`
}

function shiftMonth(delta) {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  selectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ============ 当月收支汇总 ============
const monthBills = computed(() => store.bills.filter((b) => b.date.startsWith(selectedMonth.value)))
const monthExpense = computed(() =>
  monthBills.value.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
)
const monthIncome = computed(() =>
  monthBills.value.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0)
)
const monthBalance = computed(() => monthIncome.value - monthExpense.value)
const expenseBillCount = computed(
  () => monthBills.value.filter((b) => b.type === 'expense').length
)
const yearHasData = computed(() =>
  store.bills.some((b) => b.date.startsWith(selectedMonth.value.slice(0, 4)))
)

// ============ 饼图：支出分类占比（前 5 名 + 其他） ============
// 5 个经过色盲校验的分类色，按固定顺序使用；「其他」用灰色弱化
const PIE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']
const OTHER_COLOR = '#b6b5ae'

function pieSlices() {
  const sums = new Map()
  for (const b of monthBills.value) {
    if (b.type !== 'expense') continue
    sums.set(b.category1, (sums.get(b.category1) || 0) + b.amount)
  }
  const items = [...sums.entries()].sort((a, b) => b[1] - a[1])
  if (items.length <= 5) {
    return {
      slices: items.map(([name, value], i) => ({ name, value, color: PIE_COLORS[i] })),
      otherDetail: []
    }
  }
  const rest = items.slice(5)
  return {
    slices: [
      ...items.slice(0, 5).map(([name, value], i) => ({ name, value, color: PIE_COLORS[i] })),
      { name: '其他', value: rest.reduce((s, [, v]) => s + v, 0), color: OTHER_COLOR }
    ],
    otherDetail: rest
  }
}

// ============ 趋势柱状图数据 ============
function dailyData() {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const labels = Array.from({ length: days }, (_, i) => `${i + 1}日`)
  const expense = Array(days).fill(0)
  const income = Array(days).fill(0)
  for (const b of monthBills.value) {
    const idx = Number(b.date.slice(8)) - 1
    if (b.type === 'expense') expense[idx] += b.amount
    else income[idx] += b.amount
  }
  return { labels, expense, income }
}

function monthlyData() {
  const year = selectedMonth.value.slice(0, 4)
  const labels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
  const expense = Array(12).fill(0)
  const income = Array(12).fill(0)
  for (const b of store.bills) {
    if (!b.date.startsWith(year)) continue
    const idx = Number(b.date.slice(5, 7)) - 1
    if (b.type === 'expense') expense[idx] += b.amount
    else income[idx] += b.amount
  }
  return { labels, expense, income }
}

// ============ 图表配置 ============

// 饼图：圆环 + 中心显示本月支出总额；悬停「其他」可看内部明细
function pieOption() {
  const { slices, otherDetail } = pieSlices()
  return {
    title: {
      text: formatMoney(monthExpense.value),
      subtext: '本月支出',
      left: 'center',
      top: '37%',
      itemGap: 6,
      textStyle: { fontSize: 22, fontWeight: 700, color: '#0b0b0b' },
      subtextStyle: { fontSize: 12, color: '#898781' }
    },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        if (p.name !== '其他') return `${p.name}<br/>¥${formatMoney(p.value)}（${p.percent}%）`
        const detail = otherDetail
          .map(([n, v]) => `　${n}　¥${formatMoney(v)}`)
          .join('<br/>')
        return `其他　¥${formatMoney(p.value)}（${p.percent}%）<br/>${detail}`
      }
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#52514e', fontSize: 12 }
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '65%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        label: { formatter: '{b} {d}%', color: '#52514e', fontSize: 11 },
        labelLine: { length: 10, length2: 10, lineStyle: { color: '#c3c2b7' } },
        data: slices.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } }))
      }
    ]
  }
}

// 柱状图通用配置：支出橙 + 收入绿（与全 App 一致），柱顶 4px 圆角，两根柱之间留 2px 缝隙
function barOption({ labels, expense, income }) {
  const toYuan = (arr) => arr.map((v) => v / 100)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0, 0, 0, 0.04)' } },
      formatter: (params) => {
        let html = `<b>${params[0].name}</b>`
        for (const p of params) {
          html += `<br/>${p.marker}${p.seriesName}：¥${formatMoney(Math.round(p.value * 100))}`
        }
        return html
      }
    },
    legend: {
      top: 0,
      right: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#52514e', fontSize: 12 }
    },
    grid: { left: 0, right: 4, top: 34, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#c3c2b7' } },
      axisLabel: { color: '#898781', fontSize: 11, interval: 'auto' }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#e1e0d9' } },
      axisLabel: {
        color: '#898781',
        fontSize: 11,
        formatter: (v) => (v >= 10000 ? `${v / 10000}万` : v)
      }
    },
    series: [
      {
        name: '支出',
        type: 'bar',
        data: toYuan(expense),
        barMaxWidth: 18,
        barGap: 2,
        barCategoryGap: '30%',
        itemStyle: { color: '#ff9500', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: '收入',
        type: 'bar',
        data: toYuan(income),
        barMaxWidth: 18,
        barGap: 2,
        barCategoryGap: '30%',
        itemStyle: { color: '#07c160', borderRadius: [4, 4, 0, 0] }
      }
    ]
  }
}

// ============ 图表初始化与数据联动 ============
const pieEl = ref(null)
const dailyEl = ref(null)
const monthlyEl = ref(null)
let charts = []

onMounted(() => {
  charts = [echarts.init(pieEl.value), echarts.init(dailyEl.value), echarts.init(monthlyEl.value)]
  window.addEventListener('resize', resizeAll)
  renderAll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeAll)
  for (const c of charts) c.dispose()
})

function resizeAll() {
  for (const c of charts) c.resize()
}

function renderAll() {
  charts[0].setOption(pieOption())
  charts[1].setOption(barOption(dailyData()))
  charts[2].setOption(barOption(monthlyData()))
}

// 账单或月份变化时自动刷新图表
watch(() => [store.bills, selectedMonth.value], renderAll, { deep: true })
</script>

<template>
  <section>
    <div class="page-toolbar">
      <h1 class="page-title">图表统计</h1>
      <div class="month-switcher">
        <button class="month-arrow" title="上个月" @click="shiftMonth(-1)">‹</button>
        <button
          class="month-label"
          :title="selectedMonth === currentMonth ? '' : '回到本月'"
          @click="selectedMonth = currentMonth"
        >
          {{ monthLabel(selectedMonth) }}
          <span v-if="selectedMonth !== currentMonth" class="month-back">回到本月</span>
        </button>
        <button class="month-arrow" title="下个月" @click="shiftMonth(1)">›</button>
      </div>
    </div>

    <!-- 收支对比卡片 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-label">本月支出</div>
        <div class="stat-value amount-expense">¥{{ formatMoney(monthExpense) }}</div>
        <div class="stat-sub">{{ expenseBillCount }} 笔</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本月收入</div>
        <div class="stat-value amount-income">¥{{ formatMoney(monthIncome) }}</div>
        <div class="stat-sub">{{ monthBills.length - expenseBillCount }} 笔</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本月结余</div>
        <div class="stat-value" :class="monthBalance >= 0 ? 'amount-income' : 'amount-expense'">
          ¥{{ formatMoney(monthBalance) }}
        </div>
        <div class="stat-sub">收入 − 支出</div>
      </div>
    </div>

    <!-- 饼图 + 年度月度趋势 -->
    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">支出分类占比</div>
        <div class="chart-box">
          <div ref="pieEl" class="chart-canvas"></div>
          <div v-if="!expenseBillCount" class="chart-empty">本月还没有支出记录</div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-title">{{ selectedMonth.slice(0, 4) }} 年月度趋势</div>
        <div class="chart-box">
          <div ref="monthlyEl" class="chart-canvas"></div>
          <div v-if="!yearHasData" class="chart-empty">{{ selectedMonth.slice(0, 4) }} 年还没有账单</div>
        </div>
      </div>
    </div>

    <!-- 当月每日趋势 -->
    <div class="chart-card">
      <div class="chart-title">{{ monthLabel(selectedMonth) }}每日趋势</div>
      <div class="chart-box">
        <div ref="dailyEl" class="chart-canvas"></div>
        <div v-if="!monthBills.length" class="chart-empty">本月还没有账单，去「记账」页记下第一笔吧～</div>
      </div>
    </div>
  </section>
</template>
