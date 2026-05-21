<script setup lang="ts">
interface SuggestedCharacter {
  name: string
  description: string | null
  traits: string | null
  relationships: string | null
  currentState: string | null
  role: string
}

const props = defineProps<{
  novelId: number
}>()

const emit = defineEmits<{
  adopted: []
}>()

const message = useMessage()
const suggestions = ref<SuggestedCharacter[]>([])
const loading = ref(false)
const adoptingIds = ref<Set<string>>(new Set())

async function fetchSuggestions() {
  loading.value = true
  try {
    const result = await $fetch<{ suggestions: SuggestedCharacter[] }>(
      `/api/novels/${props.novelId}/characters/suggest`,
      { method: 'POST', body: { count: 3 } }
    )
    suggestions.value = result.suggestions
    if (!result.suggestions.length) {
      message.info('AI 暂无新的角色建议')
    }
  } catch (e: any) {
    message.error(e?.data?.message || '获取角色建议失败')
  } finally {
    loading.value = false
  }
}

async function adoptCharacter(character: SuggestedCharacter) {
  const key = character.name
  if (adoptingIds.value.has(key)) return
  adoptingIds.value.add(key)
  try {
    await $fetch(`/api/novels/${props.novelId}/characters`, {
      method: 'POST',
      body: {
        name: character.name,
        description: character.description || undefined,
        traits: character.traits || undefined,
        relationships: character.relationships || undefined,
        currentState: character.currentState || undefined
      }
    })
    message.success(`已采纳角色「${character.name}」`)
    suggestions.value = suggestions.value.filter(c => c.name !== character.name)
    emit('adopted')
  } catch {
    message.error(`采纳「${character.name}」失败`)
  } finally {
    adoptingIds.value.delete(key)
  }
}

async function adoptAll() {
  const remaining = suggestions.value.filter(c => !adoptingIds.value.has(c.name))
  if (!remaining.length) return

  for (const character of remaining) {
    await adoptCharacter(character)
  }
}

function getRoleLabel(role: string) {
  if (role === 'main') return '主角'
  if (role === 'mentioned') return '提及'
  return '配角'
}

function getRoleColor(role: string) {
  if (role === 'main') return 'text-amber-500 bg-amber-500/8'
  if (role === 'mentioned') return 'text-(--ui-text-dimmed) bg-(--ui-bg-muted)'
  return 'text-blue-500 bg-blue-500/8'
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Icon icon="lucide:lightbulb" class="size-4 text-amber-500" />
        <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">
          AI 角色建议
        </h3>
        <span
          v-if="suggestions.length"
          class="rounded-full bg-primary-500/10 px-2 py-0.5 text-[11px] text-primary-600"
        >
          {{ suggestions.length }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <NButton
          v-if="suggestions.length"
          size="tiny"
          quaternary
          @click="suggestions = []"
        >
          收起
        </NButton>
        <NButton
          size="tiny"
          secondary
          :loading="loading"
          @click="fetchSuggestions"
        >
          <template #icon>
            <Icon icon="lucide:sparkles" />
          </template>
          {{ suggestions.length ? '重新生成' : '获取建议' }}
        </NButton>
      </div>
    </div>

    <div
      v-if="loading"
      class="grid gap-2 md:grid-cols-2"
    >
      <NSkeleton
        v-for="i in 3"
        :key="i"
        class="h-28 rounded-lg"
        text
      />
    </div>

    <div
      v-else-if="suggestions.length"
      class="grid gap-2 md:grid-cols-2"
    >
      <article
        v-for="character in suggestions"
        :key="character.name"
        class="flex flex-col rounded-lg border border-(--ui-border)/55 bg-(--ui-bg-muted)/25 p-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="text-sm font-semibold text-(--ui-text-highlighted)">
                {{ character.name }}
              </h4>
              <span
                class="rounded px-1.5 py-0.5 text-[10px] font-medium"
                :class="getRoleColor(character.role)"
              >
                {{ getRoleLabel(character.role) }}
              </span>
            </div>
            <p
              v-if="character.description"
              class="mt-1 line-clamp-2 text-xs leading-relaxed text-(--ui-text-muted)"
            >
              {{ character.description }}
            </p>
          </div>
          <NButton
            size="tiny"
            type="primary"
            :loading="adoptingIds.has(character.name)"
            @click="adoptCharacter(character)"
          >
            采纳
          </NButton>
        </div>

        <div
          v-if="character.traits || character.currentState || character.relationships"
          class="mt-2 grid gap-1.5 text-xs"
        >
          <div
            v-if="character.traits"
            class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1"
          >
            <p class="text-[10px] text-(--ui-text-dimmed)">特征</p>
            <p class="mt-0.5 line-clamp-1 text-(--ui-text-muted)">
              {{ character.traits }}
            </p>
          </div>
          <div class="grid gap-1.5 sm:grid-cols-2">
            <div
              v-if="character.currentState"
              class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1"
            >
              <p class="text-[10px] text-(--ui-text-dimmed)">状态</p>
              <p class="mt-0.5 line-clamp-1 text-(--ui-text-muted)">
                {{ character.currentState }}
              </p>
            </div>
            <div
              v-if="character.relationships"
              class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1"
            >
              <p class="text-[10px] text-(--ui-text-dimmed)">关系</p>
              <p class="mt-0.5 line-clamp-1 text-(--ui-text-muted)">
                {{ character.relationships }}
              </p>
            </div>
          </div>
        </div>
      </article>

      <div class="md:col-span-2 flex justify-end">
        <NButton
          size="tiny"
          secondary
          :disabled="adoptingIds.size > 0"
          @click="adoptAll"
        >
          <template #icon>
            <Icon icon="lucide:check-check" />
          </template>
          全部采纳
        </NButton>
      </div>
    </div>

    <div
      v-else
      class="rounded-lg bg-(--ui-bg-muted)/30 py-6 text-center text-xs text-(--ui-text-muted)"
    >
      点击上方按钮，AI 将基于小说设定推荐潜在角色
    </div>
  </div>
</template>
