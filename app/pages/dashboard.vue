<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { user } = useAuth()

const { data: novels, refresh: refreshNovels } = await useFetch('/api/novels')
const { data: stats } = await useFetch<{ todayWords: number; streak: number; totalNovels: number; totalWords: number }>('/api/stats/overview')

const showCreateModal = ref(false)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-xl font-semibold text-white">{{ t('dashboard.title') }}</h1>
        <p class="mt-0.5 text-sm text-(--ui-text-dimmed)">{{ t('common.appName') }}</p>
      </div>
      <UButton icon="i-lucide-plus" @click="showCreateModal = true">
        {{ t('novel.create') }}
      </UButton>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
      <div class="p-4 rounded-xl bg-(--ui-bg-muted) border border-(--ui-border)">
        <p class="text-xs text-(--ui-text-dimmed) uppercase tracking-wide">{{ t('dashboard.todayWords') }}</p>
        <p class="text-xl font-semibold text-white mt-2">{{ stats?.todayWords || 0 }}</p>
      </div>
      <div class="p-4 rounded-xl bg-(--ui-bg-muted) border border-(--ui-border)">
        <p class="text-xs text-(--ui-text-dimmed) uppercase tracking-wide">{{ t('dashboard.streak') }}</p>
        <p class="text-xl font-semibold text-white mt-2">{{ stats?.streak || 0 }} <span class="text-sm font-normal text-(--ui-text-dimmed)">{{ t('dashboard.days') }}</span></p>
      </div>
      <div class="p-4 rounded-xl bg-(--ui-bg-muted) border border-(--ui-border)">
        <p class="text-xs text-(--ui-text-dimmed) uppercase tracking-wide">{{ t('dashboard.totalNovels') }}</p>
        <p class="text-xl font-semibold text-white mt-2">{{ stats?.totalNovels || 0 }}</p>
      </div>
      <div class="p-4 rounded-xl bg-(--ui-bg-muted) border border-(--ui-border)">
        <p class="text-xs text-(--ui-text-dimmed) uppercase tracking-wide">{{ t('dashboard.totalWords') }}</p>
        <p class="text-xl font-semibold text-white mt-2">{{ stats?.totalWords || 0 }}</p>
      </div>
    </div>

    <!-- Novels -->
    <div v-if="novels?.length" class="space-y-4">
      <h2 class="text-xs font-medium text-(--ui-text-dimmed) uppercase tracking-wider">{{ t('novel.title') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <NuxtLink
          v-for="novel in novels"
          :key="novel.id"
          :to="`/novels/${novel.id}`"
          class="group p-5 rounded-xl bg-(--ui-bg-muted) border border-(--ui-border) hover:border-primary-500/30 transition-colors"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-medium text-(--ui-text) group-hover:text-primary-300 transition-colors truncate">
              {{ novel.title }}
            </h3>
            <UBadge :color="novel.status === 'completed' ? 'success' : novel.status === 'in_progress' ? 'info' : 'neutral'" variant="subtle" size="xs">
              {{ t(`novel.statuses.${novel.status === 'in_progress' ? 'inProgress' : novel.status}`) }}
            </UBadge>
          </div>
          <p v-if="novel.description" class="mt-2 text-sm text-(--ui-text-dimmed) line-clamp-2">
            {{ novel.description }}
          </p>
          <div class="mt-3 flex items-center gap-3 text-xs text-(--ui-text-dimmed)">
            <span>{{ novel.genre || t('novel.genres.other') }}</span>
            <span>{{ novel.wordCount || 0 }} {{ t('novel.wordCount') }}</span>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="text-center py-20">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--ui-bg-muted) border border-(--ui-border) mb-5">
        <UIcon name="i-lucide-book-open" class="w-7 h-7 text-(--ui-text-dimmed)" />
      </div>
      <h3 class="text-base font-medium text-white">{{ t('dashboard.createFirst') }}</h3>
      <p class="mt-1.5 text-sm text-(--ui-text-dimmed)">{{ t('dashboard.createFirstDesc') }}</p>
      <UButton class="mt-5" icon="i-lucide-plus" @click="showCreateModal = true">
        {{ t('novel.create') }}
      </UButton>
    </div>
  </div>
</template>
