export default defineNuxtPlugin(() => {
  const router = useRouter()

  const SKIP_PATHS = ['/login', '/register', '/setup']

  const TITLE_MAP: Record<string, string> = {
    '/dashboard': '仪表盘',
    '/models': '模型库',
    '/settings': '设置',
    '/settings/general': '通用偏好',
    '/settings/database': '数据库与备份',
    '/settings/writing': '写作目标',
    '/settings/skills': '写作技能',
    '/settings/usage': 'AI 用量与调用记录',
    '/settings/ai-generation-logs': 'AI 用量与调用记录',
    '/settings/openapi': 'Open API',
    '/trash': '回收站',
    '/admin': '管理概览',
    '/admin/users': '用户管理',
    '/admin/novels': '小说管理',
    '/admin/ai-configs': '模型配置',
    '/admin/tasks': '生成任务',
    '/admin/token-usage': 'Token 用量',
    '/admin/writing-stats': '写作统计',
    '/admin/prompts': '提示词模板',
    '/admin/templates': '小说模板',
    '/admin/settings': '站点设置'
  }

  const CHAPTER_PATH_RE = /^\/novels\/([^/]+)\/chapters\/[^/]+$/

  function resolveTitle(path: string): string {
    if (TITLE_MAP[path]) return TITLE_MAP[path]
    if (CHAPTER_PATH_RE.test(path)) return '章节编辑'
    if (/^\/novels\/[^/]+$/.test(path)) return '小说详情'
    if (/^\/admin\/users\/[^/]+$/.test(path)) return '用户详情'
    if (/^\/admin\/novels\/[^/]+$/.test(path)) return '小说详情'
    return path
  }

  function getNovelIdFromChapterPath(path: string): string | null {
    const match = path.match(CHAPTER_PATH_RE)
    return match ? match[1]! : null
  }

  router.afterEach((to, from) => {
    if (SKIP_PATHS.some((p) => to.path.startsWith(p))) return
    if (to.path === '/') return

    const area = to.path.startsWith('/admin') ? 'admin' : 'user'
    const { addTab, activateByPath, tabs } = useTabs(area as 'user' | 'admin')

    if (activateByPath(to.path)) return

    // Same-novel chapter switch: update current tab in-place instead of adding new
    const toNovelId = getNovelIdFromChapterPath(to.path)
    const fromNovelId = getNovelIdFromChapterPath(from.path)
    if (toNovelId && fromNovelId && toNovelId === fromNovelId) {
      const currentTab = tabs.value.find((t) => t.path === from.path)
      if (currentTab) {
        currentTab.path = to.path
        currentTab.title = resolveTitle(to.path)
        return
      }
    }

    const title = resolveTitle(to.path)
    addTab(to.path, { title })
  })
})
