<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  novelId: number
  chapterId: number
  chapterOutline?: string
  direction?: string
  aiConfigId?: number
  skillIds?: number[]
}

interface PreviewWarning {
  type: string
  message: string
}

interface PreviewResponse {
  sections: GenerationContextPreviewSection[]
  warnings: PreviewWarning[]
  selection: GenerationContextSelection
  usage: { inputTokens: number; outputTokens: number }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:selection': [value: GenerationContextSelection | null]
  'ready-change': [value: boolean]
}>()

const message = useMessage()
const loading = ref(false)
const sections = ref<GenerationContextPreviewSection[]>([])
const warnings = ref<PreviewWarning[]>([])
const previewFailed = ref(false)

const {
  initializeFromSections,
  isSelected,
  setSelected,
  setSectionSelected,
  toPayload,
  countSelectedTokens
} = useGenerationContextSelection()

const selectedTokenCount = computed(() => countSelectedTokens(sections.value))

async function fetchPreview() {
  loading.value = true
  previewFailed.value = false
  try {
    const data = await $fetch<PreviewResponse>(
      '/api/ai/generation-context-preview',
      {
        method: 'POST',
        body: {
          novelId: props.novelId,
          chapterId: props.chapterId,
          chapterOutline: props.chapterOutline?.trim() || undefined,
          direction: props.direction?.trim() || undefined,
          aiConfigId: props.aiConfigId,
          skillIds: props.skillIds || []
        }
      }
    )
    sections.value = data.sections
    warnings.value = data.warnings
    initializeFromSections(data.sections)
    emit('update:selection', toPayload(data.sections))
    emit('ready-change', true)
  } catch {
    previewFailed.value = true
    sections.value = []
    warnings.value = []
    emit('update:selection', null)
    emit('ready-change', true)
    message.warning('上下文预览加载失败，将使用系统默认上下文生成')
  } finally {
    loading.value = false
  }
}

function updateItemSelection(key: string, selected: boolean) {
  setSelected(key, selected)
  emit('update:selection', toPayload(sections.value))
}

function updateSectionSelection(
  section: GenerationContextPreviewSection,
  selected: boolean
) {
  setSectionSelected(section, selected)
  emit('update:selection', toPayload(sections.value))
}

defineExpose({ fetchPreview })

watch(
  () => [
    props.chapterOutline,
    props.direction,
    props.aiConfigId,
    props.skillIds?.join(',')
  ],
  () => {
    emit('ready-change', false)
  }
)

onMounted(fetchPreview)
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="text-xs text-gray-500">
        已选择约 {{ selectedTokenCount }} tokens 的生成上下文
      </div>
      <NButton
        size="tiny"
        secondary
        :loading="loading"
        @click="fetchPreview"
      >
        <template #icon>
          <Icon icon="lucide:refresh-cw" />
        </template>
        刷新上下文
      </NButton>
    </div>

    <NAlert
      v-if="previewFailed"
      type="warning"
      :show-icon="false"
    >
      上下文预览不可用。继续生成时会使用系统默认上下文。
    </NAlert>

    <NAlert
      v-for="warning in warnings"
      :key="warning.type"
      type="warning"
      :show-icon="false"
    >
      {{ warning.message }}
    </NAlert>

    <NSpin :show="loading">
      <div class="max-h-[420px] space-y-3 overflow-auto pr-1">
        <NEmpty
          v-if="!sections.length && !loading && !previewFailed"
          description="暂无可预览上下文"
        />
        <section
          v-for="section in sections"
          :key="section.key"
          class="rounded-lg border border-gray-100 p-3 dark:border-gray-800"
        >
          <div class="mb-2 flex items-center justify-between gap-3">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-100">
              {{ section.title }}
              <span class="text-xs font-normal text-gray-400">
                {{ section.items.length }} 项
              </span>
            </div>
            <div class="flex gap-1">
              <NButton
                size="tiny"
                quaternary
                @click="updateSectionSelection(section, true)"
              >
                全选
              </NButton>
              <NButton
                size="tiny"
                quaternary
                @click="updateSectionSelection(section, false)"
              >
                清空
              </NButton>
            </div>
          </div>
          <div class="space-y-2">
            <NCheckbox
              v-for="item in section.items"
              :key="item.key"
              :checked="isSelected(item.key)"
              :disabled="item.required"
              class="w-full"
              @update:checked="
                (checked) => updateItemSelection(item.key, Boolean(checked))
              "
            >
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm text-gray-800 dark:text-gray-100">
                    {{ item.title }}
                  </span>
                  <NTag
                    v-if="item.required"
                    size="small"
                    type="info"
                    :bordered="false"
                  >
                    必选
                  </NTag>
                  <span class="text-xs text-gray-400">
                    约 {{ item.tokenEstimate }} tokens
                  </span>
                </div>
                <p class="line-clamp-2 text-xs leading-relaxed text-gray-500">
                  {{ item.summary || item.content }}
                </p>
              </div>
            </NCheckbox>
          </div>
        </section>
      </div>
    </NSpin>
  </div>
</template>
