const ONBOARDING_KEY = 'ai_write_onboarding_v1'

export interface OnboardingStep {
  title: string
  description: string
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    title: '欢迎使用 AI 小说写作助手',
    description:
      '这是一个帮助作者进行 AI 辅助创作的工具。你可以在「控制台」创建小说，在「编辑器」中写作，并利用 AI 进行续写、扩写和改写。'
  },
  {
    title: '创建你的第一部小说',
    description:
      '点击「新建小说」按钮开始创作。你可以为小说设定世界观、风格指南，并让 AI 辅助生成章节大纲。'
  },
  {
    title: '使用 AI 辅助写作',
    description:
      '进入章节编辑器后，选中文本可使用「扩写」或「改写」功能；将光标放在段落末尾可触发「续写」。快捷键 Ctrl+G 可快速打开 AI 生成。'
  },
  {
    title: '管理角色与情节',
    description:
      '在小说详情页中，你可以添加角色档案、编辑章节大纲、追踪情节线索，还能通过「关系图」查看角色之间的共现关系。'
  }
]

export function useOnboarding(steps: OnboardingStep[] = DEFAULT_STEPS) {
  const currentStep = useState<number>('onboarding-step', () => 0)

  const isCompleted = useState<boolean>('onboarding-completed', () => {
    if (import.meta.server) return false
    try {
      return localStorage.getItem(ONBOARDING_KEY) === 'true'
    } catch {
      return false
    }
  })

  const showOnboarding = computed(
    () => !isCompleted.value && currentStep.value < steps.length
  )

  function nextStep() {
    if (currentStep.value < steps.length - 1) {
      currentStep.value++
    } else {
      complete()
    }
  }

  function complete() {
    isCompleted.value = true
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true')
    } catch {}
  }

  function reset() {
    isCompleted.value = false
    currentStep.value = 0
    try {
      localStorage.removeItem(ONBOARDING_KEY)
    } catch {}
  }

  return {
    steps,
    currentStep,
    isCompleted,
    showOnboarding,
    nextStep,
    complete,
    reset
  }
}
