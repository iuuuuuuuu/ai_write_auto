export default defineNuxtPlugin(() => {
  const router = useRouter()

  const SKIP_PATHS = ['/login', '/register', '/setup']

  const TITLE_MAP: Record<string, string> = {
    '/dashboard': '仪表盘',
    '/models': '模型库',
    '/settings': '设置',
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
    '/admin/settings': '站点设置',
  }

  function resolveTitle(path: string): string {
    if (TITLE_MAP[path]) return TITLE_MAP[path]
    if (/^\/novels\/[^/]+\/chapters\/[^/]+$/.test(path)) return '章节编辑'
    if (/^\/novels\/[^/]+$/.test(path)) return '小说详情'
    if (/^\/admin\/users\/[^/]+$/.test(path)) return '用户详情'
    if (/^\/admin\/novels\/[^/]+$/.test(path)) return '小说详情'
    return path
  }

  router.afterEach((to) => {
    if (SKIP_PATHS.some(p => to.path.startsWith(p))) return
    if (to.path === '/') return

    const area = to.path.startsWith('/admin') ? 'admin' : 'user'
    const { addTab, activateByPath } = useTabs(area as 'user' | 'admin')

    if (!activateByPath(to.path)) {
      const title = resolveTitle(to.path)
      addTab(to.path, { title })
    }
  })
})
