<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { user } = useAuth()

const { data: novels, refresh: refreshNovels } = await useFetch('/api/novels')
const { data: stats } = await useFetch('/api/stats/overview')

const showCreateModal = ref(false)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('dashboard.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('common.appName') }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <UButton icon="i-lucide-plus" @click="showCreateModal = true">
          {{ t('novel.create') }}
        </UButton>
        <UDropdownMenu
          :items="[
            [{ label: t('common.settings'), icon: 'i-lucide-settings', to: '/settings' }],
            [{ label: t('common.logout'), icon: 'i-lucide-log-out', click: () => useAuth().logout() }],
          ]"
        >
          <UButton variant="ghost" icon="i-lucide-user" />
        </UDropdownMenu>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.todayWords') }}</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats?.todayWords || 0 }}</p>
      </div>
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.streak') }}</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats?.streak || 0 }} {{ t('dashboard.days') }}</p>
      </div>
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.totalNovels') }}</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats?.totalNovels || 0 }}</p>
      </div>
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.totalWords') }}</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats?.totalWords || 0 }}</p>
      </div>
    </div>

    <!-- Novel Grid -->
    <div v-if="novels?.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <NuxtLink
        v-for="novel in novels"
        :key="novel.id"
        :to="`/novels/${novel.id}`"
        class="group p-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
      >
        <div class="flex items-start justify-between">
          <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {{ novel.title }}
          </h3>
          <UBadge :color="novel.status === 'completed' ? 'success' : novel.status === 'in_progress' ? 'info' : 'neutral'" variant="subtle" size="sm">
            {{ t(`novel.statuses.${novel.status === 'in_progress' ? 'inProgress' : novel.status}`) }}
          </UBadge>
        </div>
        <p v-if="novel.description" class="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
          {{ novel.description }}
        </p>
        <div class="mt-4 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span>{{ novel.genre || t('novel.genres.other') }}</span>
          <span>{{ novel.wordCount || 0 }} {{ t('novel.wordCount') }}</span>
        </div>
      </NuxtLink>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-16">
      <UIcon name="i-lucide-book-open" class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
      <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">
        {{ t('dashboard.createFirst') }}
      </h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('dashboard.createFirstDesc') }}
      </p>
      <UButton class="mt-6" icon="i-lucide-plus" @click="showCreateModal = true">
        {{ t('novel.create') }}
      </UButton>
    </div>
  </div>
</template>
