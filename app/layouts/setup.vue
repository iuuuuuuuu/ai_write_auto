<template>
  <div class="min-h-screen flex items-center justify-center bg-(--ui-bg) relative overflow-hidden px-4 py-8">
    <!-- Breathing glow -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full animate-breathe"
           style="background: radial-gradient(circle, var(--ui-primary-400)/6 0%, transparent 70%); filter: blur(80px);" />
    </div>

    <!-- Card -->
    <div class="relative w-full max-w-lg">
      <div class="card-elevated p-6 sm:p-8">
        <slot />
      </div>
    </div>
  </div>
</template>