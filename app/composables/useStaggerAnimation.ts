import type { Ref } from 'vue'

export interface StaggerOptions {
  delay?: number
  staggerDelay?: number
  threshold?: number
}

export function useStaggerAnimation(
  containerRef: Ref<HTMLElement | null>,
  options: StaggerOptions = {}
) {
  const { delay = 0, staggerDelay = 60, threshold = 0.1 } = options
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    const container = unref(containerRef)
    if (!container) return

    const children = container.children
    if (!children.length) return

    Array.from(children).forEach((child) => {
      const el = child as HTMLElement
      el.style.opacity = '0'
      el.style.transform = 'translateY(10px)'
      el.style.transition = 'none'
    })

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            Array.from(children).forEach((child, index) => {
              const el = child as HTMLElement
              setTimeout(
                () => {
                  el.style.transition =
                    'opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)'
                  el.style.opacity = '1'
                  el.style.transform = 'translateY(0)'
                },
                delay + index * staggerDelay
              )
            })
            observer?.disconnect()
          }
        })
      },
      { threshold }
    )

    observer.observe(container)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })
}
