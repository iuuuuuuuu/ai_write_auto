import { describe, it, expect } from 'vitest'
import {
  AI_CONNECT_TIMEOUT_MS,
  AI_STREAM_READ_TIMEOUT_MS,
  MAX_TOKENS_ACTION,
  MAX_TOKENS_FRAGMENT,
  MAX_TOKENS_SUGGEST,
  MAX_TOKENS_WORKSPACE,
  CONTEXT_TRUNCATE_FULL,
  CONTEXT_TRUNCATE_INLINE,
  CONTEXT_TRUNCATE_FRAGMENT,
} from '../server/utils/ai-constants'

describe('ai-constants', () => {
  it('timeout values are reasonable (10s-60s)', () => {
    expect(AI_CONNECT_TIMEOUT_MS).toBeGreaterThanOrEqual(10000)
    expect(AI_CONNECT_TIMEOUT_MS).toBeLessThanOrEqual(60000)
    expect(AI_STREAM_READ_TIMEOUT_MS).toBeGreaterThanOrEqual(10000)
    expect(AI_STREAM_READ_TIMEOUT_MS).toBeLessThanOrEqual(60000)
  })

  it('max token values are positive', () => {
    for (const v of [MAX_TOKENS_FRAGMENT, MAX_TOKENS_ACTION, MAX_TOKENS_SUGGEST, MAX_TOKENS_WORKSPACE]) {
      expect(v).toBeGreaterThan(0)
    }
    // 连续生成需要更大的输出空间以容纳长章节
    expect(MAX_TOKENS_WORKSPACE).toBeGreaterThanOrEqual(MAX_TOKENS_ACTION)
  })

  it('context truncation values are ordered', () => {
    expect(CONTEXT_TRUNCATE_FRAGMENT).toBeLessThan(CONTEXT_TRUNCATE_INLINE)
    expect(CONTEXT_TRUNCATE_INLINE).toBeLessThan(CONTEXT_TRUNCATE_FULL)
  })
})
