<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()

type SwaggerUiBundle = {
  presets: {
    apis: unknown
  }
  plugins: {
    DownloadUrl: unknown
  }
  (options: {
    url: string
    dom_id: string
    deepLinking: boolean
    presets: unknown[]
    plugins: unknown[]
    layout: string
  }): unknown
}

type SwaggerWindow = Window & {
  SwaggerUIBundle?: SwaggerUiBundle
  SwaggerUIStandalonePreset?: unknown
}

useHead({
  title: 'API 文档',
  script: [
    {
      src: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js',
      defer: true
    }
  ],
  link: [
    {
      rel: 'stylesheet',
      href: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css'
    }
  ]
})

onMounted(() => {
  const init = () => {
    const win = window as SwaggerWindow
    if (win.SwaggerUIBundle) {
      win.SwaggerUIBundle({
        url: '/api/openapi/spec',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [win.SwaggerUIBundle.presets.apis, win.SwaggerUIStandalonePreset],
        plugins: [win.SwaggerUIBundle.plugins.DownloadUrl],
        layout: 'BaseLayout'
      })
    }
  }

  if (document.readyState === 'complete') {
    init()
  } else {
    window.addEventListener('load', init)
  }
})
</script>

<template>
  <div class="h-[calc(100vh-36px)] flex flex-col bg-(--ui-bg)">
    <div
      class="flex items-center gap-2.5 px-4 h-12 border-b border-(--ui-border)/60 bg-(--ui-bg-muted)/60 backdrop-blur-md shrink-0"
    >
      <button
        class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/80 transition-colors"
        @click="navigateTo('/settings')"
      >
        <Icon
          icon="lucide:arrow-left"
          class="w-4 h-4"
        />
      </button>
      <h1 class="text-sm font-bold text-(--ui-text-highlighted)">
        API 文档
      </h1>
    </div>
    <div
      id="swagger-ui"
      class="flex-1 overflow-y-auto"
    />
  </div>
</template>
