import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

// ============ 内置默认分类（与 CLAUDE.md 第 5 章一致，用户可在 App 内修改） ============
const DEFAULT_CATEGORIES = [
  { id: 'e1', type: 'expense', name: '餐饮食品', icon: '🍜', children: [
    { id: 'e1-1', name: '早餐', icon: '🍳' }, { id: 'e1-2', name: '午餐', icon: '🍚' },
    { id: 'e1-3', name: '晚餐', icon: '🍲' }, { id: 'e1-4', name: '外卖', icon: '🛵' },
    { id: 'e1-5', name: '零食饮料', icon: '🧋' }, { id: 'e1-6', name: '水果', icon: '🍎' },
    { id: 'e1-7', name: '聚餐请客', icon: '🥂' }
  ] },
  { id: 'e2', type: 'expense', name: '交通出行', icon: '🚗', children: [
    { id: 'e2-1', name: '公交地铁', icon: '🚇' }, { id: 'e2-2', name: '打车', icon: '🚕' },
    { id: 'e2-3', name: '火车高铁', icon: '🚄' }, { id: 'e2-4', name: '飞机', icon: '✈️' },
    { id: 'e2-5', name: '加油充电', icon: '⛽' }, { id: 'e2-6', name: '停车费', icon: '🅿️' }
  ] },
  { id: 'e3', type: 'expense', name: '购物消费', icon: '🛍️', children: [
    { id: 'e3-1', name: '服饰鞋包', icon: '👗' }, { id: 'e3-2', name: '美妆护肤', icon: '💄' },
    { id: 'e3-3', name: '数码家电', icon: '📱' }, { id: 'e3-4', name: '日用百货', icon: '🧻' },
    { id: 'e3-5', name: '家居用品', icon: '🛋️' }
  ] },
  { id: 'e4', type: 'expense', name: '居住生活', icon: '🏠', children: [
    { id: 'e4-1', name: '房租房贷', icon: '🔑' }, { id: 'e4-2', name: '水费', icon: '💧' },
    { id: 'e4-3', name: '电费', icon: '⚡' }, { id: 'e4-4', name: '燃气费', icon: '🔥' },
    { id: 'e4-5', name: '物业费', icon: '🏢' }, { id: 'e4-6', name: '维修', icon: '🔧' }
  ] },
  { id: 'e5', type: 'expense', name: '娱乐休闲', icon: '🎉', children: [
    { id: 'e5-1', name: '电影演出', icon: '🎬' }, { id: 'e5-2', name: '游戏', icon: '🎮' },
    { id: 'e5-3', name: '旅游度假', icon: '🏖️' }, { id: 'e5-4', name: '运动健身', icon: '🏋️' },
    { id: 'e5-5', name: '会员订阅', icon: '💳' }, { id: 'e5-6', name: '宠物', icon: '🐶' }
  ] },
  { id: 'e6', type: 'expense', name: '医疗健康', icon: '🏥', children: [
    { id: 'e6-1', name: '药品', icon: '💊' }, { id: 'e6-2', name: '门诊', icon: '🩺' },
    { id: 'e6-3', name: '住院', icon: '🛏️' }, { id: 'e6-4', name: '体检', icon: '🩻' },
    { id: 'e6-5', name: '保健品', icon: '🧪' }
  ] },
  { id: 'e7', type: 'expense', name: '学习教育', icon: '📚', children: [
    { id: 'e7-1', name: '书籍', icon: '📖' }, { id: 'e7-2', name: '课程培训', icon: '🎓' },
    { id: 'e7-3', name: '考试报名', icon: '📝' }, { id: 'e7-4', name: '文具', icon: '✏️' }
  ] },
  { id: 'e8', type: 'expense', name: '人情往来', icon: '🎁', children: [
    { id: 'e8-1', name: '请客送礼', icon: '🎁' }, { id: 'e8-2', name: '红包', icon: '🧧' },
    { id: 'e8-3', name: '孝敬父母', icon: '👨‍👩‍👧' }
  ] },
  { id: 'e9', type: 'expense', name: '通讯网络', icon: '📶', children: [
    { id: 'e9-1', name: '话费', icon: '☎️' }, { id: 'e9-2', name: '宽带', icon: '🌐' },
    { id: 'e9-3', name: '网费', icon: '🖥️' }
  ] },
  { id: 'e10', type: 'expense', name: '其他支出', icon: '📦', children: [
    { id: 'e10-1', name: '理发', icon: '💇' }, { id: 'e10-2', name: '快递', icon: '📦' },
    { id: 'e10-3', name: '其他杂项', icon: '🧾' }
  ] },
  { id: 'i1', type: 'income', name: '工资薪酬', icon: '💰', children: [
    { id: 'i1-1', name: '月薪', icon: '💰' }, { id: 'i1-2', name: '奖金绩效', icon: '🎉' }
  ] },
  { id: 'i2', type: 'income', name: '投资收益', icon: '📈', children: [
    { id: 'i2-1', name: '理财收益', icon: '📈' }, { id: 'i2-2', name: '股票基金', icon: '📊' },
    { id: 'i2-3', name: '利息', icon: '🏦' }
  ] },
  { id: 'i3', type: 'income', name: '兼职副业', icon: '💼', children: [
    { id: 'i3-1', name: '兼职', icon: '💼' }, { id: 'i3-2', name: '自由职业', icon: '🧑‍💻' }
  ] },
  { id: 'i4', type: 'income', name: '红包礼金', icon: '🧧', children: [
    { id: 'i4-1', name: '红包', icon: '🧧' }, { id: 'i4-2', name: '礼金', icon: '💝' }
  ] },
  { id: 'i5', type: 'income', name: '其他收入', icon: '🪙', children: [
    { id: 'i5-1', name: '退款', icon: '↩️' }, { id: 'i5-2', name: '二手转卖', icon: '🔄' },
    { id: 'i5-3', name: '其他', icon: '🪙' }
  ] }
]

export const dataPath = () => join(app.getPath('userData'), 'data.json')
export const backupDir = () => join(app.getPath('userData'), 'backups')

// 读取数据；文件不存在时生成初始数据（默认分类 + 空账单）
export async function loadData() {
  try {
    const raw = await fs.readFile(dataPath(), 'utf-8')
    const data = JSON.parse(raw)
    // 防御：字段缺失时补全
    if (!Array.isArray(data.categories)) data.categories = structuredClone(DEFAULT_CATEGORIES)
    if (!Array.isArray(data.bills)) data.bills = []
    if (!data.budget || typeof data.budget.total !== 'number') data.budget = { total: 0, byCategory: {} }
    if (!data.budget.byCategory || typeof data.budget.byCategory !== 'object') data.budget.byCategory = {}
    return data
  } catch (err) {
    // 文件损坏：先把损坏的文件另存一份留证，再用初始数据重新开始，避免静默覆盖
    if (err.code !== 'ENOENT') {
      console.error('读取数据失败：', err)
      try {
        await fs.mkdir(backupDir(), { recursive: true })
        await fs.copyFile(dataPath(), join(backupDir(), `corrupt-${Date.now()}.json`))
      } catch { /* 留证失败也不影响继续 */ }
    }
    const initial = {
      categories: structuredClone(DEFAULT_CATEGORIES),
      bills: [],
      budget: { total: 0, byCategory: {} }
    }
    await saveData(initial)
    return initial
  }
}

// 保存数据：先写临时文件再改名替换，防止写一半断电导致数据损坏
export async function saveData(data) {
  const tmp = dataPath() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmp, dataPath())
}

// 每次启动 App 时自动备份一份数据副本，保留最近 30 份（CLAUDE.md 第 7 章）
export async function backupOnStartup() {
  try {
    await fs.mkdir(backupDir(), { recursive: true })
    await fs.access(dataPath()) // 尚无数据文件（首次运行）则跳过
  } catch {
    return
  }
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  await fs.copyFile(dataPath(), join(backupDir(), `data-${stamp}.json`))

  // 清理：只保留最近 30 份自动备份
  const files = (await fs.readdir(backupDir())).filter((f) => /^data-\d{8}-\d{6}\.json$/.test(f)).sort()
  const overflow = files.slice(0, Math.max(0, files.length - 30))
  for (const f of overflow) {
    try { await fs.unlink(join(backupDir(), f)) } catch { /* 忽略删除失败 */ }
  }
}
