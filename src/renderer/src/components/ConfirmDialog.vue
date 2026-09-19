<script setup>
defineProps({
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '' }
})
const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div class="modal-overlay" @click.self="emit('cancel')">
    <div class="modal-card small">
      <h3 class="modal-title">{{ title }}</h3>
      <p class="modal-message">{{ message }}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" @click="emit('cancel')">取消</button>
        <button class="btn btn-danger" @click="emit('confirm')">确定</button>
      </div>
    </div>
  </div>
</template>
