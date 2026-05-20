import type { Ref } from 'vue'

export interface TiltOptions {
  max?: number
  perspective?: number
  scale?: number
}

export function useTilt(
  elementRef: Ref<HTMLElement | null>,
  options: TiltOptions = {}
) {
  const { max = 8, perspective = 1000, scale = 1.02 } = options
  let rafId: number | null = null

  const handleMouseMove = (e: MouseEvent) => {
    const el = unref(elementRef)
    if (!el) return

    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const percentX = (e.clientX - centerX) / (rect.width / 2)
      const percentY = (e.clientY - centerY) / (rect.height / 2)

      const rotateX = -percentY * max
      const rotateY = percentX * max

      el.style.transform = `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`
    })
  }

  const handleMouseLeave = () => {
    const el = unref(elementRef)
    if (!el) return

    if (rafId) cancelAnimationFrame(rafId)
    el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
    el.style.transition = 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)'
  }

  const handleMouseEnter = () => {
    const el = unref(elementRef)
    if (!el) return
    el.style.transition = 'transform 0.1s ease-out'
  }

  onMounted(() => {
    const el = unref(elementRef)
    if (!el) return
    el.addEventListener('mousemove', handleMouseMove, { passive: true })
    el.addEventListener('mouseleave', handleMouseLeave, { passive: true })
    el.addEventListener('mouseenter', handleMouseEnter, { passive: true })
  })

  onUnmounted(() => {
    const el = unref(elementRef)
    if (!el) return
    el.removeEventListener('mousemove', handleMouseMove)
    el.removeEventListener('mouseleave', handleMouseLeave)
    el.removeEventListener('mouseenter', handleMouseEnter)
    if (rafId) cancelAnimationFrame(rafId)
  })
}
