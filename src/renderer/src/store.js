import { reactive } from 'vue'
import { genId } from './utils'

// ===== 全局数据仓库：所有页面共享同一份账单与分类数据 =====
export const store = reactive({
  loaded: false,
  categories: [], // [{ id, type: 'expense'|'income', name, icon, children: [{ id, name, icon }] }]
  bills: [], // [{ id, type, amount(分), category1, category2, date, note, createdAt, updatedAt }]
  budget: { total: 0, byCategory: {} } // 每月预算：total(分) + 分类预算 { 分类名: 分 }
})

// ===== 全局轻提示（顶部短暂弹出后自动消失） =====
export const toast = reactive({ show: false, text: '', type: 'success' })
let toastTimer = null
export function showToast(text, type = 'success') {
  toast.text = text
  toast.type = type
  toast.show = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.show = false), 2200)
}

// 把当前数据交给主进程写入本地文件（先深拷贝，避免序列化 Vue 响应式对象）
async function persist() {
  try {
    await window.api.saveData(
      JSON.parse(JSON.stringify({ categories: store.categories, bills: store.bills, budget: store.budget }))
    )
  } catch (err) {
    console.error('保存数据失败：', err)
    showToast('保存失败，请重试', 'error')
    throw err
  }
}

export async function initStore() {
  const data = await window.api.loadData()
  store.categories = data.categories
  store.bills = data.bills
  store.budget = data.budget
  store.loaded = true
}

// ============ 账单操作 ============

export async function addBill(p) {
  store.bills.push({
    id: genId(),
    type: p.type,
    amount: p.amountFen,
    category1: p.category1,
    category2: p.category2,
    date: p.date,
    note: p.note,
    createdAt: Date.now(),
    updatedAt: Date.now()
  })
  // 记账即时提醒：返回这笔支出后所在月份是否超总预算，由记账页合并进提示里
  // （预算未设置或非支出时不返回）
  let over = null
  if (p.type === 'expense' && store.budget.total > 0) {
    const month = p.date.slice(0, 7)
    const monthExpense = store.bills
      .filter((b) => b.type === 'expense' && b.date.startsWith(month))
      .reduce((s, b) => s + b.amount, 0)
    if (monthExpense > store.budget.total) over = { month, monthExpense }
  }
  await persist()
  return over
}

export async function updateBill(id, p) {
  const bill = store.bills.find((b) => b.id === id)
  if (!bill) return
  Object.assign(bill, {
    type: p.type,
    amount: p.amountFen,
    category1: p.category1,
    category2: p.category2,
    date: p.date,
    note: p.note,
    updatedAt: Date.now()
  })
  await persist()
}

export async function deleteBill(id) {
  store.bills = store.bills.filter((b) => b.id !== id)
  await persist()
}

// ============ 分类操作 ============

export function findCategory(type, name) {
  return store.categories.find((c) => c.type === type && c.name === name)
}

// 同名分类检查：parentName 为空时查一级分类，否则查该一级下的二级分类
export function categoryExists(type, name, parentName) {
  if (parentName == null) return !!findCategory(type, name)
  const parent = findCategory(type, parentName)
  return !!parent?.children.some((s) => s.name === name)
}

// 新增分类；返回是否成功（重名时失败）
export async function addCategory(type, parentName, { name, icon }) {
  if (categoryExists(type, name, parentName)) {
    showToast(parentName == null ? '已有同名一级分类' : '该分类下已有同名二级分类', 'error')
    return false
  }
  if (parentName == null) {
    store.categories.push({ id: genId(), type, name, icon, children: [] })
  } else {
    findCategory(type, parentName).children.push({ id: genId(), name, icon })
  }
  await persist()
  return true
}

// 改名（可同时改图标）；账单里记录的分类名会同步更新，避免旧账单"失联"
export async function renameCategory(type, level, parentName, oldName, newName, icon) {
  if (newName !== oldName && categoryExists(type, newName, parentName)) {
    showToast('已有同名分类', 'error')
    return false
  }
  if (level === 1) {
    const root = findCategory(type, oldName)
    root.name = newName
    if (icon) root.icon = icon
    for (const b of store.bills) {
      if (b.type === type && b.category1 === oldName) b.category1 = newName
    }
    // 该分类若设过预算，预算跟着改到新名字
    if (store.budget.byCategory[oldName] != null) {
      store.budget.byCategory[newName] = store.budget.byCategory[oldName]
      delete store.budget.byCategory[oldName]
    }
  } else {
    const sub = findCategory(type, parentName).children.find((s) => s.name === oldName)
    sub.name = newName
    if (icon) sub.icon = icon
    for (const b of store.bills) {
      if (b.type === type && b.category1 === parentName && b.category2 === oldName) b.category2 = newName
    }
  }
  await persist()
  return true
}

// 统计该分类下有多少笔账单（删除前检查用）
export function countCategoryBills(type, level, name, parentName) {
  if (level === 1) {
    return store.bills.filter((b) => b.type === type && b.category1 === name).length
  }
  return store.bills.filter(
    (b) => b.type === type && b.category1 === parentName && b.category2 === name
  ).length
}

// 删除分类（一级分类会连同其下所有二级分类一起删；调用前须先确认分类下没有账单）
export async function deleteCategory(type, level, name, parentName) {
  if (level === 1) {
    store.categories = store.categories.filter((c) => !(c.type === type && c.name === name))
    delete store.budget.byCategory[name] // 一起清掉该分类的预算
  } else {
    const parent = findCategory(type, parentName)
    parent.children = parent.children.filter((s) => s.name !== name)
  }
  await persist()
}

// ============ 预算操作 ============

// 保存每月总预算（分）；传 0 表示取消总预算
export async function saveBudgetTotal(totalFen) {
  store.budget.total = totalFen
  await persist()
}

// 设置某个支出分类的预算（分）；传 null 表示清除该分类预算
export async function setCategoryBudget(name, fen) {
  if (fen == null) delete store.budget.byCategory[name]
  else store.budget.byCategory[name] = fen
  await persist()
}
