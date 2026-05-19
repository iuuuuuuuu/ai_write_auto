<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { user } = useAuth()

const { data: novels, refresh: refreshNovels } = await useFetch('/api/novels')
const { data: stats } = await useFetch('/api/stats/overview')

const showCreateModal = ref(false)

const statCards = computed(() => [
  { label: t('dashboard.todayWords'), value: stats.value?.todayWords || 0, icon: 'i-lucide-pencil', color: 'primary' },
  { label: t('dashboard.streak'), value: `${stats.value?.streak || 0} ${t('dashboard.days')}`, icon: 'i-lucide-flame', color: 'orange' },
  { label: t('dashboard.totalNovels'), value: stats.value?.totalNovels || 0, icon: 'i-lucide-book-open', color: 'violet' },
  { label: t('dashboard.totalWords'), value: stats.value?.totalWords || 0, icon: 'i-lucide-text', color: 'emerald' },
])
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">
          {{ t('dashboard.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-400">
          {{ t('common.appName') }}
        </p>
      </div>
      <UButton icon="i-lucide-plus" @click="showCreateModal = true">
        {{ t('novel.create') }}
      </UButton>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      <div
        v-for="card in statCards"
        :key="card.label"
        class="p-5 rounded-xl bg-gray-900/60 border border-gray-800/50 backdrop-blur-sm"
      >
        <div class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 rounded-lg bg-gray-800/80 flex items-center justify-center">
            <UIcon :name="card.icon" class="w-4 h-4 text-gray-400" />
          </div>
        </div>
        <p class="text-2xl font-bold text-white">{{ card.value }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ card.label }}</p>
      </div>
    </div>

    <!-- Novel Grid -->
    <div v-if="novels?.length" class="space-y-5">
      <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wider">{{ t('novel.title') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="novel in novels"
          :key="novel.id"
          :to="`/novels/${novel.id}`"
          class="group p-5 rounded-xl bg-gray-900/60 border border-gray-800/50 hover:border-primary-500/30 hover:bg-gray-900/80 transition-all duration-200"
        >
          <div class="flex items-start justify-between">
            <h3 class="font-semibold text-white group-hover:text-primary-400 transition-colors">
              {{ novel.title }}
            </h3>
            <UBadge :color="novel.status === 'completed' ? 'success' : novel.status === 'in_progress' ? 'info' : 'neutral'" variant="subtle" size="sm">
              {{ t(`novel.statuses.${novel.status === 'in_progress' ? 'inProgress' : novel.status}`) }}
            </UBadge>
          </div>
          <p v-if="novel.description" class="mt-2 text-sm text-gray-400 line-clamp-2">
            {{ novel.description }}
          </p>
          <div class="mt-4 flex items-center gap-4 text-xs text-gray-500">
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-tag" class="w-3 h-3" />
              {{ novel.genre || t('novel.genres.other') }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-text" class="w-3 h-3" />
              {{ novel.wordCount || 0 }}
            </span>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-20">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/50 mb-5">
        <UIcon name="i-lucide-book-open" class="w-8 h-8 text-gray-500" />
      </div>
      <h3 class="text-lg font-medium text-white">
        {{ t('dashboard.createFirst') }}
      </h3>
      <p class="mt-2 text-sm text-gray-400 max-w-sm mx-auto">
        {{ t('dashboard.createFirstDesc') }}
      </p>
      <UButton class="mt-6" icon="i-lucide-plus" size="lg" @click="showCreateModal = true">
        {{ t('novel.create') }}
      </UButton>
    </div>
  </div>
</template>
