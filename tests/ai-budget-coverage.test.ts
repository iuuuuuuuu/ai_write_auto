import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

function collectTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      out.push(...collectTsFiles(fullPath))
    } else if (name.endsWith('.ts')) {
      out.push(fullPath)
    }
  }
  return out
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

function isAllowlisted(relativePath: string, line: string): boolean {
  return relativePath === 'server/utils/ai-client.ts'
}

describe('AI token budget coverage', () => {
  it('keeps non-allowlisted toAiOptions calls behind the shared budget helper', () => {
    const root = process.cwd()
    const files = collectTsFiles(join(root, 'server'))
    const misses: string[] = []

    for (const file of files) {
      const relativePath = relative(root, file).replace(/\\/g, '/')
      const content = readFileSync(file, 'utf8')
      const regexp = /toAiOptions\(/g
      let match: RegExpExecArray | null

      while ((match = regexp.exec(content))) {
        const lineNumber = lineNumberAt(content, match.index)
        const line = content.split('\n')[lineNumber - 1] || ''
        if (isAllowlisted(relativePath, line)) continue

        const contextStart = Math.max(0, match.index - 400)
        const context = content.slice(contextStart, match.index + 40)
        const budgeted =
          context.includes('prepareBudgetedAiOptions(') ||
          context.includes('budgetTaskAiOptions(')

        if (!budgeted) {
          misses.push(`${relativePath}:${lineNumber} ${line.trim()}`)
        }
      }
    }

    expect(misses).toEqual([])
  })
})
