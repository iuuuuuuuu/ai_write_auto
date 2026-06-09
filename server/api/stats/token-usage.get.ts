export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const days = Math.min(365, Math.max(1, parseInt((query.days as string) || '30')))
  const granularity = query.granularity === 'hour' ? 'hour' : 'day'
  const em = useEm(event)

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceTs = Math.floor(since.getTime() / 1000)

  const conn = em.getConnection()

  // 总量（费用按字符串存储，CAST 为 REAL 再汇总）
  const [sumRow] = (await conn.execute(
    `SELECT COALESCE(SUM(tokens_input),0) as ti, COALESCE(SUM(tokens_output),0) as "to",
            COALESCE(SUM(CASE WHEN estimated_cost IS NOT NULL THEN CAST(estimated_cost AS REAL) ELSE 0 END),0) as tec,
            COUNT(*) as cnt
     FROM token_usage WHERE user_id = ? AND created_at >= ?`,
    [auth.userId, sinceTs]
  )) as any[]
  const totalInput = Number(sumRow?.ti || 0)
  const totalOutput = Number(sumRow?.['to'] || 0)
  const totalEstimatedCost = Number(sumRow?.tec || 0)
  const totalCalls = Number(sumRow?.cnt || 0)

  // 按天/小时聚合（本地时区），覆盖整个区间——可量化的趋势视图
  const bucketExpr =
    granularity === 'hour'
      ? `strftime('%Y-%m-%d %H:00', created_at, 'unixepoch', 'localtime')`
      : `date(created_at, 'unixepoch', 'localtime')`
  const rows = (await conn.execute(
    `SELECT ${bucketExpr} as bucket,
            COALESCE(SUM(tokens_input),0) as input,
            COALESCE(SUM(tokens_output),0) as output,
            COALESCE(SUM(CASE WHEN estimated_cost IS NOT NULL THEN CAST(estimated_cost AS REAL) ELSE 0 END),0) as cost,
            COUNT(*) as calls
     FROM token_usage WHERE user_id = ? AND created_at >= ?
     GROUP BY bucket ORDER BY bucket ASC`,
    [auth.userId, sinceTs]
  )) as any[]

  const usage = rows.map((r) => ({
    bucket: String(r.bucket),
    tokensInput: Number(r.input || 0),
    tokensOutput: Number(r.output || 0),
    tokensTotal: Number(r.input || 0) + Number(r.output || 0),
    cost: Number(r.cost || 0),
    calls: Number(r.calls || 0)
  }))

  return {
    granularity,
    days,
    totalInput,
    totalOutput,
    totalTokens: totalInput + totalOutput,
    totalCalls,
    totalEstimatedCost: totalEstimatedCost > 0 ? totalEstimatedCost.toFixed(4) : null,
    // 前端读取的字段名为 usage（按时间正序的聚合桶）
    usage
  }
})
