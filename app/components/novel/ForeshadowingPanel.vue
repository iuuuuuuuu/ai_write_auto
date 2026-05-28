<script setup lang="ts">
const props = defineProps<{
  novelId: number
  chapters: Array<{ id: number; chapterNumber: number; title: string }>
}>()

const message = useMessage()
const { data: foreshadowings, refresh } = await useFetch<any[]>(`/api/foreshadowing`, {
  query: { novelId: props.novelId },
  default: () => []
})

const showAddDialog = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  content: '',
  description: '',
  chapterId: null as number | null
})

function openAdd() {
  form.content = ''
  form.description = ''
  form.chapterId = null
  editingId.value = null
  showAddDialog.value = true
}

function openEdit(item: any) {
  form.content = item.content
  form.description = item.description || ''
  form.chapterId = item.chapterId
  editingId.value = item.id
  showAddDialog.value = true
}

async function saveForeshadowing() {
  if (!form.content.trim()) {
    message.warning('请输入伏笔内容')
    return
  }
  try {
    if (editingId.value) {
      await $fetch(`/api/foreshadowing/${editingId.value}`, {
        method: 'PUT',
        body: {
          content: form.content,
          description: form.description || undefined,
          chapterId: form.chapterId || undefined
        }
      })
      message.success('伏笔已更新')
    } else {
      await $fetch('/api/foreshadowing', {
        method: 'POST',
        body: {
          novelId: props.novelId,
          content: form.content,
          description: form.description || undefined,
          chapterId: form.chapterId || undefined
        }
      })
      message.success('伏笔已添加')
    }
    showAddDialog.value = false
    await refresh()
  } catch (err: any) {
    message.error(err.message || '保存失败')
  }
}

async function resolveForeshadowing(id: number, chapterNumber?: number) {
  try {
    await $fetch(`/api/foreshadowing/${id}`, {
      method: 'PUT',
      body: { status: 'resolved', resolvedAtChapter: chapterNumber || null }
    })
    message.success('伏笔已标记为回收')
    await refresh()
  } catch (err: any) {
    message.error(err.message || '操作失败')
  }
}

async function deleteForeshadowing(id: number) {
  try {
    await $fetch(`/api/foreshadowing/${id}`, { method: 'DELETE' })
    message.success('伏笔已删除')
    await refresh()
  } catch (err: any) {
    message.error(err.message || '删除失败')
  }
}

function getStatusColor(status: string) {
  if (status === 'active') return 'warning'
  if (status === 'resolved') return 'success'
  return 'default'
}

function getStatusLabel(status: string) {
  if (status === 'active') return '活跃'
  if (status === 'resolved') return '已回收'
  return '已放弃'
}

const activeCount = computed(() => foreshadowings.value.filter(f => f.status === 'active').length)
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between px-0.5">
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-bold text-(--ui-text-dimmed) uppercase tracking-wider">伏笔追踪</span>
        <NTag v-if="activeCount > 0" size="tiny" type="warning">{{ activeCount }} 活跃</NTag>
      </div>
      <button
        class="flex items-center justify-center w-6 h-6 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
        @click="openAdd"
      >
        <Icon icon="lucide:plus" class="w-3.5 h-3.5" />
      </button>
    </div>

    <div v-if="foreshadowings.length" class="space-y-1">
      <div
        v-for="f in foreshadowings"
        :key="f.id"
        class="group rounded-md px-2 py-1.5 hover:bg-(--ui-bg-muted)/60 transition-colors"
      >
        <div class="flex items-start gap-2">
          <NTag :type="getStatusColor(f.status)" size="tiny">{{ getStatusLabel(f.status) }}</NTag>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] text-(--ui-text) leading-relaxed">{{ f.content }}</p>
            <p v-if="f.description" class="text-[10px] text-(--ui-text-dimmed) mt-0.5">{{ f.description }}</p>
            <div class="flex items-center gap-2 mt-0.5">
              <span v-if="f.chapterNumber" class="text-[9px] text-(--ui-text-dimmed)">第{{ f.chapterNumber }}章铺设</span>
              <span v-if="f.resolvedAtChapter" class="text-[9px] text-emerald-500">第{{ f.resolvedAtChapter }}章回收</span>
            </div>
          </div>
          <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
            <button v-if="f.status === 'active'" class="text-(--ui-text-dimmed) hover:text-emerald-500" title="标记回收" @click="resolveForeshadowing(f.id)">
              <Icon icon="lucide:check-circle" class="w-3 h-3" />
            </button>
            <button class="text-(--ui-text-dimmed) hover:text-(--ui-text)" title="编辑" @click="openEdit(f)">
              <Icon icon="lucide:pencil" class="w-3 h-3" />
            </button>
            <button class="text-(--ui-text-dimmed) hover:text-red-500" title="删除" @click="deleteForeshadowing(f.id)">
              <Icon icon="lucide:trash-2" class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="py-4 text-center text-[11px] text-(--ui-text-dimmed)">
      暂无伏笔，点击 + 添加
    </div>

    <!-- Add/Edit Dialog -->
    <NModal v-model:show="showAddDialog" preset="card" :title="editingId ? '编辑伏笔' : '添加伏笔'" style="max-width: 500px">
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-(--ui-text-dimmed)">伏笔内容 *</label>
          <NInput v-model:value="form.content" type="textarea" placeholder="描述伏笔内容..." :rows="3" size="small" />
        </div>
        <div>
          <label class="text-xs font-medium text-(--ui-text-dimmed)">补充说明（可选）</label>
          <NInput v-model:value="form.description" placeholder="回收方式、注意事项等..." size="small" />
        </div>
        <div>
          <label class="text-xs font-medium text-(--ui-text-dimmed)">铺设章节（可选）</label>
          <NSelect v-model:value="form.chapterId" :options="chapters.map(c => ({ label: `第${c.chapterNumber}章 ${c.title}`, value: c.id }))" placeholder="选择章节" size="small" clearable />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showAddDialog = false">取消</NButton>
          <NButton type="primary" size="small" @click="saveForeshadowing">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
