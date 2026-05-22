<template>
  <div class="liquid-shell relative flex min-h-screen overflow-hidden px-4 py-6 lg:px-8">
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <span class="liquid-orb left-[8%] top-[12%] h-56 w-56 opacity-60" />
      <span class="liquid-orb bottom-[10%] right-[12%] h-72 w-72 opacity-50" />
      <span class="liquid-highlight left-[18%] top-[22%] h-16 w-72 rotate-[-12deg]" />
    </div>

    <div class="relative mx-auto grid w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section class="card-glass hidden min-h-[660px] overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
        <span class="liquid-orb -left-12 -top-14 h-44 w-44" />
        <span class="liquid-highlight right-8 top-8 h-12 w-64 rotate-[-10deg]" />

        <div class="relative z-10 inline-flex w-fit items-center gap-3 rounded-full bg-white/16 px-4 py-2 text-xs text-(--ui-text-muted) ring-1 ring-white/20 dark:bg-white/8">
          <Icon icon="lucide:sparkles" class="size-4 text-primary-500" />
          Liquid writing studio
        </div>

        <div class="relative z-10 max-w-md">
          <div class="mb-7 flex size-16 items-center justify-center rounded-[1.6rem] bg-primary-500/18 ring-1 ring-white/25">
            <Icon icon="lucide:pen-tool" class="size-8 text-primary-500" />
          </div>
          <h2 class="text-4xl font-semibold leading-tight tracking-[-0.06em] text-(--ui-text-highlighted)">
            AI 小说写作
          </h2>
          <p class="mt-5 max-w-sm text-sm leading-7 text-(--ui-text-muted)">
            让 AI 帮助你构建世界、塑造角色、推进情节。专注创作，其余交给智能助手。
          </p>
        </div>

        <div class="relative z-10 grid grid-cols-3 gap-3 text-xs text-(--ui-text-muted)">
          <div class="liquid-panel p-4">
            <div class="text-lg font-semibold text-(--ui-text-highlighted)">World</div>
            <div class="mt-1">世界观沉淀</div>
          </div>
          <div class="liquid-panel p-4">
            <div class="text-lg font-semibold text-(--ui-text-highlighted)">Draft</div>
            <div class="mt-1">章节推进</div>
          </div>
          <div class="liquid-panel p-4">
            <div class="text-lg font-semibold text-(--ui-text-highlighted)">Review</div>
            <div class="mt-1">持续润色</div>
          </div>
        </div>
      </section>

      <section class="card-glass relative mx-auto w-full max-w-md overflow-hidden p-6 sm:p-8">
        <span class="liquid-orb -right-12 -top-16 h-36 w-36 opacity-65" />
        <span class="liquid-highlight left-8 top-4 h-10 w-44 rotate-[-8deg]" />
        <div class="relative z-10">
          <slot />
        </div>
      </section>
    </div>
  </div>
</template>