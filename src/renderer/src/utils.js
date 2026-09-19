// ===== 通用小工具 =====

// 金额显示：分 → '1,234.50'（带千位分隔）
export function formatMoney(fen) {
  return (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 金额输入：元字符串 → 分（整数）；非法输入返回 NaN
export function yuanToFen(str) {
  const n = Number(str)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

// 今天日期，格式 YYYY-MM-DD
export function todayStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 生成本地唯一 id（内部实现细节，够用即可）
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
