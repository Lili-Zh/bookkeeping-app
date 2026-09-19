<script setup>
import { ref, computed, watch } from 'vue'
import { store, showToast } from '../store'
import { yuanToFen, todayStr } from '../utils'

// 传入 initial（一笔已有账单）时为"修改模式"，否则为"记一笔"模式
const props = defineProps({ initial: { type: Object, default: null } })
const emit = defineEmits(['saved'])

const type = ref(props.initial?.type ?? 'expense')
const amountStr = ref(props.initial ? (props.initial.amount / 100).toFixed(2) : '')
const category1 = ref(props.initial?.category1 ?? '')
const category2 = ref(props.initial?.category2 ?? '')
const date = ref(props.initial?.date ?? todayStr())
const note = ref(props.initial?.note ?? '')
const amountInput = ref(null)

const cats = computed(() => store.categories.filter((c) => c.type === type.value))
const selCat = computed(() => cats.value.find((c) => c.name === category1.value))

// 切换支出/收入时，清空已选分类
watch(type, () => {
  category1.value = ''
  category2.value = ''
})

function pickCat1(name) {
  category1.value = name
  category2.value = ''
}

// 金额输入过滤：只允许数字和一个小数点，最多两位小数
function onAmountInput(e) {
  let v = e.target.value.replace(/[^\d.]/g, '')
  const firstDot = v.indexOf('.')
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
  }
  if (v.length > 10) v = v.slice(0, 10)
  if (e.target.value !== v) e.target.value = v
  amountStr.value = v
}

function save() {
  const fen = yuanToFen(amountStr.value)
  if (!fen || fen <= 0) return showToast('请输入正确的金额', 'error')
  if (!category2.value) return showToast('请选择二级分类', 'error')
  if (!date.value) return showToast('请选择日期', 'error')
  emit('saved', {
    type: type.value,
    amountFen: fen,
    category1: category1.value,
    category2: category2.value,
    date: date.value,
    note: note.value.trim()
  })
  // 记一笔模式：保存后清空金额和备注，方便继续记下一笔
  if (!props.initial) {
    amountStr.value = ''
    note.value = ''
    amountInput.value?.focus()
  }
}
</script>

<template>
  <div class="bill-form">
    <!-- 支出 / 收入切换 -->
    <div class="type-toggle">
      <button
        class="type-btn expense"
        :class="{ active: type === 'expense' }"
        @click="type = 'expense'"
      >
        支出
      </button>
      <button
        class="type-btn income"
        :class="{ active: type === 'income' }"
        @click="type = 'income'"
      >
        收入
      </button>
    </div>

    <!-- 大号金额输入 -->
    <div class="amount-box">
      <span class="yuan">¥</span>
      <input
        ref="amountInput"
        v-model="amountStr"
        class="amount-input"
        placeholder="0.00"
        inputmode="decimal"
        autofocus
        @input="onAmountInput"
      />
    </div>

    <!-- 一级分类图标宫格 -->
    <div v-if="cats.length" class="cat1-grid">
      <button
        v-for="c in cats"
        :key="c.id"
        class="cat1-item"
        :class="{ active: category1 === c.name, income: type === 'income' }"
        @click="pickCat1(c.name)"
      >
        <span class="cat1-icon">{{ c.icon }}</span>
        <span>{{ c.name }}</span>
      </button>
    </div>
    <div v-else class="form-hint">该类型还没有分类，请先到「分类管理」页添加</div>

    <!-- 选中一级分类后展开二级分类 -->
    <div v-if="selCat" class="cat2-chips">
      <button
        v-for="s in selCat.children"
        :key="s.id"
        class="chip"
        :class="{ active: category2 === s.name }"
        @click="category2 = s.name"
      >
        <span>{{ s.icon }}</span>{{ s.name }}
      </button>
    </div>

    <!-- 日期与备注 -->
    <div class="form-row">
      <input v-model="date" type="date" class="input date-input" />
      <input v-model="note" type="text" class="input note-input" maxlength="30" placeholder="备注（选填）" />
    </div>

    <button class="btn btn-primary btn-block" @click="save">
      {{ initial ? '保存修改' : '保 存' }}
    </button>
  </div>
</template>
