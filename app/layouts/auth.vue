<template>
  <div class="min-h-screen flex bg-(--ui-bg)">
    <!-- Left: Branding Panel -->
    <div class="hidden lg:flex lg:w-[45%] relative items-center justify-center bg-(--ui-bg-muted) border-r border-(--ui-border)/40 overflow-hidden">
      <!-- Subtle gradient orbs -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-primary-500/[0.04] blur-[120px]" />
        <div class="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-primary-400/[0.03] blur-[100px]" />
      </div>

      <div class="relative text-center px-12 max-w-md">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/15 mb-6">
          <Icon icon="lucide:pen-tool" class="w-7 h-7 text-primary-500" />
        </div>
        <h2 class="text-2xl font-semibold text-(--ui-text-highlighted) tracking-tight">AI 小说写作</h2>
        <p class="mt-3 text-sm text-(--ui-text-muted) leading-relaxed">
          让 AI 帮助你构建世界、塑造角色、推进情节。<br>专注创作，其余交给智能助手。
        </p>
      </div>
    </div>

    <!-- Right: Form Area -->
    <div class="flex-1 flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </div>
  </div>
</template>
