<template>
  <div class="relative flex min-h-screen items-center px-4 py-6 lg:px-8">
    <div class="relative mx-auto grid w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section class="card-glass hidden min-h-[660px] overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
        <div class="inline-flex w-fit items-center gap-3 rounded-full bg-(--ui-bg-muted) px-4 py-2 text-xs text-(--ui-text-muted) ring-1 ring-(--ui-border)">
          <Icon icon="lucide:sparkles" class="size-4 text-primary-500" />
          AI Writing Studio
        </div>

        <div class="max-w-md">
          <div class="mb-7 flex size-16 items-center justify-center rounded-2xl bg-primary-500/12">
            <Icon icon="lucide:pen-tool" class="size-8 text-primary-500" />
          </div>
          <h2 class="text-4xl font-semibold leading-tight tracking-[-0.06em] text-(--ui-text-highlighted)">
            AI 小说写作
          </h2>
          <p class="mt-5 max-w-sm text-sm leading-7 text-(--ui-text-muted)">
            让 AI 帮助你构建世界、塑造角色、推进情节。专注创作，其余交给智能助手。
          </p>
        </div>

        <div class="grid grid-cols-3 gap-3 text-xs text-(--ui-text-muted)">
          <div class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4">
            <div class="text-lg font-semibold text-(--ui-text-highlighted)">World</div>
            <div class="mt-1">世界观沉淀</div>
          </div>
          <div class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4">
            <div class="text-lg font-semibold text-(--ui-text-highlighted)">Draft</div>
            <div class="mt-1">章节推进</div>
          </div>
          <div class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4">
            <div class="text-lg font-semibold text-(--ui-text-highlighted)">Review</div>
            <div class="mt-1">持续润色</div>
          </div>
        </div>
      </section>

      <section class="card-glass mx-auto w-full max-w-md overflow-hidden p-6 sm:p-8">
        <slot />
      </section>
    </div>
  </div>
</template>