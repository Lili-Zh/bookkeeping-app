<script setup>
import BillForm from '../components/BillForm.vue'
import { addBill, showToast } from '../store'
import { formatMoney } from '../utils'

async function handleSaved(p) {
  const over = await addBill(p)
  if (over) {
    // 这笔支出让本月超出总预算：把成功和超支提醒合在一条里，避免互相盖掉
    const [y, m] = over.month.split('-')
    showToast(
      `已记一笔 ✓ 注意：${y}年${Number(m)}月已超预算，本月支出 ¥${formatMoney(over.monthExpense)}`,
      'warn'
    )
  } else {
    showToast('已记一笔 ✓')
  }
}
</script>

<template>
  <section>
    <h1 class="page-title">记账</h1>
    <div class="card bill-form-card">
      <BillForm @saved="handleSaved" />
    </div>
  </section>
</template>
