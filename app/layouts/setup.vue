<template>
  <div class="min-h-screen flex items-center justify-center bg-(--ui-bg) relative overflow-hidden">
    <!-- Subtle gradient background -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary-500/[0.03] blur-[100px]" />
    </div>

    <!-- Card -->
    <div class="relative w-full max-w-lg mx-auto px-4 py-12">
      <div class="bg-(--ui-bg-muted) border border-(--ui-border) rounded-2xl shadow-2xl shadow-black/20 p-8 sm:p-10">
        <slot />
      </div>
    </div>
  </div>
</template>
