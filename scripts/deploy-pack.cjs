const { execSync } = require('child_process')
const { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } = require('fs')
const { resolve, join } = require('path')
const pkg = require('../package.json')

const PROJECT_DIR = resolve(__dirname, '..')
const name = (pkg.name + '_v' + pkg.version).replace(/[-.]/g, '_')
const DIST_DIR = join(PROJECT_DIR, name)
const ARCHIVE = join(PROJECT_DIR, `${name}.tar.gz`)

console.log(`==> 打包 ${name}...`)

// 清理旧产物
if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true })
if (existsSync(ARCHIVE)) rmSync(ARCHIVE)
mkdirSync(DIST_DIR, { recursive: true })

// 1. 构建
console.log('==> 正在构建项目...')
execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'inherit' })

// 2. 拷贝文件
console.log('==> 拷贝部署文件...')
cpSync(join(PROJECT_DIR, '.output'), join(DIST_DIR, '.output'), { recursive: true })
cpSync(join(PROJECT_DIR, '.env.example'), join(DIST_DIR, '.env.example'))
cpSync(join(PROJECT_DIR, '.npmrc'), join(DIST_DIR, '.npmrc'))
// Worker 文件（Nitro 不会自动 bundle）
cpSync(join(PROJECT_DIR, 'server/services/embedding-worker.mjs'), join(DIST_DIR, '.output/server/embedding-worker.mjs'))
if (existsSync(join(PROJECT_DIR, 'Dockerfile'))) {
  cpSync(join(PROJECT_DIR, 'Dockerfile'), join(DIST_DIR, 'Dockerfile'))
}

// 2.1 生成服务端原生依赖 package.json（部署后在服务器上 cd .output/server && npm install）
writeFileSync(join(DIST_DIR, '.output', 'server', 'package.json'), JSON.stringify({
  name: 'ai-novel-server',
  private: true,
  dependencies: {
    'libsql': '*'
  }
}, null, 2))

// 2.2 生成部署根目录 package.json
writeFileSync(join(DIST_DIR, 'package.json'), JSON.stringify({
  name: 'ai-novel-writer-deploy',
  private: true,
  scripts: {
    start: 'node --env-file=.env .output/server/index.mjs',
    postinstall: 'cd .output/server && npm install --omit=dev'
  }
}, null, 2))

// 创建空 data 目录
mkdirSync(join(DIST_DIR, 'data'), { recursive: true })

// 3. 启动脚本（从 .env 读取配置）
writeFileSync(join(DIST_DIR, 'start.sh'), `#!/bin/bash
cd "$(dirname "$0")"
set -a
source .env
set +a
export NODE_ENV=production
node .output/server/index.mjs
`)

// 4. PM2 配置（从 .env 读取）
writeFileSync(join(DIST_DIR, 'ecosystem.config.cjs'), `const { readFileSync } = require('fs')
const { resolve } = require('path')

function loadEnv() {
  const envPath = resolve(__dirname, '.env')
  const env = { NODE_ENV: 'production' }
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...rest] = trimmed.split('=')
      env[key.trim()] = rest.join('=').trim()
    }
  } catch {}
  return env
}

module.exports = {
  apps: [{
    name: 'ai-novel',
    script: '.output/server/index.mjs',
    cwd: __dirname,
    env: loadEnv(),
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
  }]
}
`)

// 5. 压缩为 tar.gz
console.log('==> 正在压缩...')
execSync('tar -czf "../' + name + '.tar.gz" .', { cwd: DIST_DIR, stdio: 'inherit' })

// 6. 清理
rmSync(DIST_DIR, { recursive: true })

console.log(`==> 打包完成: ${name}.tar.gz`)
console.log('')
console.log('部署步骤:')
console.log(`  1. 上传 ${name}.tar.gz 到服务器`)
console.log(`  2. mkdir -p /www/wwwroot/${name} && cd /www/wwwroot/${name}`)
console.log(`  3. tar -xzf ${name}.tar.gz`)
console.log('  4. npm install (安装原生依赖)')
console.log('  5. cp .env.example .env && 编辑 .env 修改配置')
console.log('  6. pm2 start ecosystem.config.cjs')
console.log('  7. 访问 http://你的IP:<PORT> 完成初始化')
