<script setup lang="ts">
const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotificationCenter()
const showPopover = ref(false)

function getIcon(type: string) {
  if (type === 'success') return 'lucide:check-circle'
  if (type === 'warning') return 'lucide:alert-triangle'
  if (type === 'error') return 'lucide:x-circle'
  return 'lucide:info'
}

function getIconColor(type: string) {
  if (type === 'success') return 'text-emerald-500'
  if (type === 'warning') return 'text-amber-500'
  if (type === 'error') return 'text-red-500'
  return 'text-blue-500'
}

function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}天前`
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function handleClickLink(notification: (typeof notifications.value)[0]) {
  markAsRead(notification.id)
  showPopover.value = false
  if (notification.link) {
    navigateTo(notification.link)
  }
}

function handleRemove(event: Event, id: string) {
  event.stopPropagation()
  removeNotification(id)
}
</script>

<template>
  <NPopover
    v-model:show="showPopover"
    trigger="click"
    placement="bottom-end"
    style="padding: 0"
    :show-arrow="false"
  >
    <template #trigger>
      <button
        class="relative flex size-8 items-center justify-center rounded-lg text-(--ui-text-muted) transition-colors hover:bg-(--ui-bg-muted)/70 hover:text-(--ui-text)"
      >
        <Icon icon="lucide:bell" class="size-4" />
        <span
          v-if="unreadCount > 0"
          class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white animate-pulse-glow"
        >
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </span>
      </button>
    </template>

    <div class="w-80 overflow-hidden rounded-lg bg-(--ui-bg-elevated) shadow-lg">
      <div class="flex items-center justify-between border-b border-(--ui-border)/40 px-3 py-2">
        <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">
          通知中心
        </h3>
        <div class="flex items-center gap-1">
          <NButton
            v-if="unreadCount > 0"
            size="tiny"
            quaternary
            @click="markAllAsRead"
          >
            全部已读
          </NButton>
          <NButton
            v-if="notifications.length > 0"
            size="tiny"
            quaternary
            @click="clearAll"
          >
            清空
          </NButton>
        </div>
      </div>

      <div class="max-h-80 overflow-y-auto">
        <div
          v-if="!notifications.length"
          class="flex flex-col items-center justify-center py-8 text-(--ui-text-muted)"
        >
          <Icon icon="lucide:bell-off" class="size-6 animate-breathe" />
          <p class="mt-2 text-xs">暂无通知</p>
        </div>

        <TransitionGroup name="list">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="group relative cursor-pointer border-b border-(--ui-border)/30 px-3 py-2.5 transition-colors last:border-0 hover:bg-(--ui-bg-muted)/50"
          :class="{ 'bg-primary-500/[0.03]': !notification.read }"
          @click="markAsRead(notification.id)"
        >
          <div class="flex items-start gap-2.5">
            <Icon
              :icon="getIcon(notification.type)"
              class="mt-0.5 size-4 shrink-0"
              :class="getIconColor(notification.type)"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p
                  class="text-xs font-medium"
                  :class="notification.read ? 'text-(--ui-text-muted)' : 'text-(--ui-text-highlighted)'"
                >
                  {{ notification.title }}
                </p>
                <button
                  class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  @click="handleRemove($event, notification.id)"
                >
                  <Icon icon="lucide:x" class="size-3 text-(--ui-text-dimmed)" />
                </button>
              </div>
              <p class="mt-0.5 text-[11px] leading-relaxed text-(--ui-text-muted)">
                {{ notification.message }}
              </p>
              <div class="mt-1 flex items-center justify-between">
                <span class="text-[10px] text-(--ui-text-dimmed)">
                  {{ formatTime(notification.createdAt) }}
                </span>
                <NButton
                  v-if="notification.link"
                  size="tiny"
                  text
                  type="primary"
                  class="text-[11px]"
                  @click="handleClickLink(notification)"
                >
                  {{ notification.linkLabel || '查看' }}
                </NButton>
              </div>
            </div>
          </div>
        </div>
        </TransitionGroup>
      </div>
    </div>
  </NPopover>
</template>
