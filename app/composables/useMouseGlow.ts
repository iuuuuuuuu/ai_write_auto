export function useMouseGlow() {
  const x = ref(0)
  const y = ref(0)
  let rafId: number | null = null

  const handleMouseMove = (e: MouseEvent) => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      x.value = e.clientX
      y.value = e.clientY
    })
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
  })

  onUnmounted(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('mousemove', handleMouseMove)
    if (rafId) cancelAnimationFrame(rafId)
  })

  return { x, y }
}
