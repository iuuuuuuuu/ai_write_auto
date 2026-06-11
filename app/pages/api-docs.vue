<script setup lang="ts">
definePageMeta({ layout: 'default' })

type SwaggerUiBundle = {
  presets: {
    apis: unknown
  }
  plugins: {
    DownloadUrl: unknown
  };
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
        presets: [
          win.SwaggerUIBundle.presets.apis,
          win.SwaggerUIStandalonePreset
        ],
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
      class="card-glass z-10 mx-3 mt-3 flex h-12 shrink-0 items-center gap-2.5 px-4"
    >
      <button
        class="flex h-8 w-8 items-center justify-center rounded-full text-(--ui-text-muted) transition-colors hover:bg-(--ui-bg-muted) hover:text-(--ui-text)"
        @click="navigateTo('/settings/openapi')"
      >
        <Icon
          icon="lucide:arrow-left"
          class="w-4 h-4"
        />
      </button>
      <h1 class="text-sm font-bold text-(--ui-text-highlighted)">API 文档</h1>
    </div>
    <div
      id="swagger-ui"
      class="flex-1 overflow-y-auto"
    />
  </div>
</template>
