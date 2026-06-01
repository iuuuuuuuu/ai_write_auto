<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import {
  NOVEL_GENRE_GROUP_LABELS,
  NOVEL_GENRES,
  getNovelGenreColor,
  getNovelGenreLabelKey,
  getNovelGenreMeta,
  type NovelGenreGroup
} from '~~/shared/novel-catalog'

interface NovelTemplateItem {
  id: number
  name: string
  genre: string
  defaultStyleGuide: string | null
  defaultAiPrompt: string | null
  defaultTemperature: string | null
}

interface CreatedNovel {
  id: number
  title: string
  description: string | null
  genre: string | null
  status: string
  wordCount: number | null
  createdAt: string
  updatedAt: string
}

const show = defineModel<boolean>('show', { default: false })
const emit = defineEmits<{
  created: [novel: CreatedNovel]
}>()

const { t, locale } = useI18n()
const message = useMessage()
const { createNovel } = useNovels()
const formRef = useTemplateRef<FormInst>('formRef')

const createStep = shallowRef(1)
const creatingNovel = shallowRef(false)
const form = reactive({
  templateId: null as number | null,
  title: '',
  genre: null as string | null,
  description: '',
  worldSetting: '',
  styleGuide: '',
  aiTemperature: null as string | null,
  aiExtraPrompt: ''
})

const { data: novelTemplatesResponse } = await useFetch<NovelTemplateItem[]>(
  '/api/novels/templates',
  {
    default: () => []
  }
)

const novelTemplates = computed(() => novelTemplatesResponse.value || [])
const selectedTemplate = computed(
  () =>
    novelTemplates.value.find((template) => template.id === form.templateId) ||
    null
)
const stepItems = ['选择类型', '基础信息', '设定预览']

const genreOptions = computed(() => {
  const groups = new Map<
    NovelGenreGroup,
    Array<{ label: string; value: string }>
  >()
  for (const genre of NOVEL_GENRES) {
    if (!groups.has(genre.group)) groups.set(genre.group, [])
    groups
      .get(genre.group)
      ?.push({ label: t(genre.labelKey), value: genre.value })
  }

  return Array.from(groups.entries()).map(([group, options]) => ({
    type: 'group',
    label:
      locale.value === 'zh-CN' ?
        NOVEL_GENRE_GROUP_LABELS[group].zh
      : NOVEL_GENRE_GROUP_LABELS[group].en,
    key: group,
    children: options
  }))
})

const recommendedTemplates = computed(() => {
  if (!form.genre) return novelTemplates.value
  return novelTemplates.value.filter(
    (template) => template.genre === form.genre
  )
})

const templateOptions = computed(() =>
  recommendedTemplates.value.map((template) => ({
    label: `${template.name} · ${t(getNovelGenreLabelKey(template.genre))}`,
    value: template.id
  }))
)

const selectedGenreMeta = computed(() => getNovelGenreMeta(form.genre))
const canGenerateDescription = computed(
  () => !!form.title.trim() && !!form.genre
)
const canGenerateWorldbuilding = computed(() => !!form.title.trim())
const { streaming: generatingDescription, startStream: streamDescription } =
  useAiStream()
const { streaming: generatingWorldbuilding, startStream: streamWorldbuilding } =
  useAiStream()
const busy = computed(
  () =>
    creatingNovel.value ||
    generatingDescription.value ||
    generatingWorldbuilding.value
)

watch(
  () => form.genre,
  () => {
    if (!form.templateId) return
    const current = novelTemplates.value.find(
      (template) => template.id === form.templateId
    )
    if (current && current.genre !== form.genre) {
      form.templateId = null
    }
  }
)

watch(
  () => form.templateId,
  (templateId) => {
    if (!templateId) return
    const template = novelTemplates.value.find((item) => item.id === templateId)
    if (!template) return
    applyTemplate(template, false)
  }
)

watch(show, (visible) => {
  if (!visible) resetForm()
})

function applyTemplate(template: NovelTemplateItem, overwrite: boolean) {
  form.genre = template.genre
  if (template.defaultStyleGuide && (overwrite || !form.styleGuide.trim())) {
    form.styleGuide = template.defaultStyleGuide
  }
  if (template.defaultAiPrompt && (overwrite || !form.aiExtraPrompt.trim())) {
    form.aiExtraPrompt = template.defaultAiPrompt
  }
  if (template.defaultTemperature && (overwrite || !form.aiTemperature)) {
    form.aiTemperature = template.defaultTemperature
  }
}

function resetForm() {
  createStep.value = 1
  form.templateId = null
  form.title = ''
  form.genre = null
  form.description = ''
  form.worldSetting = ''
  form.styleGuide = ''
  form.aiTemperature = null
  form.aiExtraPrompt = ''
}

function getFirstFormErrorMessage(error: unknown) {
  if (Array.isArray(error)) {
    const firstError = error.flat().find((item) => item?.message)
    return firstError?.message ?? '表单校验未通过'
  }

  return '表单校验未通过'
}

function scrollToFirstFormError() {
  requestAnimationFrame(() => {
    document.querySelector('.n-form-item-feedback--error')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  })
}

function goNext() {
  if (createStep.value === 1 && !form.genre) {
    message.warning('请选择小说类型')
    return
  }
  if (createStep.value === 2 && !form.title.trim()) {
    message.warning('请输入小说标题')
    return
  }
  createStep.value = Math.min(createStep.value + 1, 3)
}

function goPrevious() {
  createStep.value = Math.max(createStep.value - 1, 1)
}

async function generateDescription() {
  if (!canGenerateDescription.value) return
  form.description = ''
  await streamDescription({
    url: '/api/ai/suggest-description',
    body: {
      title: form.title.trim(),
      genre: form.genre,
      template: selectedTemplate.value?.name || undefined
    },
    onChunk: (content) => {
      form.description += content
    },
    onError: (error) => {
      message.error(error)
    }
  })
}

async function generateWorldbuilding() {
  if (!canGenerateWorldbuilding.value) return
  form.worldSetting = ''
  form.styleGuide = ''
  let buffer = ''
  await streamWorldbuilding({
    url: '/api/ai/worldbuilding',
    body: {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      genre: form.genre || undefined
    },
    onChunk: (content) => {
      buffer += content
      form.worldSetting = buffer
    },
    onDone: (fullContent) => {
      try {
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch?.[0] || fullContent)
        form.worldSetting = parsed.worldSetting || fullContent
        form.styleGuide = parsed.styleGuide || ''
      } catch {
        form.worldSetting = fullContent
      }
    },
    onError: (error) => {
      message.error(error)
    }
  })
}

async function handleCreateNovel() {
  try {
    await formRef.value?.validate()
  } catch (error) {
    message.error(getFirstFormErrorMessage(error))
    scrollToFirstFormError()
    return
  }

  creatingNovel.value = true
  try {
    const novel = await createNovel({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      genre: form.genre || undefined,
      worldSetting: form.worldSetting.trim() || undefined,
      styleGuide: form.styleGuide.trim() || undefined,
      aiTemperature: form.aiTemperature || undefined,
      aiExtraPrompt: form.aiExtraPrompt.trim() || undefined
    })
    message.success('小说创建成功')
    show.value = false
    emit('created', novel)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '创建小说失败'
    message.error(errorMessage)
  } finally {
    creatingNovel.value = false
  }
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    :title="t('novel.create')"
    style="max-width: 720px"
    :mask-closable="!busy"
    :close-on-esc="!busy"
    :closable="!busy"
  >
    <div class="mb-5 grid grid-cols-3 gap-2 text-xs text-(--ui-text-muted)">
      <button
        v-for="(item, index) in stepItems"
        :key="item"
        type="button"
        class="rounded-xl border px-3 py-2 text-left transition-colors"
        :class="
          createStep === index + 1 ?
            'border-primary-500 bg-primary-500/10 text-primary-600'
          : 'border-(--ui-border) bg-(--ui-bg-muted)'
        "
        @click="createStep = index + 1"
      >
        <span class="block text-[10px] opacity-70">STEP {{ index + 1 }}</span>
        <span class="mt-0.5 block font-medium">{{ item }}</span>
      </button>
    </div>

    <NForm
      ref="formRef"
      :model="form"
      label-placement="top"
    >
      <div
        v-show="createStep === 1"
        class="space-y-4"
      >
        <NFormItem
          label="小说类型"
          path="genre"
          :rule="{
            required: true,
            message: '请选择小说类型',
            trigger: ['change']
          }"
        >
          <NSelect
            v-model:value="form.genre"
            :options="genreOptions"
            placeholder="选择主类型，模板会按类型推荐"
            filterable
          />
        </NFormItem>

        <NFormItem
          v-if="templateOptions.length"
          label="类型模板"
          path="templateId"
        >
          <NSelect
            v-model:value="form.templateId"
            :options="templateOptions"
            placeholder="选择模板自动填充写作设定"
            filterable
            clearable
          />
        </NFormItem>

        <div
          class="rounded-2xl border border-(--ui-border) bg-(--ui-bg-muted) p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-(--ui-text-highlighted)">
                {{ t(selectedGenreMeta.labelKey) }}
              </p>
              <p class="mt-1 text-xs leading-5 text-(--ui-text-muted)">
                {{
                  selectedTemplate?.name ||
                  '选择模板后会带入默认世界观、文风和创作温度。'
                }}
              </p>
            </div>
            <span
              class="h-9 w-9 shrink-0 rounded-full"
              :style="{ backgroundColor: getNovelGenreColor(form.genre) }"
            />
          </div>
          <NButton
            v-if="selectedTemplate"
            class="mt-3"
            size="small"
            secondary
            :disabled="busy"
            @click="applyTemplate(selectedTemplate, true)"
          >
            <template #icon><Icon icon="lucide:wand-sparkles" /></template>
            重新套用模板内容
          </NButton>
        </div>
      </div>

      <div
        v-show="createStep === 2"
        class="space-y-4"
      >
        <NFormItem
          label="小说标题"
          path="title"
          :rule="{
            required: true,
            message: '请输入小说标题',
            trigger: ['blur', 'input']
          }"
        >
          <NInput
            v-model:value="form.title"
            placeholder="输入小说标题"
            size="large"
            :maxlength="200"
            show-count
            autofocus
            @keyup.enter="goNext"
          />
        </NFormItem>

        <NFormItem
          label="简介"
          path="description"
        >
          <template #label>
            <div class="flex w-full items-center justify-between gap-3">
              <span>简介</span>
              <NTooltip :disabled="canGenerateDescription">
                <template #trigger>
                  <NButton
                    size="tiny"
                    quaternary
                    :loading="generatingDescription"
                    :disabled="!canGenerateDescription"
                    @click="generateDescription"
                  >
                    <template #icon><Icon icon="lucide:sparkles" /></template>
                    AI 生成
                  </NButton>
                </template>
                请先填写标题和类型
              </NTooltip>
            </div>
          </template>
          <NInput
            v-model:value="form.description"
            type="textarea"
            placeholder="一句话概括故事核心，或点击 AI 生成"
            :rows="4"
            :maxlength="5000"
            show-count
          />
        </NFormItem>
      </div>

      <div
        v-show="createStep === 3"
        class="space-y-4"
      >
        <div
          class="flex items-center justify-between gap-3 rounded-2xl border border-(--ui-border) bg-(--ui-bg-muted) p-3"
        >
          <div>
            <p class="text-sm font-medium text-(--ui-text-highlighted)">
              设定预览
            </p>
            <p class="mt-1 text-xs text-(--ui-text-muted)">
              世界观和写作风格可选，创建后仍可继续调整。
            </p>
          </div>
          <NButton
            size="small"
            secondary
            :loading="generatingWorldbuilding"
            :disabled="!canGenerateWorldbuilding"
            @click="generateWorldbuilding"
          >
            <template #icon><Icon icon="lucide:sparkles" /></template>
            AI 生成设定
          </NButton>
        </div>

        <NFormItem
          label="世界观"
          path="worldSetting"
        >
          <NInput
            v-model:value="form.worldSetting"
            type="textarea"
            placeholder="时代背景、地理环境、势力格局、核心规则等"
            :rows="5"
            :maxlength="20000"
            show-count
          />
        </NFormItem>

        <NFormItem
          label="写作风格"
          path="styleGuide"
        >
          <NInput
            v-model:value="form.styleGuide"
            type="textarea"
            placeholder="叙事口吻、节奏、语言风格、禁用表达等"
            :rows="4"
            :maxlength="10000"
            show-count
          />
        </NFormItem>

        <NFormItem
          label="AI 附加提示词"
          path="aiExtraPrompt"
        >
          <NInput
            v-model:value="form.aiExtraPrompt"
            type="textarea"
            placeholder="可选，用于补充 AI 写作时需要长期遵守的题材规则"
            :rows="3"
            :maxlength="5000"
            show-count
          />
        </NFormItem>
      </div>
    </NForm>

    <template #footer>
      <div class="flex justify-between gap-3">
        <NButton
          v-if="createStep > 1"
          size="small"
          quaternary
          :disabled="busy"
          @click="goPrevious"
        >
          <template #icon><Icon icon="lucide:arrow-left" /></template>
          上一步
        </NButton>
        <span v-else />

        <div class="flex gap-2">
          <NButton
            size="small"
            :disabled="busy"
            @click="show = false"
            >{{ t('common.cancel') }}</NButton
          >
          <NButton
            v-if="createStep < 3"
            type="primary"
            size="small"
            :disabled="busy"
            @click="goNext"
          >
            下一步
          </NButton>
          <NButton
            v-else
            type="primary"
            size="small"
            :loading="creatingNovel"
            @click="handleCreateNovel"
          >
            {{ t('common.create') }}
          </NButton>
        </div>
      </div>
    </template>
  </NModal>
</template>
