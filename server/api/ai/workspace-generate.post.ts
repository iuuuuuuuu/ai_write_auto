export default defineEventHandler(() => {
  throw createError({
    statusCode: 410,
    message:
      '批量生成工作区已下线，请使用单章工作流程生成并验收剧情计划后再生成正文'
  })
})
