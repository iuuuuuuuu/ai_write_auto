import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { Ref } from 'vue'

// Register plugin (only on client)
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export interface ScrollRevealOptions {
  type?: 'fade-up' | 'fade-in' | 'scale-in' | 'slide-left' | 'slide-right'
  duration?: number
  delay?: number
  stagger?: number
  y?: number
  x?: number
  ease?: string
}

const defaultOptions: ScrollRevealOptions = {
  type: 'fade-up',
  duration: 0.6,
  delay: 0,
  stagger: 0.08,
  y: 16,
  x: 0,
  ease: 'power3.out'
}

export function useScrollReveal(
  target: string | Ref<HTMLElement | null>,
  options: ScrollRevealOptions = {}
) {
  const merged = { ...defaultOptions, ...options }
  const tweens: gsap.core.Tween[] = []

  onMounted(() => {
    if (typeof window === 'undefined') return

    const el =
      typeof target === 'string' ?
        document.querySelectorAll(target)
      : unref(target)

    if (!el) return

    const elements =
      el instanceof NodeList ? Array.from(el) : [el as HTMLElement]

    elements.forEach((element, index) => {
      const fromVars: gsap.TweenVars = {
        opacity: 0,
        duration: merged.duration,
        delay: merged.delay! + index * (merged.stagger || 0),
        ease: merged.ease
      }

      switch (merged.type) {
        case 'fade-up':
          fromVars.y = merged.y
          break
        case 'slide-left':
          fromVars.x = merged.x || 30
          break
        case 'slide-right':
          fromVars.x = -(merged.x || 30)
          break
        case 'scale-in':
          fromVars.scale = 0.92
          break
        case 'fade-in':
        default:
          break
      }

      gsap.set(element, { opacity: 0, ...fromVars })

      const tween = gsap.to(element, {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        duration: merged.duration,
        delay: merged.delay! + index * (merged.stagger || 0),
        ease: merged.ease,
        scrollTrigger: {
          trigger: element,
          start: 'top 92%',
          toggleActions: 'play none none none'
        }
      })

      tweens.push(tween)
    })
  })

  onUnmounted(() => {
    tweens.forEach((t) => {
      t.scrollTrigger?.kill()
      t.kill()
    })
    tweens.length = 0
  })

  return { refresh: () => ScrollTrigger.refresh() }
}
