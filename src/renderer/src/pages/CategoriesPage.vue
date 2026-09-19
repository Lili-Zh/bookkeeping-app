<script setup>
import { ref, computed } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import {
  store,
  showToast,
  addCategory,
  renameCategory,
  deleteCategory,
  countCategoryBills
} from '../store'

const tab = ref('expense') // expense | income
const cats = computed(() => store.categories.filter((c) => c.type === tab.value))

// 新增/改名共用一个弹窗：
// { level: 1|2, parentName?, oldName?(改名时), name, icon }
const editing = ref(null)
// 待确认删除：{ level, name, parentName? }
const deleting = ref(null)

const EMOJIS = [
  '🍜', '🚗', '🛍️', '🏠', '🎬', '🏥', '📚', '🎁', '📶', '📦',
  '💰', '📈', '💼', '🧧', '🪙', '🍳', '☕', '🎮', '🐶', '💄',
  '📱', '✈️', '⛽', '⚡', '🔧', '🧋', '🍎', '🏋️', '💊', '🖥️',
  '🎓', '💝', '🧾', '🏷️', '⭐', '❤️'
]

function openAddRoot() {
  editing.value = { level: 1, parentName: null, oldName: null, name: '', icon: '🏷️' }
}
function openEditRoot(cat) {
  editing.value = { level: 1, parentName: null, oldName: cat.name, name: cat.name, icon: cat.icon }
}
function openAddSub(parent) {
  editing.value = { level: 2, parentName: parent.name, oldName: null, name: '', icon: parent.icon }
}
function openEditSub(parent, sub) {
  editing.value = { level: 2, parentName: parent.name, oldName: sub.name, name: sub.name, icon: sub.icon }
}

async function submitEdit() {
  const name = editing.value.name.trim()
  if (!name) return showToast('请输入分类名称', 'error')
  let ok
  if (editing.value.oldName) {
    ok = await renameCategory(tab.value, editing.value.level, editing.value.parentName, editing.value.oldName, name, editing.value.icon)
  } else {
    ok = await addCategory(tab.value, editing.value.parentName, { name, icon: editing.value.icon })
  }
  if (ok) {
    editing.value = null
    showToast('已保存')
  }
}

// 删除前检查：分类下还有账单则拦截（用户已拍板的规则）
function askDelete(level, name, parentName) {
  const n = countCategoryBills(tab.value, level, name, parentName)
  if (n > 0) {
    showToast(`「${name}」下还有 ${n} 笔账单，请先把它们改到其他分类再删除`, 'error')
    return
  }
  deleting.value = { level, name, parentName }
}

async function confirmDelete() {
  const { level, name, parentName } = deleting.value
  await deleteCategory(tab.value, level, name, parentName)
  deleting.value = null
  showToast('已删除')
}
</script>

<template>
  <section>
    <div class="page-toolbar">
      <h1 class="page-title">分类管理</h1>
      <button class="btn btn-primary" @click="openAddRoot">＋ 添加一级分类</button>
    </div>

    <p class="page-hint">内置分类也可以修改；删除前需要先把分类下的账单改走。分类图标支持 emoji。</p>

    <!-- 支出 / 收入页签 -->
    <div class="tabs">
      <button class="tab-btn" :class="{ active: tab === 'expense' }" @click="tab = 'expense'">
        支出分类
      </button>
      <button class="tab-btn" :class="{ active: tab === 'income' }" @click="tab = 'income'">
        收入分类
      </button>
    </div>

    <!-- 一级分类卡片 -->
    <div class="cat-grid">
      <div v-for="c in cats" :key="c.id" class="cat-card">
        <div class="cat-card-header">
          <span class="cat-card-icon">{{ c.icon }}</span>
          <span class="cat-card-name">{{ c.name }}</span>
          <span class="cat-count">{{ c.children.length }} 个二级</span>
          <button class="cat-op" @click="openAddSub(c)">＋二级</button>
          <button class="cat-op" @click="openEditRoot(c)">改名</button>
          <button class="cat-op danger" @click="askDelete(1, c.name)">删除</button>
        </div>
        <div class="sub-chips">
          <button
            v-for="s in c.children"
            :key="s.id"
            class="sub-chip"
            :title="`点我改名或删除「${s.name}」`"
            @click="openEditSub(c, s)"
          >
            <span>{{ s.icon }}</span>{{ s.name }}
          </button>
          <span v-if="!c.children.length" class="sub-empty">还没有二级分类，点「＋二级」添加</span>
        </div>
      </div>
      <div v-if="!cats.length" class="empty-state">
        <div class="empty-icon">🗂️</div>
        <p>该类型还没有分类，点右上角「＋ 添加一级分类」创建一个吧</p>
      </div>
    </div>

    <!-- 新增 / 改名弹窗 -->
    <div v-if="editing" class="modal-overlay" @click.self="editing = null">
      <div class="modal-card small">
        <div class="modal-header">
          <h3>
            {{ editing.oldName
              ? `修改分类「${editing.oldName}」`
              : editing.level === 1 ? '添加一级分类' : `给「${editing.parentName}」添加二级分类` }}
          </h3>
          <button class="icon-btn" @click="editing = null">✕</button>
        </div>

        <label class="field-label">名称</label>
        <input v-model="editing.name" type="text" class="input full" maxlength="10" placeholder="最多 10 个字" @keyup.enter="submitEdit" />

        <label class="field-label">图标</label>
        <div class="emoji-grid">
          <button
            v-for="e in EMOJIS"
            :key="e"
            class="emoji-cell"
            :class="{ active: editing.icon === e }"
            @click="editing.icon = e"
          >
            {{ e }}
          </button>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="editing = null">取消</button>
          <button class="btn btn-primary" @click="submitEdit">保存</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <ConfirmDialog
      v-if="deleting"
      title="删除分类"
      :message="deleting.level === 1
        ? `确定删除一级分类「${deleting.name}」吗？它下面的所有二级分类也会一起删除。`
        : `确定删除二级分类「${deleting.name}」吗？`"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    />
  </section>
</template>
