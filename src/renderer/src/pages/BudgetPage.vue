<script setup>
import { computed, reactive, ref } from 'vue'
import { store, saveBudgetTotal, setCategoryBudget, showToast } from '../store'
import { formatMoney, yuanToFen, todayStr } from '../utils'

const monthLabel = computed(() => {
  const [y, m] = todayStr().slice(0, 7).split('-')
  return `${y}年${Number(m)}月`
})

// 本月支出（预算按自然月统计）
const monthExpense = computed(() => {
  const month = todayStr().slice(0, 7)
  return store.bills
    .filter((b) => b.type === 'expense' && b.date.startsWith(month))
    .reduce((s, b) => s + b.amount, 0)
})

function catExpense(name) {
  const month = todayStr().slice(0, 7)
  return store.bills
    .filter((b) => b.type === 'expense' && b.category1 === name && b.date.startsWith(month))
    .reduce((s, b) => s + b.amount, 0)
}

const expenseRoots = computed(() => store.categories.filter((c) => c.type === 'expense'))

// 进度条颜色等级：<80% 绿，≥80% 黄，≥100% 红
function level(ratio) {
  return ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warn' : 'ok'
}

const totalInput = ref('')
const catInputs = reactive({}) // 分类名 -> 输入框内容

async function handleSaveTotal() {
  const fen = yuanToFen(totalInput.value)
  if (!Number.isFinite(fen) || fen <= 0) {
    showToast('请输入正确的预算金额（大于 0）', 'error')
    return
  }
  await saveBudgetTotal(fen)
  totalInput.value = ''
  showToast('已保存每月总预算')
}

async function handleClearTotal() {
  await saveBudgetTotal(0)
  showToast('已取消总预算')
}

async function handleSaveCat(name) {
  // 数字输入框 v-model 会给出数字类型，先转字符串再处理
  const raw = String(catInputs[name] || '').trim()
  if (!raw) return
  const fen = yuanToFen(raw)
  if (!Number.isFinite(fen) || fen <= 0) {
    showToast('请输入正确的预算金额（大于 0）', 'error')
    return
  }
  await setCategoryBudget(name, fen)
  catInputs[name] = ''
  showToast(`已保存「${name}」预算`)
}

async function handleClearCat(name) {
  await setCategoryBudget(name, null)
  showToast(`已清除「${name}」预算`)
}
</script>

<template>
  <section>
    <h1 class="page-title">预算</h1>
    <p class="page-hint">{{ monthLabel }} · 每月自动重新计算，预算适用于所有月份</p>

    <!-- 每月总预算 -->
    <div class="card budget-card">
      <div class="budget-head">
        <div>
          <div class="budget-title">每月总预算</div>
          <div class="budget-sub">
            已用 <b class="amount-expense">¥{{ formatMoney(monthExpense) }}</b>
            <template v-if="store.budget.total">
              / ¥{{ formatMoney(store.budget.total) }}
              · 已用 {{ Math.round((monthExpense / store.budget.total) * 100) }}%
            </template>
          </div>
        </div>
        <div class="budget-edit">
          <input
            v-model="totalInput"
            class="input budget-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="输入每月预算（元）"
            @keyup.enter="handleSaveTotal"
          />
          <button class="btn btn-primary" @click="handleSaveTotal">保存</button>
          <button v-if="store.budget.total" class="btn btn-ghost" @click="handleClearTotal">取消预算</button>
        </div>
      </div>

      <div v-if="store.budget.total" class="budget-progress">
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="level(monthExpense / store.budget.total)"
            :style="{ width: Math.min(100, (monthExpense / store.budget.total) * 100) + '%' }"
          ></div>
        </div>
        <div class="budget-note" :class="level(monthExpense / store.budget.total)">
          <template v-if="monthExpense > store.budget.total">
            ⚠️ 已超支 ¥{{ formatMoney(monthExpense - store.budget.total) }}，本月要收紧啦
          </template>
          <template v-else-if="monthExpense / store.budget.total >= 0.8">
            ⚠️ 快接近预算了，还剩 ¥{{ formatMoney(store.budget.total - monthExpense) }}
          </template>
          <template v-else>
            还剩 ¥{{ formatMoney(store.budget.total - monthExpense) }}，放心花～
          </template>
        </div>
      </div>
      <div v-else class="budget-note muted">还没有设置总预算，输入金额点「保存」即可</div>
    </div>

    <!-- 分类预算（可选） -->
    <div class="card budget-card">
      <div class="budget-title">分类预算（可选）</div>
      <div class="budget-sub">给某个支出分类单独设预算，留空表示不限</div>

      <div class="cat-budget-list">
        <div v-for="c in expenseRoots" :key="c.id" class="cat-budget-row">
          <span class="cat-budget-icon">{{ c.icon }}</span>
          <div class="cat-budget-info">
            <div class="cat-budget-name">{{ c.name }}</div>
            <div class="cat-budget-spent">
              本月已花 <b class="amount-expense">¥{{ formatMoney(catExpense(c.name)) }}</b>
            </div>
          </div>

          <div v-if="store.budget.byCategory[c.name]" class="cat-budget-bar">
            <div class="progress-track">
              <div
                class="progress-fill"
                :class="level(catExpense(c.name) / store.budget.byCategory[c.name])"
                :style="{
                  width: Math.min(100, (catExpense(c.name) / store.budget.byCategory[c.name]) * 100) + '%'
                }"
              ></div>
            </div>
            <div class="cat-budget-note">
              预算 ¥{{ formatMoney(store.budget.byCategory[c.name]) }} ·
              <span :class="level(catExpense(c.name) / store.budget.byCategory[c.name])">
                <template v-if="catExpense(c.name) > store.budget.byCategory[c.name]">
                  已超支 ¥{{ formatMoney(catExpense(c.name) - store.budget.byCategory[c.name]) }}
                </template>
                <template v-else>
                  还剩 ¥{{ formatMoney(store.budget.byCategory[c.name] - catExpense(c.name)) }}
                </template>
              </span>
            </div>
          </div>

          <div class="cat-budget-edit">
            <input
              v-model="catInputs[c.name]"
              class="input budget-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="预算（元）"
              @keyup.enter="handleSaveCat(c.name)"
            />
            <button class="btn btn-primary" @click="handleSaveCat(c.name)">保存</button>
            <button
              v-if="store.budget.byCategory[c.name]"
              class="btn btn-ghost"
              @click="handleClearCat(c.name)"
            >
              清除
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
