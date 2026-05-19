<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 relative overflow-hidden">
    <!-- Background decoration -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-1/3 -left-1/4 w-[700px] h-[700px] rounded-full bg-primary-500/5 blur-3xl" />
      <div class="absolute -bottom-1/3 -right-1/4 w-[500px] h-[500px] rounded-full bg-primary-500/3 blur-3xl" />
    </div>

    <!-- Content -->
    <div class="relative w-full max-w-md mx-auto px-4 py-12">
      <div class="bg-gray-900/80 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl p-8 sm:p-10">
        <slot />
      </div>
    </div>
  </div>
</template>
