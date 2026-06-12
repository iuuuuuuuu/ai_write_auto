export const AI_GENERATION_MODEL_TYPE_OPTIONS = [
  { label: '全部调用类型', value: 'all' },
  { label: '文本创作与分析', value: 'chat_completion' },
  { label: '知识库向量处理', value: 'embedding' },
  { label: '模型连通检测', value: 'connectivity_check' }
] as const

const AI_GENERATION_SCENARIO_LABELS: Record<string, string> = {
  suggest_description: '创建小说：生成/丰满简介',
  worldbuilding_generate: '创建小说：生成世界观与文风',
  outline_generate: '大纲：生成章节大纲',
  chapter_workflow_plan: '章节：生成剧情计划',
  chapter_generate: '章节：生成正文',
  chapter_regenerate: '章节：重新生成正文',
  suggest_title: '章节：生成标题',
  chapter_suggest: '章节：写作建议',
  inline_continue: '编辑器：续写正文',
  inline_rewrite: '编辑器：润色改写',
  inline_expand: '编辑器：扩写内容',
  fragment_generate: '编辑器：片段生成',
  style_analysis: '风格：分析文风',
  consistency_check: '一致性：检查剧情矛盾',
  plot_thread_extract: '剧情线：提取线索',
  character_state_extract: '角色：提取状态变化',
  character_extract: '角色：从章节提取',
  character_generate: '角色：批量生成',
  character_suggest: '角色：生成建议',
  character_enrich: '角色：补全设定',
  workspace_review: 'AI 审核：工作区审核',
  rag_query_planning: '知识库：规划检索',
  embedding_query: '知识库：向量检索',
  embedding_index: '知识库：建立索引',
  embedding_model_download: '模型：下载嵌入模型',
  model_test: '模型：测试调用',
  model_connectivity_check: '模型：连通检查',
  unclassified_ai_call: '未分类 AI 调用'
}

const AI_GENERATION_TASK_TYPE_BY_SCENARIO: Record<string, string> = {
  suggest_description: '小说创建',
  worldbuilding_generate: '小说创建',
  outline_generate: '大纲规划',
  chapter_workflow_plan: '章节规划',
  chapter_generate: '章节写作',
  chapter_regenerate: '章节写作',
  suggest_title: '章节写作',
  chapter_suggest: '章节写作',
  inline_continue: '编辑辅助',
  inline_rewrite: '编辑辅助',
  inline_expand: '编辑辅助',
  fragment_generate: '编辑辅助',
  style_analysis: '风格分析',
  consistency_check: '内容分析',
  plot_thread_extract: '内容分析',
  character_state_extract: '角色设定',
  character_extract: '角色设定',
  character_generate: '角色设定',
  character_suggest: '角色设定',
  character_enrich: '角色设定',
  workspace_review: 'AI 审核',
  rag_query_planning: '知识库',
  embedding_query: '知识库',
  embedding_index: '知识库',
  embedding_model_download: '模型维护',
  model_test: '模型检测',
  model_connectivity_check: '模型检测'
}

export function getAiGenerationModelTypeLabel(modelType: string) {
  if (modelType === 'embedding') return '知识库向量处理'
  if (modelType === 'connectivity_check') return '模型连通检测'
  if (modelType === 'chat_completion') return '文本创作与分析'
  return modelType || '未知类型'
}

export function getAiGenerationScenarioLabel(scenario: string) {
  return AI_GENERATION_SCENARIO_LABELS[scenario] || scenario || '未分类场景'
}

export function getAiGenerationTaskTypeLabel(
  modelType: string,
  scenario: string
) {
  if (modelType === 'embedding') return '知识库'
  if (modelType === 'connectivity_check') return '模型检测'
  return (
    AI_GENERATION_TASK_TYPE_BY_SCENARIO[scenario] ||
    getAiGenerationModelTypeLabel(modelType)
  )
}

export function getAiGenerationScenarioOptions() {
  return Object.entries(AI_GENERATION_SCENARIO_LABELS).map(
    ([value, label]) => ({ label, value })
  )
}
