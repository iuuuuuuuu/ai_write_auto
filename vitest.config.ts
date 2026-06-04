import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // 顺序执行测试文件：并行 worker 会共享 MikroORM 全局单例/原生 libsql 状态而相互污染，
    // 导致并行时所有文件在 describe 处报 "Cannot read properties of undefined (reading 'config')"。
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '~': new URL('./app', import.meta.url).pathname,
      '~~': new URL('./', import.meta.url).pathname,
    }
  }
})
