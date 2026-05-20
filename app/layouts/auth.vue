<template>
  <div class="min-h-screen flex bg-(--ui-bg)">
    <!-- Left: Branding Panel -->
    <div class="hidden lg:flex lg:w-[42%] relative items-center justify-center border-r border-(--ui-border)/40 overflow-hidden"
         style="background: linear-gradient(160deg, var(--ui-bg-muted) 0%, color-mix(in oklch, var(--ui-bg-muted) 95%, var(--ui-primary-400)) 100%);">
      <!-- Animated gradient orbs -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full animate-float"
             style="background: radial-gradient(circle, var(--ui-primary-400)/8 0%, transparent 70%); filter: blur(80px);" />
        <div class="absolute bottom-1/4 right-1/4 w-[280px] h-[280px] rounded-full animate-float"
             style="animation-delay: -2s; background: radial-gradient(circle, var(--ui-primary-300)/6 0%, transparent 70%); filter: blur(60px);" />
      </div>

      <div class="relative text-center px-10 max-w-sm">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-5 relative overflow-hidden"
             style="background: linear-gradient(135deg, var(--ui-primary-400), var(--ui-primary-600)); box-shadow: 0 8px 32px var(--ui-glow);">
          <Icon icon="lucide:pen-tool" class="w-7 h-7 text-white relative z-10" />
          <div class="absolute inset-0 bg-white/10" />
        </div>
        <h2 class="text-2xl font-bold text-(--ui-text-highlighted) tracking-tight">AI 小说写作</h2>
        <p class="mt-2.5 text-sm text-(--ui-text-muted) leading-relaxed">
          让 AI 帮助你构建世界、塑造角色、推进情节。<br>专注创作，其余交给智能助手。
        </p>
      </div>
    </div>

    <!-- Right: Form Area -->
    <div class="flex-1 flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </div>
  </div>
</template>